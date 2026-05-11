from datetime import datetime
import logging
import asyncio
from typing import List, Dict, Any, Optional
from app.core.database import DatabaseService
from app.core.ai_orchestrator import AIOrchestratorService
from app.core.cache import CacheService
from app.modules.career.service import CareerService

logger = logging.getLogger(__name__)

QUIZ_TOTAL_QUESTIONS = 10


class QuizService:
    """
    Quiz service for adaptive quiz and DISC profile generation.
    Equivalent to NestJS QuizService.
    """

    LABEL_TO_DISC = {
        1: {
            'I do my best work alone, focused and self-directed': 'blue',
            'I enjoy teamwork but also value some independent tasks': 'green',
            'I thrive in teams, especially when leading or competing': 'red',
            'I prefer spontaneous collaborations over structured teamwork': 'yellow',
        },
        2: {
            'A quiet, structured office with clear processes': 'blue',
            'A collaborative team space where I can support others': 'green',
            'A fast-paced, competitive setting with rapid decisions': 'red',
            'A flexible, dynamic environment with variety and experimentation': 'yellow',
        },
        3: {
            'Complex analytical problems that require research and data': 'blue',
            'People problems: conflicts, relationships, team dynamics': 'green',
            'Action problems: quick decisions, crisis management, obstacles to overcome': 'red',
            'Creative problems: designing, innovating, brainstorming new ideas': 'yellow',
        },
        4: {
            'Not important; I prefer technical or analytical work': 'blue',
            'Very important; I want to make a positive difference in people\'s lives': 'green',
            'Somewhat important; helping others should align with achieving results': 'red',
            'It depends; I enjoy inspiring or entertaining others in creative ways': 'yellow',
        },
        5: {
            'Clear instructions and well-defined processes are essential': 'blue',
            'I like some structure but also room to adapt and collaborate': 'green',
            'I want freedom to make decisions and chart my own course': 'red',
            'Give me the vision and let me innovate freely with minimal rules': 'yellow',
        },
        6: {
            'Analyzing data, writing reports, ensuring quality and accuracy': 'blue',
            'Supporting, mentoring, or caring for people in some way': 'green',
            'Leading projects, meeting targets, making strategic decisions': 'red',
            'Creating designs, developing new concepts, expressing ideas': 'yellow',
        },
        7: {
            'Steady, methodical pace with time to perfect my work': 'blue',
            'Moderate pace that allows for collaboration and relationship-building': 'green',
            'Fast-paced with quick turnarounds and high energy': 'red',
            'Variable pace; sometimes intense bursts, sometimes relaxed exploration': 'yellow',
        },
        8: {
            'Job security, stability, and clear career progression path': 'blue',
            'Positive workplace culture and strong relationships with colleagues': 'green',
            'High salary, advancement opportunities, and visible recognition': 'red',
            'Creative freedom, variety of tasks, and opportunity to experiment': 'yellow',
        },
        9: {
            'Detail-oriented experts who value precision and quality': 'blue',
            'Supportive, empathetic team players who create positive environments': 'green',
            'Ambitious, driven go-getters who push for results': 'red',
            'Creative, energetic innovators who think outside the box': 'yellow',
        },
        10: {
            'Detailed, specific feedback with clear examples and data': 'blue',
            'Encouraging, supportive feedback that considers my feelings': 'green',
            'Direct, concise feedback focused on results and improvement': 'red',
            'Brainstorming sessions where feedback flows as creative dialogue': 'yellow',
        },
    }

    def __init__(
        self,
        db: DatabaseService,
        ai_orchestrator: AIOrchestratorService,
        cache_service: CacheService,
        career_service: CareerService,
    ):
        self.db = db
        self.ai_orchestrator = ai_orchestrator
        self.cache_service = cache_service
        self.career_service = career_service
        logger.info('QuizService initialized')

    async def start_quiz(self, user_id: str) -> Dict[str, Any]:
        """Start a new quiz session."""
        try:
            insert_result = await self.db.get_client().from_('user_quiz_sessions').insert({
                'user_id': user_id,
                'quiz_id': 'career-fit-quiz',
                'status': 'in_progress',
                'current_question': 1,
                'answers': [],
            }).execute()

            if insert_result.error:
                raise insert_result.error

            session_id = insert_result.data[0]['id']
            result = await self.db.get_client().from_('user_quiz_sessions').select('*').eq('id', session_id).single().execute()

            if result.error:
                raise result.error

            session = result.data
            logger.info(f'[Quiz] Started new session {session["id"]} for user {user_id}')

            question = await self.ai_orchestrator.generate_quiz_next([], 1, [])

            cache_key = f'quiz:session:{session["id"]}'
            await self.cache_service.set(cache_key, session, 3600)

            return {
                'session': session,
                'question': question,
            }
        except Exception as e:
            logger.error(f'Failed to start quiz: {e}')
            raise ValueError('Failed to start quiz')

    async def submit_answer(
        self,
        user_id: str,
        session_id: str,
        answer: str,
        question_number: Optional[int] = None,
        submitted_question_text: Optional[str] = None,
        submitted_options: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Submit an answer and get next question or results."""
        try:
            result = await self.db.get_client().from_('user_quiz_sessions').select('*').eq('id', session_id).eq('user_id', user_id).single().execute()

            if result.error or not result.data:
                raise ValueError('Quiz session not found')

            session = result.data

            if question_number is not None and question_number != session['current_question']:
                raise ValueError('Invalid question sequence')

            q_num = question_number or session['current_question']

            previous_questions = [
                {
                    'selectedLabel': a.get('answer', ''),
                    'question': a.get('question', ''),
                }
                for a in (session.get('answers') or [])
            ]

            # Idempotency guard: skip insert if a response for this question already exists
            existing = await self.db.get_client().from_('user_quiz_responses').select('id').eq(
                'session_id', session_id).eq('question_number', q_num).limit(1).execute()
            if not (existing.data):
                await self.db.get_client().from_('user_quiz_responses').insert({
                    'session_id': session_id,
                    'question_number': q_num,
                    'question': submitted_question_text or '',
                    'selected_option': answer,
                    'all_options': submitted_options or [],
                }).execute()

            answers = (session.get('answers') or []) + [{
                'question_number': q_num,
                'answer': answer,
                'question': submitted_question_text or '',
                'options': submitted_options or [],
            }]

            next_q_num = q_num + 1

            if next_q_num > QUIZ_TOTAL_QUESTIONS:
                logger.info('[Quiz] Quiz completed. Computing Nova profile...')

                full_answers = await self._build_full_answers_array(session_id, user_id)
                disc = self._compute_disc_from_answers(full_answers)

                await self.db.get_client().from_('user_quiz_sessions').update({
                    'status': 'completed',
                    'current_question': next_q_num,
                    'answers': answers,
                    'completed_at': datetime.utcnow().isoformat(),
                }).eq('id', session_id).execute()

                # AI quiz results can take up to 90s, give generous timeout
                # Retry AI up to 2 times before falling back
                ai_results = None
                for attempt in range(2):
                    try:
                        ai_results = await asyncio.wait_for(
                            self.ai_orchestrator.generate_quiz_results(full_answers),
                            timeout=120,
                        )
                        if ai_results:
                            logger.info(f'[Quiz] AI Nova profile generated (attempt {attempt + 1})')
                            break
                    except Exception as e:
                        logger.warning(f'[Quiz] AI results generation attempt {attempt + 1} failed: {type(e).__name__}: {e!r}')
                        if attempt == 1:
                            logger.warning(f'[Quiz] All AI attempts exhausted, using deterministic fallback')
                fallback_nova = self._build_nova_profile_from_deterministic({
                    'disc': disc,
                    'skills': [],
                    'interests': [],
                })
                ai_nova = ai_results.get('novaProfile') if ai_results and isinstance(ai_results, dict) else None
                ai_disc = ai_results.get('discAnalysis') if ai_results and isinstance(ai_results, dict) else None
                nova_profile = self._ensure_complete_nova_profile(ai_nova, fallback_nova)
                # Use AI-computed DISC if available, otherwise fall back to deterministic
                final_disc = ai_disc if isinstance(ai_disc, dict) and ai_disc.get('dominant') else disc
                nova_profile = self._enforce_deterministic_disc_on_nova_profile(nova_profile, final_disc)

                logger.info('[Quiz] Generating career recommendations from Nova profile...')
                try:
                    careers = await asyncio.wait_for(
                        self._resolve_career_recommendations(user_id, session_id, nova_profile),
                        timeout=30,
                    )
                except Exception as e:
                    logger.warning(f'[Quiz] Career recommendation generation timed out/failed: {e}')
                    careers = await self._resolve_career_recommendations(user_id, session_id, fallback_nova)

                results = {
                    'type': 'results',
                    'careers': careers,
                    'novaProfile': nova_profile,
                }

                cache_key = f'quiz:results:v3:{user_id}:{session_id}'
                await self.cache_service.set(cache_key, results, 86400)

                logger.info(f'[Quiz] Completed. Returning {len(careers)} career matches.')
                return {'results': results}
            else:
                next_question = await self.ai_orchestrator.generate_quiz_next(
                    [a['answer'] for a in answers],
                    next_q_num,
                    previous_questions,
                )

                await self.db.get_client().from_('user_quiz_sessions').update({
                    'current_question': next_q_num,
                    'answers': answers,
                }).eq('id', session_id).execute()

                cache_key = f'quiz:session:{session_id}'
                updated_session = await self.db.get_client().from_('user_quiz_sessions').select('*').eq('id', session_id).single().execute()
                await self.cache_service.set(cache_key, updated_session.data, 3600)

                logger.info(f'[Quiz] Q{next_q_num}: {next_question.get("question", "")}')
                return {'question': next_question}
        except Exception as e:
            logger.error(f'Failed to submit answer: {e}')
            raise

    async def get_quiz_result(self, user_id: str, session_id: str, refresh: bool = False) -> Dict[str, Any]:
        """Get quiz results for a completed session."""
        try:
            cache_key = f'quiz:results:v3:{user_id}:{session_id}'
            cached = await self.cache_service.get(cache_key)
            if cached and not refresh:
                logger.info(
                    '[Quiz] get_quiz_result cache hit user=%s session=%s refresh=%s careers=%s has_nova=%s',
                    user_id,
                    session_id,
                    refresh,
                    len(cached.get('careers', [])) if isinstance(cached, dict) else 'n/a',
                    bool(cached.get('novaProfile')) if isinstance(cached, dict) else False,
                )
                return cached

            logger.info(
                '[Quiz] get_quiz_result cache miss user=%s session=%s refresh=%s',
                user_id,
                session_id,
                refresh,
            )

            session_result = await self.db.get_client().from_('user_quiz_sessions').select('*').eq('id', session_id).eq('user_id', user_id).eq('status', 'completed').maybe_single().execute()

            if getattr(session_result, 'error', None):
                logger.error(f'get_quiz_result session DB error: {session_result.error}')
                raise ValueError(f'Database error: {session_result.error}')

            session = getattr(session_result, 'data', None)
            logger.info(
                '[Quiz] get_quiz_result session lookup user=%s session=%s found=%s keys=%s',
                user_id,
                session_id,
                bool(session),
                list(session.keys()) if isinstance(session, dict) else None,
            )
            if not session:
                logger.warning(f'get_quiz_result: no session found for {session_id} with status completed')
                raise ValueError('Quiz results not found - please complete the quiz first')

            full_answers = []

            raw_session_answers = session.get('answers') or []
            logger.info(
                '[Quiz] get_quiz_result session answers payload session=%s answers_type=%s answers_len=%s',
                session_id,
                type(raw_session_answers).__name__,
                len(raw_session_answers) if isinstance(raw_session_answers, list) else 'n/a',
            )
            if isinstance(raw_session_answers, list) and raw_session_answers:
                full_answers = [{
                    'questionNumber': item.get('question_number') or item.get('questionNumber'),
                    'question': item.get('question', ''),
                    'selectedLabel': item.get('answer') or item.get('selectedOption') or item.get('selected_label') or '',
                    'allOptions': item.get('options') or item.get('allOptions') or [],
                } for item in raw_session_answers if isinstance(item, dict)]

            if not full_answers:
                responses_result = await self.db.get_client().from_('user_quiz_responses').select('*').eq('session_id', session_id).order('question_number').execute()
                if getattr(responses_result, 'error', None):
                    logger.error(f'get_quiz_result responses DB error: {responses_result.error}')
                    raise ValueError(f'Database error: {responses_result.error}')

                responses = getattr(responses_result, 'data', None) or []
                logger.info(
                    '[Quiz] get_quiz_result response rows fallback session=%s rows=%s',
                    session_id,
                    len(responses),
                )
                full_answers = [{
                    'questionNumber': a['question_number'],
                    'question': a.get('question', ''),
                    'selectedLabel': a['selected_option'],
                    'allOptions': a.get('all_options', []),
                } for a in responses]

            if not full_answers:
                logger.warning(f'get_quiz_result: no quiz answers found for session {session_id}')
                raise ValueError('Quiz answers not found for this session')

            logger.info(
                '[Quiz] get_quiz_result answers normalized session=%s answer_count=%s first_question=%s',
                session_id,
                len(full_answers),
                full_answers[0]['questionNumber'] if full_answers else None,
            )

            disc = self._compute_disc_from_answers(full_answers)
            logger.info(
                '[Quiz] get_quiz_result disc session=%s red=%s yellow=%s green=%s blue=%s dominant=%s',
                session_id,
                disc.get('red'),
                disc.get('yellow'),
                disc.get('green'),
                disc.get('blue'),
                disc.get('dominant'),
            )

            ai_results = None
            for attempt in range(2):
                try:
                    logger.info(
                        '[Quiz] get_quiz_result AI request start attempt=%s session=%s answer_count=%s',
                        attempt + 1,
                        session_id,
                        len(full_answers),
                    )
                    ai_results = await asyncio.wait_for(
                        self.ai_orchestrator.generate_quiz_results(full_answers),
                        timeout=120,
                    )
                    if ai_results:
                        logger.info(
                            '[Quiz] get_quiz_result AI response success attempt=%s session=%s keys=%s has_nova=%s',
                            attempt + 1,
                            session_id,
                            list(ai_results.keys()) if isinstance(ai_results, dict) else type(ai_results).__name__,
                            bool(ai_results.get('novaProfile')) if isinstance(ai_results, dict) else False,
                        )
                        break
                except Exception as e:
                    logger.warning(f'[Quiz] AI results generation attempt {attempt + 1} failed: {type(e).__name__}: {e!r}')
                    if attempt == 1:
                        logger.warning(f'[Quiz] All AI attempts exhausted, using deterministic fallback')
            fallback_user = {
                'disc': disc,
                'skills': [],
                'interests': [],
            }
            fallback_nova = self._build_nova_profile_from_deterministic(fallback_user)
            ai_nova = ai_results.get('novaProfile') if ai_results and isinstance(ai_results, dict) else None
            logger.info(
                '[Quiz] get_quiz_result AI merge session=%s ai_results_present=%s ai_nova_present=%s fallback_headline=%s',
                session_id,
                bool(ai_results),
                bool(ai_nova),
                fallback_nova.get('headline'),
            )
            ai_disc = ai_results.get('discAnalysis') if ai_results and isinstance(ai_results, dict) else None
            final_disc = ai_disc if isinstance(ai_disc, dict) and ai_disc.get('dominant') else disc
            nova_profile = self._ensure_complete_nova_profile(ai_nova, fallback_nova)
            nova_profile = self._enforce_deterministic_disc_on_nova_profile(nova_profile, final_disc)
            logger.info(
                '[Quiz] get_quiz_result nova_profile ready session=%s keys=%s behavior_keys=%s',
                session_id,
                list(nova_profile.keys()),
                list(nova_profile.get('behavior', {}).keys()) if isinstance(nova_profile.get('behavior'), dict) else None,
            )

            try:
                logger.info('[Quiz] get_quiz_result career request start session=%s', session_id)
                careers = await asyncio.wait_for(
                    self._resolve_career_recommendations(user_id, session_id, nova_profile),
                    timeout=30,
                )
                logger.info(
                    '[Quiz] get_quiz_result career request success session=%s count=%s',
                    session_id,
                    len(careers) if isinstance(careers, list) else 'n/a',
                )
            except Exception as e:
                logger.warning(f'[Quiz] Career recommendation generation timed out/failed: {e}')
                careers = await self._resolve_career_recommendations(user_id, session_id, fallback_nova)

            results = {
                'type': 'results',
                'careers': careers,
                'novaProfile': nova_profile,
            }

            logger.info(
                '[Quiz] get_quiz_result final payload session=%s careers=%s nova_headline=%s',
                session_id,
                len(careers) if isinstance(careers, list) else 'n/a',
                nova_profile.get('headline') if isinstance(nova_profile, dict) else None,
            )

            await self.cache_service.set(cache_key, results, 86400)
            return results
        except Exception as e:
            logger.error(f'Failed to get quiz results: {type(e).__name__}: {e!r}')
            raise

    async def get_quiz_history(self, user_id: str) -> List[Dict[str, Any]]:
        """Get quiz history for the user."""
        result = await self.db.get_client().from_('user_quiz_sessions').select('*').eq('user_id', user_id).eq('status', 'completed').order('completed_at', desc=True).limit(10).execute()
        return result.data or []

    async def _build_full_answers_array(self, session_id: str, user_id: str) -> List[Dict[str, Any]]:
        """Build full answers array with question numbers, labels, and all options."""
        result = await self.db.get_client().from_('user_quiz_responses').select('*').eq('session_id', session_id).order('question_number').execute()
        responses = result.data or []
        return [{
            'questionNumber': a['question_number'],
            'question': a.get('question', ''),
            'selectedLabel': a['selected_option'],
            'allOptions': a.get('all_options', []),
        } for a in responses]

    def _compute_disc_from_answers(self, answers: List[Dict[str, Any]]) -> Dict[str, int]:
        """Compute DISC percentages from quiz answers using keyword signals and mapping."""
        colors = ['red', 'blue', 'green', 'yellow']
        if not answers:
            return {
                'red': 0,
                'blue': 0,
                'green': 0,
                'yellow': 0,
                'dominant': 'blue',
            }

        raw = {c: 0 for c in colors}

        keyword_sets = {
            'red': ['lead', 'control', 'result', 'target', 'goal', 'decis', 'action', 'perform', 'accountability', 'ownership', 'drive', 'compete', 'win', 'assert', 'direct', 'fast', 'immediate', 'bottom line', 'dominant'],
            'blue': ['analy', 'evidence', 'precision', 'detail', 'quality', 'accuracy', 'logic', 'structured', 'data', 'expert', 'mastery', 'rules', 'standard', 'procedure', 'plan', 'method', 'system'],
            'green': ['support', 'collab', 'team', 'trust', 'empath', 'coach', 'harmony', 'relationship', 'encouragement', 'patient', 'listen', 'help', 'care', 'loyal', 'stable', 'consistent', 'together'],
            'yellow': ['creative', 'innov', 'idea', 'inspire', 'express', 'possibilit', 'experiment', 'variety', 'dialogue', 'vision', 'enthusiasm', 'social', 'influence', 'persuade', 'energetic', 'fun', 'spontane'],
        }

        for ans in answers:
            label = (ans.get('selectedLabel') or '').lower()
            question = (ans.get('question') or '').lower()
            combined = label + ' ' + question

            # Score each color based on keyword matches in label + question
            for color in colors:
                score = 0
                for kw in keyword_sets[color]:
                    if kw in combined:
                        score += 1
                # Weight question text less than selected label
                label_score = sum(1 for kw in keyword_sets[color] if kw in label)
                question_score = sum(0.5 for kw in keyword_sets[color] if kw in question)
                raw[color] += label_score + question_score

        total = sum(raw.values()) or 1

        # Compute raw percentages
        pct = {c: round(raw[c] / total * 100) for c in colors}

        # Ensure sum is exactly 100
        total_pct = sum(pct.values())
        if total_pct != 100:
            diff = 100 - total_pct
            dominant_color = max(raw, key=raw.get)
            pct[dominant_color] += diff

        # Guarantee a dominant >70% if clearly dominant (2x the second highest raw score)
        sorted_raw = sorted(raw.items(), key=lambda x: x[1], reverse=True)
        dominant_color = sorted_raw[0][0]
        dominant_raw = sorted_raw[0][1]
        second_raw = sorted_raw[1][1]

        if dominant_raw >= 1.5 * second_raw and pct[dominant_color] < 70:
            # Boost dominant to 70%
            others_sum_raw = sum(raw[c] for c in colors if c != dominant_color)
            if others_sum_raw > 0:
                for c in colors:
                    if c == dominant_color:
                        pct[c] = 70
                    else:
                        pct[c] = round(30 * raw[c] / others_sum_raw)
            else:
                # All others zero, set dominant to 100
                for c in colors:
                    pct[c] = 100 if c == dominant_color else 0

            # Final adjustment to ensure sum 100
            total_pct = sum(pct.values())
            if total_pct != 100:
                pct[dominant_color] += 100 - total_pct

        # If still no clear dominant, apply fallback static mapping blend
        if pct[dominant_color] < 40:
            static_scores = {c: 0 for c in colors}
            for ans in answers:
                q_num = ans.get('questionNumber')
                label = ans.get('selectedLabel', '')
                mapped = self.LABEL_TO_DISC.get(q_num, {}).get(label)
                if mapped:
                    static_scores[mapped] += 3
            static_total = sum(static_scores.values()) or 1
            static_pct = {c: round(static_scores[c] / static_total * 100) for c in colors}
            for c in colors:
                pct[c] = round(pct[c] * 0.6 + static_pct[c] * 0.4)
            # Ensure sum 100 after blend
            total_pct = sum(pct.values())
            if total_pct != 100:
                pct[dominant_color] += 100 - total_pct

        # Final guarantee: sum must be 100
        total_pct = sum(pct.values())
        if total_pct != 100:
            pct[dominant_color] += 100 - total_pct

        return {
            'red': pct.get('red', 25),
            'blue': pct.get('blue', 25),
            'green': pct.get('green', 25),
            'yellow': pct.get('yellow', 25),
            'dominant': dominant_color,
        }

    def _infer_disc_signal_scores(self, label: str) -> Dict[str, int]:
        """Infer DISC signal scores from answer label."""
        text = (label or '').lower()
        keyword_sets = {
            'red': ['lead', 'control', 'result', 'target', 'goal', 'decis', 'action', 'perform', 'accountability', 'ownership', 'drive'],
            'blue': ['analy', 'evidence', 'precision', 'detail', 'quality', 'accuracy', 'logic', 'structured', 'data', 'expert', 'mastery'],
            'green': ['support', 'collab', 'team', 'trust', 'empat', 'coach', 'harmony', 'relationship', 'encouragement'],
            'yellow': ['creative', 'innovation', 'idea', 'inspire', 'express', 'possibilit', 'experimentation', 'variety', 'dialogue', 'vision'],
        }
        scores = {'red': 0, 'blue': 0, 'green': 0, 'yellow': 0}
        for color, keywords in keyword_sets.items():
            for kw in keywords:
                if kw in text:
                    scores[color] += 1
        return scores

    def _build_nova_profile_from_deterministic(self, user_profile: Dict[str, Any]) -> Dict[str, Any]:
        """Build a simple NovaProfile-like object from deterministic data."""
        disc = user_profile.get('disc', {'red': 25, 'blue': 25, 'green': 25, 'yellow': 25, 'dominant': 'blue'})
        top_skills = (user_profile.get('skills') or [])[:5]
        top_interests = (user_profile.get('interests') or [])[:5]

        return {
            'headline': f'Your Career Profile ({self._get_primary_style_label(disc.get("dominant", "blue"))})',
            'professionalIdentity': self._infer_professional_identity(disc),
            'behavior': {
                'primaryStyle': self._get_primary_style_label(disc.get('dominant', 'blue')),
                'secondaryStyle': None,
                'traits': self._get_traits_from_dominant(disc.get('dominant', 'blue')),
                'discBlend': f"R{disc.get('red', 25)} / Y{disc.get('yellow', 25)} / G{disc.get('green', 25)} / B{disc.get('blue', 25)}",
                'discPercentages': {
                    'red': disc.get('red', 25),
                    'yellow': disc.get('yellow', 25),
                    'green': disc.get('green', 25),
                    'blue': disc.get('blue', 25),
                },
            },
            'styleComparison': {
                'naturalStyleSummary': 'Based on your preferences, you have a unique work style.',
                'adaptedStyleSummary': 'You adapt to meet deadlines and team needs.',
                'adaptationDrivers': ['Work requirements', 'Team dynamics', 'Personal growth'],
                'stressSignals': ['Overcommitting', 'Isolation when overwhelmed', 'Perfectionism'],
            },
            'motivations': {
                'topMotivators': top_interests if top_interests else ['Achievement', 'Growth', 'Recognition'],
                'demotivators': ['Micromanagement', 'Stagnation', 'Lack of impact'],
                'valuesSummary': 'You value meaningful work that leverages your strengths and aligns with your interests.',
            },
            'cognition': {
                'decisionStyle': 'Analytical and data-driven' if disc.get('blue', 0) > 40 else 'Decisive and action-oriented' if disc.get('red', 0) > 40 else 'Collaborative and consultative' if disc.get('green', 0) > 40 else 'Creative and intuitive',
                'thinkingStyle': 'Big-picture and innovative' if disc.get('yellow', 0) > 30 else 'Systematic and detailed' if disc.get('blue', 0) > 30 else 'Balanced',
                'learningStyle': 'Learning with others' if disc.get('green', 0) > 30 else 'Structured study' if disc.get('blue', 0) > 30 else 'Self-directed exploration',
                'communicationStyle': 'Empathetic and supportive' if disc.get('green', 0) > 30 else 'Direct and concise' if disc.get('red', 0) > 30 else 'Expressive and enthusiastic' if disc.get('yellow', 0) > 30 else 'Clear and thorough',
            },
            'careerProjection': {
                'bestFitEnvironments': self._infer_best_environments(disc, user_profile),
                'leadershipStyle': 'Direct and results-focused' if disc.get('red', 0) > 40 else 'Servant leadership' if disc.get('green', 0) > 40 else 'Lead by expertise' if disc.get('blue', 0) > 40 else 'Visionary and inspiring',
                'watchouts': ['Work-life balance', 'Perfectionism', 'Burnout from overcommitment'],
                'futureFocus': 'Strong trajectory toward roles that align with your skills, interests, and work style preferences.',
            },
            'recommendedDevelopmentAxes': [
                'Continue developing your core competencies',
                'Expand your professional network in your chosen field',
                'Seek mentorship from experienced professionals',
                'Balance your strengths with areas for growth',
            ],
        }

    def _enforce_deterministic_disc_on_nova_profile(self, nova_profile: Dict[str, Any], disc: Dict[str, int]) -> Dict[str, Any]:
        """Enforce deterministic DISC on Nova profile."""
        profile = nova_profile.copy() if nova_profile else {}
        behavior = profile.get('behavior', {}).copy() if isinstance(profile.get('behavior'), dict) else {}

        behavior['discPercentages'] = {
            'red': disc.get('red', 25),
            'yellow': disc.get('yellow', 25),
            'green': disc.get('green', 25),
            'blue': disc.get('blue', 25),
        }
        behavior['discBlend'] = f"R{disc.get('red', 25)} / Y{disc.get('yellow', 25)} / G{disc.get('green', 25)} / B{disc.get('blue', 25)}"
        if 'primaryStyle' not in behavior:
            behavior['primaryStyle'] = self._get_primary_style_label(disc.get('dominant', 'blue'))

        profile['behavior'] = behavior
        return profile

    def _ensure_complete_nova_profile(self, candidate: Optional[Dict[str, Any]], fallback: Dict[str, Any]) -> Dict[str, Any]:
        """
        Ensure Nova profile has the full shape expected by the mobile app.
        Prefer candidate values when present, otherwise fill from fallback.
        """
        base = fallback.copy() if isinstance(fallback, dict) else {}
        if not candidate or not isinstance(candidate, dict):
            return base

        merged = base
        for key in [
            'headline',
            'professionalIdentity',
            'behavior',
            'styleComparison',
            'motivations',
            'cognition',
            'careerProjection',
            'recommendedDevelopmentAxes',
        ]:
            val = candidate.get(key)
            if val is None:
                continue
            if isinstance(val, dict) and isinstance(merged.get(key), dict):
                merged[key] = {**merged.get(key, {}), **val}
            else:
                merged[key] = val

        # One more deep-merge for behavior so traits/disc fields are never missing
        if isinstance(candidate.get('behavior'), dict):
            merged['behavior'] = {**(base.get('behavior', {}) or {}), **candidate.get('behavior', {})}

        return merged

    def _infer_best_environments(self, disc: Dict[str, Any], user_profile: Dict[str, Any]) -> List[str]:
        """Infer best fit environments from DISC profile."""
        envs = []
        if disc.get('green', 0) > 30:
            envs.append('Collaborative team environments')
        if disc.get('blue', 0) > 30:
            envs.append('Structured and well-organized workplaces')
        if disc.get('red', 0) > 30:
            envs.append('Fast-paced, results-oriented settings')
        if disc.get('yellow', 0) > 30:
            envs.append('Flexible and innovative cultures')
        if not envs:
            envs.append('Versatile - adapt to various environments')
        return envs

    def _get_primary_style_label(self, dominant: str) -> str:
        """Get primary style label from dominant DISC color."""
        labels = {
            'red': 'Dominance (Red)',
            'blue': 'Conscientiousness (Blue)',
            'green': 'Steadiness (Green)',
            'yellow': 'Influence (Yellow)',
        }
        return labels.get(dominant, 'Balanced')

    def _get_traits_from_dominant(self, dominant: str) -> List[str]:
        """Get traits from dominant DISC color."""
        traits = {
            'red': ['Decisive', 'Results-oriented', 'Competitive'],
            'blue': ['Analytical', 'Detail-oriented', 'Systematic'],
            'green': ['Supportive', 'Collaborative', 'Patient'],
            'yellow': ['Creative', 'Enthusiastic', 'Adaptable'],
        }
        return traits.get(dominant, ['Adaptable', 'Growth-minded'])

    def _infer_professional_identity(self, disc: Dict[str, Any]) -> str:
        """Infer professional identity from DISC profile."""
        dominant = disc.get('dominant', 'blue')
        identities = {
            'red': 'Results-driven leader and strategist',
            'blue': 'Detail-oriented analyst and problem-solver',
            'green': 'Supportive team player and collaborator',
            'yellow': 'Creative innovator and visionary',
        }
        return identities.get(dominant, 'Versatile professional')

    async def _resolve_career_recommendations(
        self,
        user_id: str,
        session_id: str,
        nova_profile: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        """Resolve career recommendations."""
        try:
            matches = await self.career_service.get_career_recommendations(
                user_id, session_id, None, nova_profile
            )
            mapped = [{
                'title': m['career']['title'],
                'description': m['ai_explanation'] or m['career']['description'],
                'matchPercent': max(60, min(99, m['match_score'])),
                'tags': m['career'].get('tags', [])[:4],
            } for m in (matches or []) if m.get('career', {}).get('title')]

            if len(mapped) >= 2:
                return mapped

            db_careers = await self.career_service.get_all_careers()
            db_fallback = [{
                'title': c['title'],
                'description': c['description'],
                'matchPercent': 75 if idx == 0 else 70,
                'tags': c.get('tags', [])[:4],
            } for idx, c in enumerate(db_careers[:2])]

            if len(db_fallback) >= 2:
                return db_fallback
            if mapped:
                return mapped

            return [{
                'title': 'Business Analyst',
                'description': 'Analyze business needs, data, and processes to guide better product and operations decisions.',
                'matchPercent': 72,
                'tags': ['Analysis', 'Business', 'Problem Solving'],
            }, {
                'title': 'Project Coordinator',
                'description': 'Coordinate tasks, timelines, and communication to help teams deliver outcomes consistently.',
                'matchPercent': 69,
                'tags': ['Coordination', 'Communication', 'Execution'],
            }]
        except Exception as e:
            logger.warning(f'[Quiz] Failed to resolve career recommendations: {e}')
            return []
