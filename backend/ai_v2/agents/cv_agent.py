"""
CV Agent for AI v2 module.

Extracts skills and information from user's CV, including ATS scoring.
"""

from typing import Any, Dict, List, Tuple
import re

from ..schemas import AgentOutput, AgentType
from ..services import LLMService
from .base_agent import BaseAgent


class CVAgent(BaseAgent):
    """
    Agent responsible for analyzing CV documents.
    
    Purpose:
        - Extract skills from CV text
        - Identify work experience and projects
        - Parse education and certifications
        - Enhance user profile with CV insights
        - Calculate ATS (Applicant Tracking System) score
        - Use RAG to match CV content with job descriptions
    
    ATS Scoring Components:
        - Keyword matching (technical + soft skills): 40%
        - Formatting completeness: 30%
        - Section presence: 20%
        - Job relevance: 10%
    
    TODO:
        - Build RAG system for skill extraction
        - Implement CV parsing logic
        - Add section identification (Experience, Education, Skills)
        - Use LLM for semantic skill extraction
        - Integration with document storage service
    """

    # Common ATS keywords and requirements
    ATS_KEYWORDS = {
        "technical_skills": [
            "python", "java", "javascript", "c++", "c#", "sql", "react", "angular", "vue",
            "nodejs", "django", "flask", "fastapi", "aws", "gcp", "azure", "docker", "kubernetes",
            "git", "linux", "unix", "windows", "macos", "html", "css", "json", "xml",
            "rest", "graphql", "postgresql", "mongodb", "mysql", "redis", "kafka",
            "machine learning", "deep learning", "tensorflow", "pytorch", "scikit-learn",
            "data science", "analytics", "tableau", "power bi", "excel",
        ],
        "soft_skills": [
            "leadership", "communication", "teamwork", "project management", "agile",
            "scrum", "kanban", "problem solving", "critical thinking", "analytical",
            "creative", "attention to detail", "time management", "collaboration",
        ],
        "sections": ["experience", "education", "skills", "projects", "certifications"],
    }

    def __init__(self):
        """Initialize the CVAgent."""
        super().__init__(
            agent_type=AgentType.CV,
            name="CV Analyzer",
        )
        self.llm = LLMService()

    def run(self, input_data: Dict[str, Any]) -> AgentOutput:
        """
        Analyze CV content and calculate ATS score.
        
        Args:
            input_data (Dict[str, Any]): Must contain 'cv_text' key with CV content
        
        Returns:
            AgentOutput: CV analysis result including ATS score
        
        Example:
            >>> agent = CVAgent()
            >>> result = agent.run({"cv_text": cv_content})
            >>> print(result.data["ats_score"])
        """
        try:
            self._log_execution("Starting CV analysis with ATS scoring")

            cv_text = input_data.get("cv_text")
            if not cv_text:
                self._log_execution("No CV text provided, skipping CV analysis", level="warning")
                return self._create_output(
                    success=True,
                    data={"cv_provided": False},
                )

            # Use LLM to extract skills from CV
            extracted_skills_llm = self._extract_skills_with_llm(cv_text)
            
            # Extract skills and analyze CV
            cv_insights = {
                "cv_provided": True,
                "skills_extracted": extracted_skills_llm or self._extract_skills(cv_text),
                "experience_entries": self._extract_experience(cv_text),
                "education_entries": self._extract_education(cv_text),
                "certifications": self._extract_certifications(cv_text),
                "projects": self._extract_projects(cv_text),
                "extraction_confidence": 0.85,  # Higher confidence with LLM assistance
            }
            
            # Calculate ATS score
            ats_score, ats_breakdown = self._calculate_ats_score(cv_text, cv_insights)
            cv_insights["ats_score"] = ats_score
            cv_insights["ats_breakdown"] = ats_breakdown
            cv_insights["ats_suggestions"] = self._generate_ats_suggestions(ats_breakdown)

            self._log_execution(f"CV analysis completed - ATS Score: {ats_score:.1f}%")

            return self._create_output(
                success=True,
                data=cv_insights,
            )
        except Exception as e:
            self._log_execution(f"Error during CV analysis: {str(e)}", level="error")
            return self._create_output(
                success=False,
                error=str(e),
            )

    def _extract_skills(self, cv_text: str) -> List[str]:
        """
        Extract technical and soft skills from CV.
        
        TODO: Replace with LLM-based extraction
        """
        skills = []
        cv_lower = cv_text.lower()
        
        # Check for all ATS keywords
        for skill in self.ATS_KEYWORDS["technical_skills"]:
            if skill in cv_lower:
                skills.append(skill.title())
        
        for skill in self.ATS_KEYWORDS["soft_skills"]:
            if skill in cv_lower:
                skills.append(skill.title())
        
        return list(set(skills))  # Remove duplicates

    def _extract_experience(self, cv_text: str) -> List[Dict[str, Any]]:
        """
        Extract work experience entries.
        
        TODO: Implement proper parsing
        """
        # Mock extraction - would use LLM in production
        return []

    def _extract_education(self, cv_text: str) -> List[Dict[str, Any]]:
        """
        Extract education entries.
        
        TODO: Implement proper parsing
        """
        # Mock extraction - would use LLM in production
        return []

    def _extract_certifications(self, cv_text: str) -> List[str]:
        """
        Extract certifications.
        
        TODO: Implement proper parsing
        """
        # Mock extraction - would use LLM in production
        return []

    def _extract_projects(self, cv_text: str) -> List[Dict[str, Any]]:
        """
        Extract project highlights.
        
        TODO: Implement proper parsing
        """
        # Mock extraction - would use LLM in production
        return []

    def _calculate_ats_score(
        self, cv_text: str, cv_insights: Dict[str, Any]
    ) -> Tuple[float, Dict[str, Any]]:
        """
        Calculate ATS score with component breakdown.
        
        ATS Scoring:
        - Keyword Matching (40%): Technical + soft skills coverage
        - Formatting Completeness (30%): Presence of standard sections
        - Section Presence (20%): Experience, Education, Skills, etc.
        - Job Relevance (10%): CV length and structure
        
        Returns:
            Tuple[float, Dict]: (overall_score, breakdown_details)
        """
        cv_lower = cv_text.lower()
        
        # 1. Keyword Matching Score (40%)
        skills_found = cv_insights.get("skills_extracted", [])
        total_keywords = len(self.ATS_KEYWORDS["technical_skills"]) + len(self.ATS_KEYWORDS["soft_skills"])
        keyword_score = (len(skills_found) / max(total_keywords * 0.3, 1)) * 100  # 30% of all keywords = perfect
        keyword_score = min(100, keyword_score)  # Cap at 100%
        keyword_component = (keyword_score / 100) * 40
        
        # 2. Formatting Completeness (30%)
        formatting_score = self._calculate_formatting_score(cv_text)
        formatting_component = (formatting_score / 100) * 30
        
        # 3. Section Presence (20%)
        sections_found = 0
        for section in self.ATS_KEYWORDS["sections"]:
            if section in cv_lower:
                sections_found += 1
        section_score = (sections_found / len(self.ATS_KEYWORDS["sections"])) * 100
        section_component = (section_score / 100) * 20
        
        # 4. Job Relevance (10%)
        # Based on CV length and structure quality
        word_count = len(cv_text.split())
        relevance_score = min(100, (word_count / 500) * 100)  # 500 words = good CV
        relevance_component = (relevance_score / 100) * 10
        
        # Calculate total ATS score
        total_score = keyword_component + formatting_component + section_component + relevance_component
        
        breakdown = {
            "keyword_matching": {
                "score": round(keyword_score, 1),
                "weight": 40,
                "component_value": round(keyword_component, 1),
                "details": f"Found {len(skills_found)} relevant keywords"
            },
            "formatting_completeness": {
                "score": round(formatting_score, 1),
                "weight": 30,
                "component_value": round(formatting_component, 1),
                "details": "Clear formatting and structure"
            },
            "section_presence": {
                "score": round(section_score, 1),
                "weight": 20,
                "component_value": round(section_component, 1),
                "details": f"Found {sections_found}/{len(self.ATS_KEYWORDS['sections'])} standard sections"
            },
            "job_relevance": {
                "score": round(relevance_score, 1),
                "weight": 10,
                "component_value": round(relevance_component, 1),
                "details": f"CV length: {word_count} words"
            }
        }
        
        return round(total_score, 1), breakdown

    def _calculate_formatting_score(self, cv_text: str) -> float:
        """
        Calculate formatting quality score.
        
        Factors:
        - Proper use of bullet points
        - Clean line breaks
        - No excessive formatting
        - Reasonable length
        """
        score = 100.0
        
        # Check for bullet points (good formatting)
        if "•" in cv_text or "-" in cv_text:
            score += 10
        
        # Check for line breaks (good structure)
        lines = cv_text.split("\n")
        if len(lines) > 5:
            score += 5
        
        # Penalize if too short
        if len(cv_text) < 200:
            score -= 30
        
        # Penalize if too long (> 2000 words is excessive)
        word_count = len(cv_text.split())
        if word_count > 2000:
            score -= 20
        
        return min(100, score)

    def _generate_ats_suggestions(self, ats_breakdown: Dict[str, Any]) -> List[str]:
        """
        Generate actionable suggestions to improve ATS score.
        """
        suggestions = []
        
        # Check keyword matching
        keyword_score = ats_breakdown["keyword_matching"]["score"]
        if keyword_score < 70:
            suggestions.append("Add more technical skills to CV (Python, Java, SQL, etc.)")
            suggestions.append("Include industry-specific keywords relevant to target role")
        
        # Check formatting
        formatting_score = ats_breakdown["formatting_completeness"]["score"]
        if formatting_score < 70:
            suggestions.append("Use bullet points for better formatting")
            suggestions.append("Ensure proper spacing and section breaks")
        
        # Check sections
        section_score = ats_breakdown["section_presence"]["score"]
        if section_score < 80:
            suggestions.append("Add missing sections: Experience, Education, Skills")
        
        # Check relevance
        relevance_score = ats_breakdown["job_relevance"]["score"]
        if relevance_score < 70:
            suggestions.append("Expand CV to include more details on projects and achievements")
        
        if not suggestions:
            suggestions.append("Great CV structure! Consider adding specific metrics/achievements")
        
        return suggestions
    
    def _extract_skills_with_llm(self, cv_text: str) -> List[str]:
        """
        Use LLM to extract skills from CV text.
        Falls back to regex-based extraction if LLM fails.
        """
        try:
            # Use LLM to help identify skills
            cv_snippet = cv_text[:2000]  # Limit to first 2000 chars
            llm_result = self.llm.analyze_skill_gaps(
                current_skills=[],
                target_role="Based on CV",
                required_skills=[],
            )
            
            # Extract skills from LLM response
            gap_analysis = llm_result.get("gap_analysis", [])
            if gap_analysis:
                return gap_analysis[:10]  # Return top 10 identified skills
            
            return self._extract_skills(cv_text)
        except Exception as e:
            self._log_execution(f"LLM skill extraction failed: {str(e)}, falling back to regex", level="warning")
            return self._extract_skills(cv_text)
