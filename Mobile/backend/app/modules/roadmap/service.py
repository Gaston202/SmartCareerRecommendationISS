import logging
import uuid
from typing import Dict, Any, List, Optional
from app.core.database import DatabaseService
from app.core.ai_orchestrator import AIOrchestratorService
from app.core.queue import QueueService
from app.core.cache import CacheService
from app.core.config import settings

logger = logging.getLogger(__name__)


class RoadmapService:
    """
    Roadmap service for career roadmap generation.
    Equivalent to NestJS RoadmapService.
    """

    def __init__(
        self,
        db: DatabaseService,
        ai_orchestrator: AIOrchestratorService,
        queue_service: QueueService,
        cache_service: CacheService,
    ):
        self.db = db
        self.ai_orchestrator = ai_orchestrator
        self.queue_service = queue_service
        self.cache_service = cache_service

    async def get_or_generate_roadmap(
        self,
        user_id: str,
        career_id: str,
        user_profile: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Get or generate a personalized roadmap.
        Equivalent to NestJS RoadmapService.getOrGenerateRoadmap.
        """
        logger.info(f'[Roadmap Legacy] getOrGenerateRoadmap user={user_id} career={career_id}')

        cache_key = f'roadmap:{user_id}:{career_id}'
        cached = await self.cache_service.get(cache_key)
        if cached:
            logger.info(f'[Roadmap Legacy] cache hit for career={career_id}')
            return cached

        try:
            # Check for base roadmap template
            result = await self.db.get_client().from_('career_roadmaps').select('*').eq('career_id', career_id).single().execute()

            if result.error or not result.data:
                raise ValueError(f'No roadmap template found for career {career_id}')

            base_roadmap = result.data
            logger.info(f'[Roadmap Legacy] loaded base roadmap template id={base_roadmap["id"]}')

            milestones = base_roadmap.get('milestones', [])

            # Personalize if user profile provided
            if user_profile:
                logger.info(f'[Roadmap Legacy] personalizing roadmap')
                personalized = await self.ai_orchestrator.personalize_roadmap(
                    base_roadmap,
                    user_profile.get('skills', []),
                    user_profile.get('novaProfile', {}),
                    user_profile.get('cvSummary', ''),
                )
                milestones = personalized.get('personalizedMilestones', milestones)

            total_duration = sum(m.get('duration_weeks', 0) for m in milestones)

            roadmap = {
                'id': base_roadmap['id'],
                'user_id': user_id,
                'career_id': career_id,
                'title': base_roadmap['title'],
                'description': base_roadmap['description'],
                'milestones': milestones,
                'total_duration_weeks': total_duration,
                'created_at': 'now()',
            }

            await self.cache_service.set(cache_key, roadmap, 43200)
            logger.info(f'[Roadmap Legacy] roadmap ready milestones={len(milestones)}')

            return roadmap
        except Exception as e:
            logger.error('Failed to get/generate roadmap', e)
            raise

    async def generate_roadmap_async(
        self,
        user_id: str,
        career_id: str,
        user_profile: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Queue async roadmap generation.
        Equivalent to NestJS RoadmapService.generateRoadmapAsync.
        """
        try:
            job = await self.queue_service.add_job(
                'roadmap-generation',
                'generate-roadmap',
                {
                    'userId': user_id,
                    'careerId': career_id,
                    'userProfile': user_profile,
                },
            )

            return {
                'jobId': job['id'],
                'message': 'Roadmap generation queued. Check job status.',
            }
        except Exception as e:
            logger.error('Failed to queue roadmap generation', e)
            raise

    async def get_roadmap_job_status(self, job_id: str) -> Dict[str, Any]:
        """
        Get roadmap generation job status.
        Equivalent to NestJS RoadmapService.getRoadmapJobStatus.
        """
        return await self.queue_service.get_job_status(job_id)

    async def personalize_roadmap(
        self,
        base_roadmap: Dict[str, Any],
        skills: List[str],
        nova_profile: Dict[str, Any],
        cv_summary: str,
    ) -> Dict[str, Any]:
        """
        Personalize roadmap using AI.
        Equivalent to NestJS AiOrchestratorService.personalizeRoadmap.
        """
        try:
            prompt = f"""Personalize this career roadmap based on the user's profile.

Base Roadmap:
{base_roadmap}

User Skills: {', '.join(skills)}
Nova Profile: {nova_profile}
CV Summary: {cv_summary}

Return personalized milestones that account for the user's current skills and goals.
Only return JSON with key "personalizedMilestones" containing the updated milestones array."""

            response = await self.ai_orchestrator.client.chat.completions.create(
                model='anthropic/claude-3-haiku-20240307',
                messages=[{'role': 'user', 'content': prompt}],
                response_format={'type': 'json_object'},
                max_tokens=1000,
                temperature=0.7,
            )

            result = json.loads(response.choices[0].message.content)
            return result
        except Exception as e:
            logger.warning(f'Roadmap personalization failed: {e}')
            return {'personalizedMilestones': base_roadmap.get('milestones', [])}

    async def generate_learning_roadmap(
        self,
        user_id: str,
        career_id: str,
        career_title: str,
        career_description: str,
        user_profile: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Generate a skill-based learning roadmap.
        Equivalent to NestJS LearningRoadmapService.generateLearningRoadmap.
        """
        cache_key = f'learning-roadmap:{user_id}:{career_id}'
        cached = await self.cache_service.get(cache_key)
        if cached:
            return cached

        try:
            # Get skills for this career
            skills = await self._get_skills_for_career(career_id)

            # Generate roadmap structure
            roadmap_data = {
                'id': f'learning-roadmap-{career_id}-{uuid.uuid4().hex[:8]}',
                'user_id': user_id,
                'career_id': career_id,
                'career_title': career_title,
                'title': f'Learning Path: {career_title}',
                'description': f'A comprehensive skill-based learning roadmap to become a {career_title}',
                'skills': skills,
                'total_duration_hours': sum(s.get('duration_hours', 0) for s in skills),
                'estimated_weeks': sum(s.get('duration_hours', 0) for s in skills) // 40,
                'skill_count': len(skills),
                'created_at': 'now()',
            }

            await self.cache_service.set(cache_key, roadmap_data, 86400)
            return roadmap_data
        except Exception as e:
            logger.error('Failed to generate learning roadmap', e)
            raise

    async def _get_skills_for_career(self, career_id: str) -> List[Dict[str, Any]]:
        """Get skills for a specific career."""
        cache_key = f'career-skills:{career_id}'
        cached = await self.cache_service.get(cache_key)
        if cached:
            return cached

        try:
            result = await self.db.get_client().from_('learning_skills').select('*').eq('career_id', career_id).order('level').execute()
            skills = result.data or []

            # Add prerequisites
            enriched_skills = []
            for skill in skills:
                prereqs = await self._get_skill_prerequisites(skill['id'])
                enriched_skills.append({
                    **skill,
                    'prerequisites': [p['from_skill_id'] for p in prereqs],
                })

            await self.cache_service.set(cache_key, enriched_skills, 86400)
            return enriched_skills
        except Exception as e:
            logger.error(f'Failed to fetch skills for career {career_id}', e)
            return []

    async def _get_skill_prerequisites(self, skill_id: str) -> List[Dict[str, str]]:
        """Get prerequisites for a skill."""
        try:
            result = await self.db.get_client().from_('skill_dependencies').select('*').eq('to_skill_id', skill_id).execute()
            return result.data or []
        except Exception as e:
            logger.error(f'Failed to fetch prerequisites for skill {skill_id}', e)
            return []

    async def get_courses_for_skill(self, skill_id: str) -> List[Dict[str, Any]]:
        """Get courses for a skill."""
        cache_key = f'skill-courses:{skill_id}'
        cached = await self.cache_service.get(cache_key)
        if cached:
            return cached

        try:
            result = await self.db.get_client().from_('learning_courses').select('*').eq('skill_id', skill_id).order('rating', desc=True).execute()
            courses = result.data or []

            await self.cache_service.set(cache_key, courses, 86400)
            return courses
        except Exception as e:
            logger.error(f'Failed to fetch courses for skill {skill_id}', e)
            return []

    async def save_learning_roadmap(
        self,
        user_id: str,
        career_id: str,
        career_title: str,
        roadmap_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Save a learning roadmap.
        Equivalent to NestJS LearningRoadmapService.saveLearningRoadmap.
        """
        try:
            result = await self.db.get_client().from_('user_learning_roadmaps').insert({
                'user_id': user_id,
                'career_id': career_id,
                'career_title': career_title,
                'title': roadmap_data.get('title', f'Learning Path: {career_title}'),
                'description': roadmap_data.get('description', f'A comprehensive skill-based learning roadmap to become a {career_title}'),
                'skills': roadmap_data.get('skills', []),
                'total_duration_hours': roadmap_data.get('total_duration_hours', 0),
                'estimated_weeks': roadmap_data.get('estimated_weeks', 0),
                'skill_count': roadmap_data.get('skill_count', 0),
            }).select().single().execute()

            if result.error:
                raise result.error

            return result.data
        except Exception as e:
            logger.error('Failed to save learning roadmap', e)
            raise

    async def get_user_learning_roadmaps(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Get all learning roadmaps for a user.
        Equivalent to NestJS LearningRoadmapService.getUserLearningRoadmaps.
        """
        try:
            result = await self.db.get_client().from_('user_learning_roadmaps').select('*').eq('user_id', user_id).order('created_at', desc=True).execute()
            return result.data or []
        except Exception as e:
            logger.error(f'Failed to fetch roadmaps for user {user_id}', e)
            return []