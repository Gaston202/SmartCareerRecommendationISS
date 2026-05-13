from datetime import datetime
import logging
import os
import uuid
from typing import List, Dict, Any, Optional
from app.core.database import DatabaseService
from app.core.ai_orchestrator import AIOrchestratorService
from app.core.cache import CacheService
from app.core.course_search_service import CourseSearchService, get_course_search_service
from app.modules.learning_roadmap.repository import LearningRoadmapRepository
from app.modules.roadmap.retrieval import RoadmapRetrievalService
from app.modules.roadmap.evidence import RoadmapEvidenceService
from app.modules.roadmap.web_search import RoadmapWebSearchService


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
        course_search_service: Optional[CourseSearchService] = None,
    ):
        self.db = db
        self.ai_orchestrator = ai_orchestrator
        self.cache_service = cache_service
        self.repository = LearningRoadmapRepository(db)

        # RAG-first resource discovery (can be disabled via env)
        self._enable_rag = os.getenv(
            "ENABLE_LEARNING_ROADMAP_RAG", "false"
        ).lower() == "true"
        self.retrieval = RoadmapRetrievalService(db)
        self.evidence = RoadmapEvidenceService(db)
        self.web_search = RoadmapWebSearchService()

        # Legacy DuckDuckGo fallback (lowest priority)
        self.course_search = course_search_service or get_course_search_service()
        self._enable_legacy_web_search = os.getenv(
            "ENABLE_LEGACY_DDG_FALLBACK", "true"
        ).lower() == "true"

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
            skills = await self.get_skills_for_career(career_id)
            if not skills:
                roadmap_data = self._generate_fallback_roadmap(
                    career_id,
                    career_title,
                    career_description,
                    user_profile,
                )
                steps = roadmap_data.get("steps", [])
            else:
                roadmap_data = self._build_roadmap_from_skills(
                    user_id,
                    career_id,
                    career_title,
                    career_description,
                    skills,
                )
                steps = self._build_steps_from_skills(skills)

            if user_profile:
                personalized = await self.ai_orchestrator.personalize_roadmap(
                    roadmap_data,
                    user_profile,
                )
                if isinstance(personalized, dict):
                    personalized_steps = personalized.get("steps")
                    if isinstance(personalized_steps, list) and personalized_steps:
                        steps = personalized_steps

            # RAG-first enhancement: curated resources → Tavily → DuckDuckGo
            steps = await self._enhance_steps_with_rag(steps)

            # Aggregate confidence
            total_confidence = sum(
                step.get("confidence_score", 0.0) for step in steps
            )
            avg_confidence = round(total_confidence / max(len(steps), 1), 2)
            weak_steps = sum(
                1 for step in steps if step.get("confidence_score", 0.0) < 0.5
            )

            payload = {
                "mode": "learning_roadmap_v1",
                "target_role": career_title,
                "career_id": career_id,
                "confidence": avg_confidence,
                "weak_evidence": weak_steps > len(steps) / 2 if steps else True,
                "steps": steps,
                "roadmap": roadmap_data,
            }

            # Cache for 24 hours
            await self.cache_service.set(cache_key, payload, 86400)

            return payload
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
            'id': f'learning-roadmap-{career_id}-{uuid.uuid4().hex[:8]}',
            'user_id': '',
            'career_id': career_id,
            'career_title': career_title,
            'title': f'Learning Path: {career_title}',
            'description': f'A comprehensive skill-based learning roadmap to become a {career_title}',
            'skills': [],
            'total_duration_hours': 0,
            'estimated_weeks': 0,
            'skill_count': 0,
            'created_at': datetime.utcnow().isoformat(),
            'steps': [
                {
                    "skill_name": f"Introduction to {career_title}",
                    "why_it_matters": "Build baseline understanding before tackling advanced capabilities.",
                    "difficulty": "beginner",
                    "estimated_duration_hours": 12,
                    "prerequisites": [],
                    "resource_title": None,
                    "provider": None,
                    "source_url": None,
                    "confidence_score": 0.45,
                    "order_index": 0,
                }
            ],
        }

    def _build_roadmap_from_skills(
        self,
        user_id: str,
        career_id: str,
        career_title: str,
        career_description: str,
        skills: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        total_duration = sum(int(skill.get("duration_hours") or 0) for skill in skills)
        return {
            "id": f"learning-roadmap-{career_id}-{uuid.uuid4().hex[:8]}",
            "user_id": user_id,
            "career_id": career_id,
            "career_title": career_title,
            "title": f"Learning Path: {career_title}",
            "description": career_description or f"A comprehensive skill-based learning roadmap to become a {career_title}",
            "skills": skills,
            "total_duration_hours": total_duration,
            "estimated_weeks": max(1, total_duration // 8) if total_duration else 1,
            "skill_count": len(skills),
            "created_at": "now()",
        }

    def _build_steps_from_skills(self, skills: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Build steps from skills — resource_title/provider/url filled by _enhance_steps_with_rag."""
        steps: List[Dict[str, Any]] = []
        for idx, skill in enumerate(skills):
            steps.append(
                {
                    "skill_name": skill.get("name") or skill.get("title") or f"Skill {idx + 1}",
                    "why_it_matters": skill.get("description") or "This skill is essential for career growth.",
                    "difficulty": (skill.get("level") or "intermediate").lower(),
                    "estimated_duration_hours": max(1, int(skill.get("duration_hours") or 8)),
                    "prerequisites": skill.get("prerequisites") or [],
                    "resource_title": None,
                    "provider": None,
                    "source_url": None,
                    "confidence_score": 0.8,
                    "order_index": idx,
                }
            )
        return steps

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
            skills = await self.repository.get_career_skills(career_id)

            # Add prerequisites
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
        """Get prerequisites for a skill."""
        try:
            return await self.repository.get_skill_prerequisites(skill_id)
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
            courses = await self.repository.get_skill_courses(skill_id)

            await self.cache_service.set(cache_key, courses, 86400)
            return courses
        except Exception as e:
            logger.error(f'Failed to fetch courses for skill {skill_id}', e)
            return []

    async def _enhance_steps_with_rag(self, steps: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Populate resource_title, provider, source_url for each step.
        Priority (when RAG enabled): 1) RAG curated resources  2) Tavily web search  3) DuckDuckGo legacy fallback
        Priority (when RAG disabled): 1) Tavily web search  2) DuckDuckGo legacy fallback
        """
        import asyncio

        enhanced = []
        for step in steps:
            skill = step.get("skill_name", "")
            if not skill:
                enhanced.append(step)
                continue

            # ---- Tier 1: RAG (curated resources) — skipped when disabled ----
            rag_confidence = 0.0
            if self._enable_rag:
                try:
                    resources = await self.retrieval.search_resources(skill, top_k=8)
                    if resources:
                        evidence = await self.evidence.score_evidence(skill, resources)
                        if evidence.confidence in ("high", "medium") and evidence.primary_resource:
                            primary = evidence.primary_resource
                            step["resource_title"] = primary.title
                            step["source_url"] = primary.source_url
                            step["provider"] = primary.provider
                            step["confidence_score"] = round(
                                max(step.get("confidence_score", 0.0), primary.score), 2
                            )
                            rag_confidence = primary.score
                            logger.info(
                                "RAG hit for skill '%s': title='%s' provider='%s' score=%.2f",
                                skill, primary.title, primary.provider, primary.score,
                            )
                        else:
                            # Medium/low confidence RAG — still keep best candidate if available
                            if evidence.primary_resource:
                                primary = evidence.primary_resource
                                step["resource_title"] = primary.title
                                step["source_url"] = primary.source_url
                                step["provider"] = primary.provider
                                step["confidence_score"] = round(
                                    max(step.get("confidence_score", 0.0), primary.score), 2
                                )
                                rag_confidence = primary.score
                except Exception as exc:
                    logger.warning("RAG retrieval failed for skill '%s': %s", skill, exc)

            # ---- Tier 2: Tavily web fallback (if RAG weak/missing or disabled) ----
            if not step.get("source_url") or rag_confidence < 0.5:
                try:
                    tavily_results = await self.web_search.fallback_search(skill)
                    if tavily_results:
                        top = tavily_results[0]
                        step["resource_title"] = top.get("title")
                        step["source_url"] = top.get("source_url")
                        step["provider"] = top.get("provider")
                        step["confidence_score"] = round(
                            max(step.get("confidence_score", 0.0), top.get("score", 0.4)), 2
                        )
                        logger.info(
                            "Tavily fallback for skill '%s': title='%s' provider='%s'",
                            skill, top.get("title"), top.get("provider"),
                        )
                except Exception as exc:
                    logger.warning("Tavily fallback failed for skill '%s': %s", skill, exc)

            # ---- Tier 3: Legacy DuckDuckGo (last resort) ----
            if self._enable_legacy_web_search and not step.get("source_url"):
                try:
                    loop = asyncio.get_running_loop()
                    ddg_results = await loop.run_in_executor(
                        None,
                        self.course_search.search_courses,
                        skill,
                        step.get("difficulty"),
                    )
                    if ddg_results:
                        top = ddg_results[0]
                        step["resource_title"] = top.get("title")
                        step["source_url"] = top.get("url")
                        step["provider"] = top.get("provider")
                        step["confidence_score"] = round(
                            max(step.get("confidence_score", 0.0), 0.35), 2
                        )
                        logger.info(
                            "DDG fallback for skill '%s': title='%s' provider='%s'",
                            skill, top.get("title"), top.get("provider"),
                        )
                except Exception as exc:
                    logger.warning("DDG fallback failed for skill '%s': %s", skill, exc)

            enhanced.append(step)
        return enhanced

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
        """
        Get all learning roadmaps for a user.
        Equivalent to NestJS LearningRoadmapService.getUserLearningRoadmaps.
        """
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