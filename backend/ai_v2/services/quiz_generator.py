"""
Adaptive Quiz Question Generator Service.

Generates contextual quiz questions based on:
- Previous answers
- Current user profile
- Quiz progression
- Anti-repetition logic

Questions are designed to discover:
- Interests
- Hobbies
- Strengths
- Work preferences
- Problems they want to solve
- What they DON'T like

Key Features:
1. Tracks all previous questions to avoid repetition
2. Generates dynamic answer options based on prior responses
3. Uses full answer history for contextual question generation
4. Semantic similarity checking for question uniqueness
"""

from typing import Optional, List, Dict, Any
import re
from ..utils import get_logger
from ..services import LLMService
from ..schemas.quiz_schemas import (
    QuizQuestionResponse,
    QuestionCategory,
    UserProfileSchema,
)

logger = get_logger(__name__)


class AdaptiveQuizGenerator:
    """Generates context-aware quiz questions for career discovery with anti-repetition."""

    # Initial questions to start the quiz
    STARTER_QUESTIONS = [
        {
            "question": "What kind of tasks or activities make you lose track of time?",
            "category": QuestionCategory.INTEREST_DISCOVERY,
            "options": [
                {"id": "opt_1", "label": "Solving logic problems and building things"},
                {"id": "opt_2", "label": "Helping people and explaining concepts"},
                {"id": "opt_3", "label": "Creative expression and design"},
                {"id": "opt_4", "label": "Organizing systems and improving processes"},
                {"id": "opt_5", "label": "Analyzing data and finding patterns"},
            ]
        },
        {
            "question": "In your free time, what do you most enjoy?",
            "category": QuestionCategory.INTEREST_DISCOVERY,
            "options": [
                {"id": "opt_1", "label": "Building personal projects"},
                {"id": "opt_2", "label": "Learning new skills and technologies"},
                {"id": "opt_3", "label": "Creating content or art"},
                {"id": "opt_4", "label": "Collaborating with others on ideas"},
                {"id": "opt_5", "label": "Studying and research"},
            ]
        },
    ]

    def __init__(self):
        """Initialize the quiz generator."""
        self.llm = LLMService()

    def _extract_keywords(self, text: str) -> List[str]:
        """Extract key topics/keywords from text for semantic comparison."""
        # Remove common words, split by common delimiters
        stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'is', 'are', 'was', 'be'}
        words = re.findall(r'\b\w+\b', text.lower())
        return [w for w in words if w not in stop_words and len(w) > 2]

    def _is_semantically_similar(self, question1: str, question2: str, threshold: float = 0.6) -> bool:
        """
        Check if two questions are semantically similar.
        Uses keyword overlap approach.
        """
        keywords1 = set(self._extract_keywords(question1))
        keywords2 = set(self._extract_keywords(question2))
        
        if not keywords1 or not keywords2:
            return False
        
        overlap = len(keywords1 & keywords2)
        total = max(len(keywords1), len(keywords2))
        similarity = overlap / total if total > 0 else 0
        
        return similarity >= threshold

    def _get_all_previous_questions(self, previous_answers: List[Dict[str, Any]]) -> List[str]:
        """Extract all previous question texts for anti-repetition checking."""
        return [answer.get("question", "") for answer in previous_answers if answer.get("question")]

    def _should_regenerate_question(self, new_question: str, previous_questions: List[str]) -> bool:
        """
        Determine if new question is too similar to previous ones.
        
        Checks for:
        1. Exact match
        2. Semantic similarity
        """
        new_q_normalized = new_question.strip().lower()
        
        for prev_q in previous_questions:
            prev_q_normalized = prev_q.strip().lower()
            
            # Exact match check
            if new_q_normalized == prev_q_normalized:
                logger.info(f"Exact match detected: {new_question}")
                return True
            
            # Semantic similarity check
            if self._is_semantically_similar(new_question, prev_q):
                logger.info(f"Semantic similarity detected: {new_question} vs {prev_q}")
                return True
        
        return False

    def _generate_dynamic_options(
        self,
        previous_answer: Optional[str] = None,
        context: Optional[str] = None,
        option_count: int = 4
    ) -> List[Dict[str, str]]:
        """
        Generate dynamic answer options based on previous answer.
        
        If previous_answer provided, uses LLM to create related sub-options.
        Otherwise returns None to allow free-text entry.
        """
        if not previous_answer:
            return []  # Empty list means free-text input
        
        prompt = f"""
        User previously answered: "{previous_answer}"
        
        Generate {option_count} specific, distinct follow-up options that drill deeper into their answer.
        Make each option specific and actionable, not generic.
        
        Format as JSON array only, no extra text:
        [
            {{"id": "opt_1", "label": "specific option 1"}},
            {{"id": "opt_2", "label": "specific option 2"}},
            {{"id": "opt_3", "label": "specific option 3"}},
            {{"id": "opt_4", "label": "specific option 4"}}
        ]
        """
        
        try:
            response = self.llm.call(prompt)
            import json
            options = json.loads(response.strip())
            
            # Validate response
            if isinstance(options, list) and len(options) > 0:
                return options[:option_count]
        except Exception as e:
            logger.warning(f"Dynamic option generation failed: {e}")
        
        return []

    def _extract_profile_from_answers(self, previous_answers: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Extract accumulated interests and strengths from all previous answers."""
        interests = set()
        strengths = set()
        preferences = set()
        
        for answer in previous_answers:
            if answer.get("inferred_interests"):
                interests.update(answer.get("inferred_interests", []))
            if answer.get("inferred_strengths"):
                strengths.update(answer.get("inferred_strengths", []))
            if answer.get("inferred_preferences"):
                preferences.update(answer.get("inferred_preferences", []))
        
        return {
            "interests": list(interests),
            "strengths": list(strengths),
            "work_preferences": list(preferences),
        }

    def get_first_question(self) -> Dict[str, Any]:
        """Get the first quiz question."""
        return {
            "question_number": 1,
            "total_questions": 7,  # Estimated total
            "category": "interest_discovery",
            "based_on": None,
            **self.STARTER_QUESTIONS[0]
        }

    def generate_next_question(
        self,
        previous_answers: List[Dict[str, Any]],
        current_profile: Optional[UserProfileSchema] = None,
    ) -> QuizQuestionResponse:
        """
        Generate next adaptive question based on previous answers with anti-repetition.
        
        Strategy:
        1. If <3 answers: ask about interests/strengths (discovery)
        2. If answer hints at specific area: ask deepening questions
        3. Avoid repeating or semantically similar questions
        4. Use full answer history for context
        5. If conflicting signals: ask clarifying questions
        6. If profile is complete enough: ask about dislikes/environment
        
        Args:
            previous_answers: List of previous Q&A objects with all fields
            current_profile: Accumulated profile from quiz so far
        
        Returns:
            QuizQuestionResponse with next question
        """
        try:
            question_number = len(previous_answers) + 1
            max_retries = 3
            retry_count = 0
            
            previous_questions = self._get_all_previous_questions(previous_answers)
            
            while retry_count < max_retries:
                new_question = None
                
                if question_number == 1:
                    return QuizQuestionResponse(
                        success=True,
                        data=self._format_question(self.STARTER_QUESTIONS[0], 1, 7, None)
                    )
                
                if question_number == 2 and previous_answers:
                    # Deepen based on first answer
                    response = self._generate_deepening_question(
                        previous_answers[-1],
                        question_number,
                        current_profile,
                        previous_questions
                    )
                    if response.success:
                        return response
                
                if question_number == 3:
                    # Work environment or broader interests
                    response = self._generate_environment_question(
                        previous_answers,
                        question_number,
                        current_profile,
                        previous_questions
                    )
                    if response.success:
                        return response
                
                if question_number >= 4:
                    # Mix in dislikes, strengths, challenges
                    response = self._generate_advanced_question(
                        previous_answers,
                        question_number,
                        current_profile,
                        previous_questions
                    )
                    if response.success:
                        return response
                
                retry_count += 1
            
            # Final fallback - should rarely happen
            return self._generate_generic_question(question_number, current_profile, previous_questions)
            
        except Exception as e:
            logger.error(f"Error generating next question: {e}", exc_info=True)
            return QuizQuestionResponse(
                success=False,
                error=f"Failed to generate question: {str(e)}"
            )

    def _generate_deepening_question(
        self,
        previous_answer: Dict[str, Any],
        question_number: int,
        current_profile: Optional[UserProfileSchema],
        previous_questions: List[str],
    ) -> QuizQuestionResponse:
        """Generate a deepening question based on previous answer with anti-repetition."""
        answer_text = previous_answer.get("answer", "")
        
        # Try to generate a unique deepening question
        prompt = f"""
        The user answered: "{answer_text}"
        
        Previous questions asked: {previous_questions}
        
        DO NOT repeat any previous questions or ask about the same topic in the same way.
        Based on their interest in {answer_text}, generate a DIFFERENT deepening question that explores a new angle.
        Ask about a specific aspect they didn't mention.
        
        Example: If they answered "solving problems", ask about specific types of problems or the environment.
        
        Then generate 4 specific sub-options for that question.
        
        Format your response as a JSON object only:
        {{
            "question": "The deepening question text",
            "options": [
                {{"id": "opt_1", "label": "option 1"}},
                {{"id": "opt_2", "label": "option 2"}},
                {{"id": "opt_3", "label": "option 3"}},
                {{"id": "opt_4", "label": "option 4"}}
            ]
        }}
        """
        
        try:
            response = self.llm.call(prompt)
            import json
            result = json.loads(response.strip())
            
            new_question = result.get("question", "")
            
            # Check if generated question is unique
            if self._should_regenerate_question(new_question, previous_questions):
                logger.info("Generated question is too similar to previous, using fallback")
                return self._generate_environment_question(
                    [],
                    question_number,
                    current_profile,
                    previous_questions
                )
            
            return QuizQuestionResponse(
                success=True,
                data=self._format_question(
                    result,
                    question_number,
                    7,
                    f"Deepening on: {answer_text}"
                )
            )
        except Exception as e:
            logger.warning(f"LLM deepening failed, using fallback: {e}")
            return self._generate_environment_question(
                [],
                question_number,
                current_profile,
                previous_questions
            )

    def _generate_environment_question(
        self,
        previous_answers: List[Dict[str, Any]],
        question_number: int,
        current_profile: Optional[UserProfileSchema],
        previous_questions: List[str],
    ) -> QuizQuestionResponse:
        """Generate question about work environment, checking for repetition."""
        question_text = "How do you prefer to work?"
        
        # Check if we've already asked about work environment
        if self._should_regenerate_question(question_text, previous_questions):
            # Ask about strengths instead
            question_text = "What are you naturally good at?"
            
            if self._should_regenerate_question(question_text, previous_questions):
                # Ask about what they dislike
                question_text = "What would make work feel unfulfilling?"
        
        question_dict = {
            "question": question_text,
            "category": QuestionCategory.WORK_ENVIRONMENT,
            "options": [
                {"id": "opt_1", "label": "Independently, focused on my own tasks"},
                {"id": "opt_2", "label": "In a team, collaborating closely"},
                {"id": "opt_3", "label": "Hybrid: mix of solo work and collaboration"},
                {"id": "opt_4", "label": "With clients or customers directly"},
                {"id": "opt_5", "label": "In a structured, process-driven environment"},
            ]
        }
        
        return QuizQuestionResponse(
            success=True,
            data=self._format_question(
                question_dict,
                question_number,
                7,
                None
            )
        )

    def _generate_advanced_question(
        self,
        previous_answers: List[Dict[str, Any]],
        question_number: int,
        current_profile: Optional[UserProfileSchema],
        previous_questions: List[str],
    ) -> QuizQuestionResponse:
        """Generate advanced questions about challenges, strengths, dislikes with anti-repetition."""
        questions = [
            {
                "question": "What kind of problems would you like to solve in your career?",
                "category": QuestionCategory.CHALLENGE_DISCOVERY,
                "options": [
                    {"id": "opt_1", "label": "Technical/engineering problems"},
                    {"id": "opt_2", "label": "People and communication issues"},
                    {"id": "opt_3", "label": "Creative and design challenges"},
                    {"id": "opt_4", "label": "Business and strategy problems"},
                    {"id": "opt_5", "label": "Data analysis and insights"},
                ]
            },
            {
                "question": "What type of work would be a dealbreaker for you?",
                "category": QuestionCategory.DISLIKE_IDENTIFICATION,
                "options": [
                    {"id": "opt_1", "label": "Repetitive, routine tasks"},
                    {"id": "opt_2", "label": "Travel-heavy or unpredictable schedules"},
                    {"id": "opt_3", "label": "Dealing with complex regulations/compliance"},
                    {"id": "opt_4", "label": "High-pressure sales or constant deadlines"},
                    {"id": "opt_5", "label": "Politics or navigating office dynamics"},
                ]
            },
            {
                "question": "Which skills are you most proud of?",
                "category": QuestionCategory.STRENGTH_VALIDATION,
                "options": [
                    {"id": "opt_1", "label": "Problem-solving and critical thinking"},
                    {"id": "opt_2", "label": "Communication and leadership"},
                    {"id": "opt_3", "label": "Technical expertise"},
                    {"id": "opt_4", "label": "Creativity and innovation"},
                    {"id": "opt_5", "label": "Organization and planning"},
                ]
            },
        ]
        
        # Find a question that hasn't been asked yet
        for q in questions:
            if not self._should_regenerate_question(q.get("question", ""), previous_questions):
                return QuizQuestionResponse(
                    success=True,
                    data=self._format_question(
                        q,
                        question_number,
                        7,
                        None
                    )
                )
        
        # All questions have been asked, use generic
        return self._generate_generic_question(question_number, current_profile, previous_questions)

    def _generate_generic_question(
        self,
        question_number: int,
        current_profile: Optional[UserProfileSchema],
        previous_questions: Optional[List[str]] = None,
    ) -> QuizQuestionResponse:
        """Generate a generic fallback question."""
        return QuizQuestionResponse(
            success=True,
            data=self._format_question(
                {
                    "question": "Tell us more about your career interests",
                    "category": QuestionCategory.INTEREST_DISCOVERY,
                    "options": [
                        {"id": "opt_1", "label": "Technology and innovation"},
                        {"id": "opt_2", "label": "Business and entrepreneurship"},
                        {"id": "opt_3", "label": "Creative fields"},
                        {"id": "opt_4", "label": "People-focused roles"},
                        {"id": "opt_5", "label": "Not sure yet"},
                    ]
                },
                question_number,
                7,
                None
            )
        )

    def _format_question(
        self,
        question_dict: Dict[str, Any],
        question_number: int,
        total_questions: int,
        based_on: Optional[str],
    ) -> Dict[str, Any]:
        """Format question for API response."""
        return {
            "question_number": question_number,
            "total_questions": total_questions,
            "question": question_dict.get("question", ""),
            "category": question_dict.get("category", "general"),
            "based_on": based_on,
            "options": question_dict.get("options", []),
        }
