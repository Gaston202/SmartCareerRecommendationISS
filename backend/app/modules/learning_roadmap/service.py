from datetime import datetime
import logging
import os
import uuid
from typing import List, Dict, Any, Optional
from app.core.database import DatabaseService
from app.core.ai_orchestrator import AIOrchestratorService
from app.core.cache import CacheService
from app.core.course_search_service import CourseSearchService, get_course_search_service
from app.modules.roadmap.hybrid_service import HybridRoadmapService
from app.modules.learning_roadmap.repository import LearningRoadmapRepository


logger = logging.getLogger(__name__)


class LearningRoadmapService:
    """
    Learning roadmap service — now a thin wrapper around HybridRoadmapService.

    The hybrid pipeline:
      1. AI generates an ordered skill sequence from career context.
      2. Hybrid RAG (keyword + vector, OpenRouter text-embedding-3-small)
         retrieves stored courses and certifications.
      3. Evidence scoring picks the best primary + backup resources.
      4. If confidence is low, DuckDuckGo web search fills gaps.
      5. Returns a unified roadmap with mode=hybrid_rag_v1.
    """

    def __init__(
        self,
        db: DatabaseService,
        ai_orchestrator: AIOrchestratorService,
        cache_service: CacheService,
        course_search_service: Optional[CourseSearchService] = None,
    ):
        self.db = db
        self.ai_orchestrator = ai_orchestrator
        self.cache_service = cache_service
        self.hybrid = HybridRoadmapService(db, ai_orchestrator, cache_service)
        self.repository = LearningRoadmapRepository(db)
        self.course_search = course_search_service or get_course_search_service()
        self._enable_web_search = os.getenv("ENABLE_WEB_COURSE_SEARCH", "true").lower() == "true"

    async def generate_learning_roadmap(
        self,
        user_id: str,
        career_id: str,
        career_title: str,
        career_description: str,
        user_profile: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Generate a learning roadmap via the hybrid RAG pipeline.
        Delegates to ``HybridRoadmapService.generate_hybrid_roadmap()``.
        """
        cache_key = f'learning-roadmap:{user_id}:{career_id}'
        cached = await self.cache_service.get(cache_key)
        if cached:
            return cached

        try:
            user_skills = []
            if user_profile:
                user_skills = list(dict.fromkeys(
                    (user_profile.get("skills") or [])
                    + (user_profile.get("declared_skills") or [])
                    + (user_profile.get("cv_extracted_skills") or [])
                ))

            response = await self.hybrid.generate_hybrid_roadmap(
                user_skills=user_skills,
                target_role=career_title,
                max_steps=12,
                career_title=career_title,
                career_description=career_description,
                user_profile=user_profile,
                career_id=career_id,
            )

            # Convert PlannedRoadmapResponse to the legacy dict shape expected by callers
            payload = self._to_legacy_payload(response, user_id, career_id, career_title, career_description)

            # Cache for 24 hours
            await self.cache_service.set(cache_key, payload, 86400)
            return payload
        except Exception as e:
            logger.error(f'[LearningRoadmapService] Hybrid generation failed: {e}')
            # Fallback to the old AI-only path if hybrid fails entirely
            return await self._fallback_ai_only(
                user_id, career_id, career_title, career_description, user_profile
            )

    def _to_legacy_payload(
        self,
        response: Any,  # PlannedRoadmapResponse
        user_id: str,
        career_id: str,
        career_title: str,
        career_description: str,
    ) -> Dict[str, Any]:
        """Convert a ``PlannedRoadmapResponse`` to the legacy dict shape."""
        steps = response.steps or []
        total_duration = sum(s.estimated_duration_hours for s in steps)
        roadmap_data = {
            "id": f"learning-roadmap-{career_id}-{uuid.uuid4().hex[:8]}",
            "user_id": user_id,
            "career_id": career_id,
            "career_title": career_title,
            "title": f"Learning Path: {career_title}",
            "description": career_description or f"A comprehensive learning roadmap to become a {career_title}",
            "skills": [s.skill_name for s in steps],
            "total_duration_hours": total_duration,
            "estimated_weeks": max(1, total_duration // 8) if total_duration else 1,
            "skill_count": len(steps),
            "created_at": datetime.utcnow().isoformat(),
            "steps": [
                {
                    "skill_name": s.skill_name,
                    "why_it_matters": s.why_it_matters,
                    "difficulty": s.difficulty,
                    "estimated_duration_hours": s.estimated_duration_hours,
                    "prerequisites": s.prerequisites,
                    "resource_title": s.resource_title,
                    "provider": s.provider,
                    "source_url": s.source_url,
                    "confidence_score": s.confidence_score,
                    "order_index": s.order_index,
                    "primary_resource": s.primary_resource,
                    "backup_resources": s.backup_resources,
                    "evidence_reasons": s.evidence_reasons,
                    "certifications": s.certifications,
                }
                for s in steps
            ],
        }

        return {
            "mode": "hybrid_rag_v1",
            "target_role": response.target_role,
            "career_id": career_id,
            "confidence": response.confidence,
            "weak_evidence": response.weak_evidence,
            "message": response.message,
            "steps": roadmap_data["steps"],
            "roadmap": roadmap_data,
            "diagnostics": response.diagnostics,
            "metadata": response.metadata,
        }

    async def _fallback_ai_only(
        self,
        user_id: str,
        career_id: str,
        career_title: str,
        career_description: str,
        user_profile: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Last-resort fallback: pure AI generation + DuckDuckGo web search."""
        logger.warning("[LearningRoadmapService] Falling back to AI-only generation")
        try:
            ai_steps = await self.ai_orchestrator.generate_roadmap_steps(
                career_title=career_title,
                career_description=career_description,
                user_profile=user_profile,
            )
            if not ai_steps:
                ai_steps = [
                    {
                        "skill_name": f"Introduction to {career_title}",
                        "why_it_matters": "Build baseline understanding before tackling advanced capabilities.",
                        "difficulty": "beginner",
                        "estimated_duration_hours": 12,
                        "prerequisites": [],
                        "resource_title": None,
                        "provider": None,
                        "source_url": None,
                        "confidence_score": 0.85,
                        "order_index": 0,
                    }
                ]

            total_duration = sum(step.get("estimated_duration_hours", 0) for step in ai_steps)
            roadmap_data = {
                "id": f"learning-roadmap-{career_id}-{uuid.uuid4().hex[:8]}",
                "user_id": user_id,
                "career_id": career_id,
                "career_title": career_title,
                "title": f"Learning Path: {career_title}",
                "description": career_description or f"A comprehensive learning roadmap to become a {career_title}",
                "skills": [step["skill_name"] for step in ai_steps],
                "total_duration_hours": total_duration,
                "estimated_weeks": max(1, total_duration // 8) if total_duration else 1,
                "skill_count": len(ai_steps),
                "created_at": "now()",
                "steps": ai_steps,
            }

            steps = ai_steps.copy()
            if self._enable_web_search:
                steps = await self._enhance_steps_with_web_search(steps)

            return {
                "mode": "learning_roadmap_v1_ai_fallback",
                "target_role": career_title,
                "career_id": career_id,
                "confidence": 0.7,
                "weak_evidence": True,
                "message": "AI-generated (RAG unavailable)",
                "steps": steps,
                "roadmap": roadmap_data,
            }
        except Exception as e:
            logger.error(f'[LearningRoadmapService] AI-only fallback also failed: {e}')
            raise

    async def get_skills_for_career(self, career_id: str) -> List[Dict[str, Any]]:
        """Get skills for a specific career."""
        cache_key = f'career-skills:{career_id}'
        cached = await self.cache_service.get(cache_key)
        if cached:
            return cached

        try:
            skills = await self.repository.get_career_skills(career_id)

            enriched_skills = []
            for skill in skills:
                prereqs = await self._get_skill_prerequisites(skill['id'])
                courses = await self.get_courses_for_skill(skill['id'])
                enriched_skills.append({
                    **skill,
                    'prerequisites': [p['from_skill_id'] for p in prereqs],
                    'courses': courses[:1],
                })

            await self.cache_service.set(cache_key, enriched_skills, 86400)
            return enriched_skills
        except Exception as e:
            logger.error(f'Failed to fetch skills for career {career_id}', e)
            return []

    async def _get_skill_prerequisites(self, skill_id: str) -> List[Dict[str, str]]:
        try:
            return await self.repository.get_skill_prerequisites(skill_id)
        except Exception as e:
            logger.error(f'Failed to fetch prerequisites for skill {skill_id}', e)
            return []

    async def get_courses_for_skill(self, skill_id: str) -> List[Dict[str, Any]]:
        cache_key = f'skill-courses:{skill_id}'
        cached = await self.cache_service.get(cache_key)
        if cached:
            return cached

        try:
            courses = await self.repository.get_skill_courses(skill_id)
            await self.cache_service.set(cache_key, courses, 86400)
            return courses
        except Exception as e:
            logger.error(f'Failed to fetch courses for skill {skill_id}', e)
            return []

    async def _enhance_steps_with_web_search(self, steps: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Populate resource_title, provider, source_url via web search for all steps."""
        enhanced = []
        for step in steps:
            courses = self.course_search.search_courses(
                step.get("skill_name", ""),
                step.get("difficulty"),
            )
            if courses:
                top = courses[0]
                step["resource_title"] = top.get("title")
                step["source_url"] = top.get("url")
                step["provider"] = top.get("provider")
            enhanced.append(step)
        return enhanced

    async def save_learning_roadmap(
        self,
        user_id: str,
        career_id: str,
        career_title: str,
        roadmap_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        try:
            return await self.repository.save_user_learning_roadmap(
                user_id,
                career_id,
                career_title,
                roadmap_data,
            )
        except Exception as e:
            logger.error('Failed to save learning roadmap: %s', e)
            raise

    async def get_user_learning_roadmaps(self, user_id: str) -> List[Dict[str, Any]]:
        try:
            return await self.repository.list_user_learning_roadmaps(user_id)
        except Exception as e:
            logger.error(f'Failed to fetch roadmaps for user {user_id}', e)
            return []

    async def get_user_learning_roadmap_for_career(self, user_id: str, career_id: str) -> Optional[Dict[str, Any]]:
        try:
            return await self.repository.get_user_learning_roadmap_by_career(user_id, career_id)
        except Exception as e:
            logger.error(f'Failed to fetch roadmap for user={user_id} career={career_id}', e)
            return None

    async def update_learning_roadmap_progress(
        self,
        user_id: str,
        roadmap_id: str,
        skill_id: str,
        started: Optional[bool] = None,
        completed_percentage: Optional[int] = None,
    ) -> Dict[str, Any]:
        roadmap = await self.repository.get_user_learning_roadmap_by_id(user_id, roadmap_id)
        if not roadmap:
            raise ValueError("Roadmap not found")

        skills = roadmap.get("skills") or []
        updated = False
        for item in skills:
            skill = item.get("skill") if isinstance(item, dict) else None
            if not isinstance(skill, dict) or skill.get("id") != skill_id:
                continue

            progress = item.get("userProgress")
            if not isinstance(progress, dict):
                progress = {
                    "started": False,
                    "completedPercentage": 0,
                    "completedCourses": [],
                }

            if started is not None:
                progress["started"] = started
            if completed_percentage is not None:
                progress["completedPercentage"] = max(0, min(completed_percentage, 100))
                if progress["completedPercentage"] > 0:
                    progress["started"] = True

            item["userProgress"] = progress
            updated = True
            break

        if not updated:
            raise ValueError("Skill not found in roadmap")

        return await self.repository.update_learning_roadmap_skills(roadmap_id, skills)
