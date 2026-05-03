import logging
from typing import List

from app.core.database import DatabaseService
from app.modules.roadmap.schemas import SkillGap

logger = logging.getLogger(__name__)


class SkillGapService:
    def __init__(self, db: DatabaseService):
        self.db = db

    async def compute_gap(self, user_skills: List[str], target_role: str) -> List[SkillGap]:
        rows = await self._load_role_skills(target_role)
        known = {self.normalize_skill_name(skill) for skill in user_skills if skill}

        gaps = []
        for row in rows:
            skill_name = row.get("skill_name")
            if not skill_name:
                continue

            canonical = self.normalize_skill_name(skill_name)
            if canonical in known:
                continue

            gaps.append(
                SkillGap(
                    skill_name=skill_name,
                    canonical_name=canonical,
                    difficulty=row.get("difficulty") or self._derive_difficulty(canonical),
                    estimated_duration_hours=row.get("estimated_duration_hours") or self._default_hours(row.get("difficulty")),
                    prerequisites=row.get("prerequisites") or [],
                    priority=row.get("priority") or 0,
                    description=row.get("description"),
                )
            )

        return sorted(gaps, key=lambda gap: gap.priority)

    async def _load_role_skills(self, target_role: str) -> List[dict]:
        role_key = self.normalize_role_key(target_role)

        result = (
            await self.db.get_client()
            .from_("role_skill_map")
            .select("*")
            .eq("is_active", True)
            .or_(f"role_key.eq.{role_key},role_key.ilike.%{target_role}%")
            .order("priority", desc=True)
            .execute()
        )

        rows = result.data or []
        if rows:
            return rows

        career_result = (
            await self.db.get_client()
            .from_("careers")
            .select("title,required_skills,preferred_interests,typical_traits")
            .ilike("title", f"%{target_role}%")
            .limit(1)
            .execute()
        )
        careers = career_result.data or []
        if not careers:
            return []

        career = careers[0]
        skills = []
        for index, skill in enumerate(
            (career.get("required_skills") or [])
            + (career.get("preferred_interests") or [])
            + (career.get("typical_traits") or [])
        ):
            skills.append(
                {
                    "skill_name": skill,
                    "difficulty": self._derive_difficulty(skill),
                    "estimated_duration_hours": self._default_hours(None),
                    "prerequisites": [],
                    "priority": index + 1,
                    "description": f"{skill} is part of the {career.get('title') or target_role} skill backbone.",
                }
            )
        return skills

    def normalize_role_key(self, raw: str) -> str:
        return "-".join((raw or "").strip().lower().split())

    def normalize_skill_name(self, raw: str) -> str:
        cleaned = (raw or "").strip().lower()
        aliases = {
            "postgresql": "sql",
            "postgres": "sql",
            "mysql": "sql",
            "sqlite": "sql",
            "microsoft excel": "excel",
            "google sheets": "excel",
            "javascript": "javascript",
            "typescript": "typescript",
            "node": "node.js",
            "nodejs": "node.js",
            "node.js": "node.js",
            "powerbi": "power bi",
            "power bi": "power bi",
            "ci/cd": "ci/cd",
            "cicd": "ci/cd",
        }
        if cleaned in aliases:
            return aliases[cleaned]
        if "sql" in cleaned:
            return "sql"
        if "python" in cleaned or "pandas" in cleaned:
            return "python"
        if "excel" in cleaned or "sheet" in cleaned:
            return "excel"
        return cleaned

    def _derive_difficulty(self, skill_name: str) -> str:
        normalized = self.normalize_skill_name(skill_name)
        if any(term in normalized for term in ["architecture", "kubernetes", "distributed", "optimization"]):
            return "advanced"
        if any(term in normalized for term in ["sql", "python", "api", "database", "testing"]):
            return "intermediate"
        return "beginner"

    def _default_hours(self, difficulty: str | None) -> int:
        if difficulty == "advanced":
            return 50
        if difficulty == "intermediate":
            return 30
        return 18


async def compute_gap(
    user_skills: List[str],
    target_role: str,
    db: DatabaseService | None = None,
) -> List[SkillGap]:
    """
    Convenience module-level export for smoke tests and scripts.
    FastAPI routes should use SkillGapService through RoadmapService.
    """
    db = db or await DatabaseService.create()
    return await SkillGapService(db).compute_gap(user_skills, target_role)
