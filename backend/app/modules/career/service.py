import logging
import re
import urllib.parse
from typing import List, Dict, Any, Optional, Tuple
from app.core.database import DatabaseService
from app.core.ai_orchestrator import AIOrchestratorService
from app.core.cache import CacheService
from app.core.config import settings

logger = logging.getLogger(__name__)


class CareerService:
    """
    Career service for career recommendations and matching.
    Equivalent to NestJS CareerService.
    """

    # Deterministic mapping from quiz work-style choices -> profile signals.
    COLOR_SIGNALS = {
        'blue': {
            'skills': ['Analysis', 'Problem Solving', 'Quality Assurance', 'Research', 'Planning'],
            'interests': ['Data', 'Technology', 'Process Improvement', 'Stability'],
            'traits': ['Analytical', 'Detail-oriented', 'Methodical', 'Structured'],
        },
        'green': {
            'skills': ['Communication', 'Mentoring', 'Collaboration', 'Conflict Resolution', 'Support'],
            'interests': ['People', 'Teamwork', 'Community Impact', 'Culture'],
            'traits': ['Collaborative', 'Empathetic', 'Supportive', 'Patient'],
        },
        'red': {
            'skills': ['Leadership', 'Decision Making', 'Execution', 'Strategy', 'Negotiation'],
            'interests': ['Business', 'Achievement', 'Competition', 'Growth'],
            'traits': ['Decisive', 'Results-oriented', 'Strategic', 'Ambitious'],
        },
        'yellow': {
            'skills': ['Creativity', 'Ideation', 'Storytelling', 'Experimentation', 'Adaptability'],
            'interests': ['Innovation', 'Design', 'Variety', 'Creativity'],
            'traits': ['Creative', 'Innovative', 'Flexible', 'Visionary'],
        },
    }

    COLOR_KEYWORDS = {
        'blue': ['analy', 'data', 'detail', 'quality', 'accuracy', 'structure', 'process', 'methodical'],
        'green': ['team', 'support', 'collabor', 'help', 'care', 'people', 'relationship', 'mentor'],
        'red': ['lead', 'target', 'result', 'fast', 'decision', 'strateg', 'competitive', 'recognition'],
        'yellow': ['creative', 'innovat', 'idea', 'design', 'experiment', 'variety', 'flexible', 'brainstorm'],
    }

    def __init__(
        self,
        db: DatabaseService,
        ai_orchestrator: AIOrchestratorService,
        cache_service: CacheService,
    ):
        self.db = db
        self.ai_orchestrator = ai_orchestrator
        self.cache_service = cache_service
        self.market_web_search_enabled = getattr(settings, 'market_web_search_enabled', True)
        self.market_search_ttl_seconds = 86400

    def _response_data(self, response: Any) -> Any:
        return response.data if response is not None and hasattr(response, 'data') else None

    def slugify(self, value: str) -> str:
        """Convert string to URL-safe slug."""
        import re
        value = re.sub(r'[^a-z0-9\s-]', '', value.lower())
        value = re.sub(r'\s+', '-', value.strip())
        return value[:64]

    def decode_html_entities(self, raw: str) -> str:
        """Decode HTML entities in text."""
        replacements = [
            ('&amp;', '&'), ('&quot;', '"'), ('&#39;', "'"),
            ('&lt;', '<'), ('&gt;', '>'), ('&nbsp;', ' '),
        ]
        result = raw
        for old, new in replacements:
            result = result.replace(old, new)
        result = re.sub(r'<[^>]*>', ' ', result)
        result = re.sub(r'\s+', ' ', result)
        return result.strip()

    async def fetch_duckduckgo_snippets(self, query: str) -> List[str]:
        """Fetch search result snippets from DuckDuckGo."""
        import httpx

        # Use the correct DuckDuckGo HTML search URL and ensure query doesn't have duplicate q=
        clean_query = query.strip()
        if clean_query.startswith('q='):
            clean_query = clean_query[2:]
        
        url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote_plus(clean_query)}"
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }

        try:
            async with httpx.AsyncClient(follow_redirects=True) as client:
                response = await client.get(url, headers=headers, timeout=30.0)
                response.raise_for_status()

            html = response.text
            import re
            snippets = []

            # Extract snippet text from result__snippet class
            pattern = r'<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)</a>'
            for match in re.finditer(pattern, html, re.IGNORECASE):
                text = self.decode_html_entities(match.group(1) or '')
                if text and len(text) > 24:
                    snippets.append(text)
                if len(snippets) >= 8:
                    break

            # Fallback pattern
            if len(snippets) < 3:
                pattern = r'<div[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)</div>'
                for match in re.finditer(pattern, html, re.IGNORECASE):
                    text = self.decode_html_entities(match.group(1) or '')
                    if text and len(text) > 24:
                        snippets.append(text)
                    if len(snippets) >= 8:
                        break

            return list(dict.fromkeys(snippets))[:8]
        except Exception as e:
            logger.warning(f'DuckDuckGo search failed for "{query}": {e}')
            return []

    async def collect_market_snippets(self, career: Dict[str, Any]) -> List[str]:
        """Collect market data snippets for a career using the AI orchestrator search plan."""
        queries = self.ai_orchestrator._build_market_search_plan(career)

        results = []
        for query_item in queries:
            query = query_item.get('query') if isinstance(query_item, dict) else str(query_item)
            snippets = await self.fetch_duckduckgo_snippets(query)
            results.extend(snippets)

        return list(dict.fromkeys(results))[:12]

    def map_demand_level(self, value: Optional[str]) -> str:
        """Map demand level string to standard values."""
        if value in ['low', 'medium', 'high', 'very-high']:
            return value
        return 'medium'

    async def enrich_career_with_market_data(self, career: Dict[str, Any]) -> Dict[str, Any]:
        """Enrich career data with market intelligence."""
        if not self.market_web_search_enabled:
            return career

        cache_key = f"career:market:data:{self.slugify(career['title'])}"
        cached = await self.cache_service.get(cache_key)
        if cached:
            return {**career, **cached}

        snippets = await self.collect_market_snippets(career)
        if not snippets:
            return career

        intel = await self.ai_orchestrator.extract_career_market_intel(
            career['title'], snippets, self.market_search_ttl_seconds
        )
        if not intel:
            return career

        confidence = intel.get('confidence', 0) or 0
        if confidence < 0.35:
            return career

        min_salary = intel.get('salary_min') or career.get('salary_range_min', 0)
        max_salary = intel.get('salary_max') or career.get('salary_range_max', 0)
        avg_salary = (min_salary + max_salary) // 2 if min_salary and max_salary else career.get('average_salary', 0)

        growth_rate = intel.get('growth_rate_percent') or career.get('growth_rate', 0)
        demand_level = self.map_demand_level(intel.get('demand_level'))

        snapshot = {
            'average_salary': avg_salary,
            'salary_range_min': min_salary,
            'salary_range_max': max_salary,
            'growth_rate': growth_rate,
            'demand_level': demand_level,
        }

        await self.cache_service.set(cache_key, snapshot, self.market_search_ttl_seconds)

        return {**career, **snapshot}

    async def enrich_matches_with_market_data(self, matches: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Enrich multiple career matches with market data in parallel."""
        import asyncio

        async def _enrich_one(match: Dict[str, Any]) -> Dict[str, Any]:
            try:
                enriched_career = await self.enrich_career_with_market_data(match['career'])
                return {**match, 'career': enriched_career}
            except Exception as e:
                logger.warning(f"Market enrichment failed for {match.get('career', {}).get('title')}: {e}")
                return match

        return list(await asyncio.gather(*(_enrich_one(m) for m in matches)))

    async def get_all_careers(self) -> List[Dict[str, Any]]:
        """Get all active careers from database."""
        cache_key = 'careers:all'
        cached = await self.cache_service.get(cache_key)
        if cached:
            return cached

        response = await self.db.get_client().from_('careers').select('*').eq('is_active', True).order('title').execute()

        careers = self._response_data(response) or []
        await self.cache_service.set(cache_key, careers, 3600)
        return careers

    def detect_disc_color(self, answer: str) -> str:
        """Detect DISC color from answer text."""
        lower = answer.lower()
        scores = {'red': 0, 'yellow': 0, 'green': 0, 'blue': 0}

        for color, keywords in self.COLOR_KEYWORDS.items():
            for keyword in keywords:
                if keyword in lower:
                    scores[color] += 1

        best = max(scores.items(), key=lambda x: x[1])
        return best[0] if best[1] > 0 else 'blue'

    def derive_profile_from_quiz(self, answers: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Derive DISC profile from quiz answers."""
        disc_counts = {'red': 0, 'yellow': 0, 'green': 0, 'blue': 0}
        skills, interests, traits = [], [], []

        for answer in answers:
            color = self.detect_disc_color(answer.get('selected_option', ''))
            disc_counts[color] += 1
            signals = self.COLOR_SIGNALS[color]
            skills.extend(signals['skills'])
            interests.extend(signals['interests'])
            traits.extend(signals['traits'])

        return {
            'skills': list(dict.fromkeys(skills)),
            'interests': list(dict.fromkeys(interests)),
            'traits': list(dict.fromkeys(traits)),
            'disc': disc_counts,
        }

    def find_overlap(self, user_items: List[str], target_items: List[str]) -> List[str]:
        """Find overlapping items between two lists."""
        if not user_items or not target_items:
            return []
        user_lower = [item.lower().strip() for item in user_items]
        target_lower = [item.lower().strip() for item in target_items]
        return [item for item in target_items if any(
            user_item in item.lower() or item.lower() in user_item
            for user_item in user_lower
        )]

    def score_career_deterministically(
        self,
        career: Dict[str, Any],
        user_skills: List[str],
        user_interests: List[str],
        user_traits: List[str],
    ) -> Tuple[int, List[str]]:
        """Score career match deterministically."""
        reasons = []

        skill_overlap = self.find_overlap(user_skills, career.get('required_skills', []))
        skill_score = (len(skill_overlap) / max(len(career.get('required_skills', [])), 1)) * 45
        if skill_overlap:
            reasons.append(f"Skills matched: {', '.join(skill_overlap[:3])}")

        interest_universe = career.get('preferred_interests', []) + career.get('tags', [])
        interest_overlap = self.find_overlap(user_interests, interest_universe)
        interest_score = (len(interest_overlap) / max(len(interest_universe), 1)) * 35
        if interest_overlap:
            reasons.append(f"Interests aligned: {', '.join(interest_overlap[:3])}")

        trait_overlap = self.find_overlap(user_traits, career.get('typical_traits', []))
        trait_score = (len(trait_overlap) / max(len(career.get('typical_traits', [])), 1)) * 20
        if trait_overlap:
            reasons.append(f"Traits aligned: {', '.join(trait_overlap[:3])}")

        score = min(100, round(skill_score + interest_score + trait_score))
        if not reasons:
            reasons.append('General profile alignment based on quiz preferences')

        return score, reasons

    async def enhance_matches_with_ai(
        self,
        matches: List[Dict[str, Any]],
        quiz_answers: List[str],
        cv_skills: List[str],
        disc: Dict[str, int],
    ) -> List[Dict[str, Any]]:
        """Enhance matches with AI-generated explanations."""
        enhanced = []
        nova_profile = quiz_answers if isinstance(quiz_answers, dict) else {"primary": "balanced", "secondary": "balanced"}
        
        for match in matches:
            try:
                explanation = await self.ai_orchestrator.generate_career_explanation(
                    {
                        'id': match['career']['id'],
                        'title': match['career']['title'],
                        'description': match['career']['description'],
                        'required_skills': match['career']['required_skills'],
                        'tags': match['career'].get('tags', []),
                        'match_score': match['match_score'],
                        'match_reasons': match['match_reasons'],
                    },
                    nova_profile,
                    match_score=match['match_score'],
                    match_reasons=match['match_reasons'],
                )
                enhanced.append({**match, 'ai_explanation': explanation})
            except Exception as e:
                logger.warning(f"AI explanation failed: {e}")
                enhanced.append({
                    **match,
                    'ai_explanation': f"Based on your profile, this role matches with a {match['match_score']}% fit.",
                })
        return enhanced

    async def get_career_recommendations(
        self,
        user_id: str,
        quiz_session_id: str,
        cv_analysis_id: Optional[str] = None,
        nova_profile: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Get personalized career recommendations.
        Equivalent to NestJS CareerService.getCareerRecommendations.
        """
        trace_id = f"rec:{user_id}:{quiz_session_id[:8]}"
        cache_key = f"career:matches:{user_id}:{cv_analysis_id or 'none'}:{quiz_session_id}"

        cached = await self.cache_service.get(cache_key)
        if cached:
            return cached

        # Fetch quiz answers
        response = await self.db.get_client().from_('user_quiz_responses').select('*').eq('session_id', quiz_session_id).order('question_number').execute()

        answers = self._response_data(response) or []
        if not answers:
            logger.error(f"[{trace_id}] Quiz answers not found")
            raise ValueError('Quiz answers not found')

        quiz_answers = [a['selected_option'] for a in answers]
        quiz_profile = self.derive_profile_from_quiz(answers)

        # Fetch CV analysis
        resolved_cv_analysis_id = cv_analysis_id
        if not resolved_cv_analysis_id:
            latest_cv = await self.db.get_client().from_('cv_analysis').select('id').eq('user_id', user_id).order('created_at', desc=True).limit(1).maybe_single().execute()
            latest_cv_data = self._response_data(latest_cv) or {}
            resolved_cv_analysis_id = latest_cv_data.get('id')

        cv_skills, cv_interests = [], []
        if resolved_cv_analysis_id:
            cv_data = await self.db.get_client().from_('cv_analysis').select('extracted_skills, extracted_interests').eq('id', resolved_cv_analysis_id).single().execute()
            cv_data_row = self._response_data(cv_data) or {}
            if cv_data_row:
                cv_skills = cv_data_row.get('extracted_skills', []) or []
                cv_interests = cv_data_row.get('extracted_interests', []) or []

        user_skills = list(dict.fromkeys(quiz_profile['skills'] + cv_skills))
        user_interests = list(dict.fromkeys(quiz_profile['interests'] + cv_interests))

        # Fetch user profile details
        user_profile_details = {}
        try:
            user_profile = await self.db.get_client().from_('users').select('education_level, field_of_study, career_goal, bio, skills').eq('id', user_id).maybe_single().execute()
            user_profile_data = self._response_data(user_profile) or {}
            if user_profile_data:
                user_profile_details = {
                    'educationLevel': user_profile_data.get('education_level'),
                    'fieldOfStudy': user_profile_data.get('field_of_study'),
                    'careerGoal': user_profile_data.get('career_goal'),
                    'bio': user_profile_data.get('bio'),
                    'declaredSkills': user_profile_data.get('skills', '').split(',') if user_profile_data.get('skills') else [],
                }
        except Exception as e:
            logger.warning(f"[{trace_id}] Could not load user profile: {e}")

        merged_skills = list(dict.fromkeys(user_profile_details.get('declaredSkills', []) + user_skills))

        # Get all careers and generate AI recommendations
        db_careers = await self.get_all_careers()
        ai_careers = await self.ai_orchestrator.generate_careers_from_profile({
            'quizAnswers': quiz_answers,
            'skills': user_skills,
            'interests': user_interests,
            'traits': quiz_profile['traits'],
            'disc': quiz_profile['disc'],
            'novaProfile': nova_profile,
            'candidateCareers': [{'id': c['id'], 'title': c['title'], 'description': c['description'], 'category': c.get('category'), 'required_skills': c.get('required_skills'), 'tags': c.get('tags')} for c in db_careers],
            'userProfileDetails': user_profile_details,
        })

        # Match AI careers to database careers
        by_title = {c['title'].lower().strip(): c for c in db_careers}
        matched = [by_title.get(c['title'].lower().strip()) for c in ai_careers if by_title.get(c['title'].lower().strip())]
        careers = matched if matched else db_careers

        # Deterministic scoring
        deterministic_matches = []
        for career in careers:
            score, reasons = self.score_career_deterministically(career, user_skills, user_interests, quiz_profile['traits'])
            deterministic_matches.append({
                'career': career,
                'match_score': score,
                'match_reasons': reasons,
                'ai_explanation': '',
            })

        deterministic_matches.sort(key=lambda x: x['match_score'], reverse=True)
        deterministic_matches = deterministic_matches[:5]

        # Save deterministic results
        if deterministic_matches and resolved_cv_analysis_id:
            try:
                for idx, m in enumerate(deterministic_matches):
                    try:
                        await self.db.get_client().from_('career_match_results').upsert({
                            'user_id': user_id,
                            'quiz_session_id': quiz_session_id,
                            'cv_analysis_id': resolved_cv_analysis_id,
                            'career_id': m['career']['id'],
                            'match_score': m['match_score'],
                            'match_reasons': m['match_reasons'],
                            'ai_insights': {'explanation': None, 'status': 'pending'},
                            'ranking': idx + 1,
                        }, on_conflict='user_id,cv_analysis_id,quiz_session_id,career_id').execute()
                    except Exception as insert_err:
                        logger.warning(f"[{trace_id}] Upsert failed: {insert_err}")
            except Exception as e:
                logger.warning(f"[{trace_id}] Failed to save deterministic matches: {e}")

        # AI enhancement
        enhanced_matches = await self.enhance_matches_with_ai(deterministic_matches, quiz_answers, cv_skills, quiz_profile['disc'])

        # Market enrichment
        market_enriched = await self.enrich_matches_with_market_data(enhanced_matches)

        # Save final results
        if market_enriched and resolved_cv_analysis_id:
            try:
                for idx, m in enumerate(market_enriched):
                    try:
                        await self.db.get_client().from_('career_match_results').upsert({
                            'user_id': user_id,
                            'quiz_session_id': quiz_session_id,
                            'cv_analysis_id': resolved_cv_analysis_id,
                            'career_id': m['career']['id'],
                            'match_score': m['match_score'],
                            'match_reasons': m['match_reasons'],
                            'ai_insights': {'explanation': m['ai_explanation'], 'status': 'completed'},
                            'ranking': idx + 1,
                        }, on_conflict='user_id,cv_analysis_id,quiz_session_id,career_id').execute()
                    except Exception as insert_err:
                        logger.warning(f"[{trace_id}] Upsert failed: {insert_err}")
            except Exception as e:
                logger.warning(f"[{trace_id}] Failed to save AI-enhanced matches: {e}")

        await self.cache_service.set(cache_key, market_enriched, 21600)
        return market_enriched