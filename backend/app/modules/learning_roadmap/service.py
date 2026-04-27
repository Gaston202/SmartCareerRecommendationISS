import logging
from typing import List, Dict, Any, Optional
from app.core.database import DatabaseService
from app.core.ai_orchestrator import AIOrchestratorService
from app.core.cache import CacheService
from app.core.config import settings

logger = logging.getLogger(__name__)


class LearningRoadmapService:
    """
    Learning roadmap service for skill-based learning paths.
    Equivalent to NestJS LearningRoadmapService.
    """

    def __init__(
        self,
        db: DatabaseService,
        ai_orchestrator: AIOrchestratorService,
        cache_service: CacheService,
    ):
        self.db = db
        self.ai_orchestrator = ai_orchestrator
        self.cache_service = cache_service

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
            # For now, return a structured response
            # In production, this would call the AI orchestrator to generate skills
            roadmap_data = self._generate_fallback_roadmap(
                career_id,
                career_title,
                career_description,
                user_profile,
            )

            # Cache for 24 hours
            await self.cache_service.set(cache_key, roadmap_data, 86400)

            return roadmap_data
        except Exception as e:
            logger.error('Failed to generate learning roadmap', e)
            raise

    def _generate_fallback_roadmap(
        self,
        career_id: str,
        career_title: str,
        career_description: str,
        user_profile: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Generate a fallback learning roadmap structure.
        """
        return {
            'id': f'learning-roadmap-{career_id}-{hash(career_title) % 10000}',
            'user_id': '',  # Will be set by caller
            'career_id': career_id,
            'career_title': career_title,
            'title': f'Learning Path: {career_title}',
            'description': f'A comprehensive skill-based learning roadmap to become a {career_title}',
            'skills': [],
            'total_duration_hours': 0,
            'estimated_weeks': 0,
            'skill_count': 0,
            'created_at': 'now()',
        }

    async def get_skills_for_career(self, career_id: str) -> List[Dict[str, Any]]:
        """
        Get skills for a specific career.
        Equivalent to NestJS LearningRoadmapService.getSkillsForCareer.
        """
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
        """
        Get courses for a skill.
        Equivalent to NestJS LearningRoadmapService.getCoursesForSkill.
        """
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