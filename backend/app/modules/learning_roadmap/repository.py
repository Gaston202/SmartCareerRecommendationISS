from typing import Any, Dict, List, Optional

from app.core.database import DatabaseService


class LearningRoadmapRepository:
	"""Data access layer for learning roadmap persistence and source datasets."""

	def __init__(self, db: DatabaseService):
		self.db = db

	async def get_career_skills(self, career_id: str) -> List[Dict[str, Any]]:
		result = await self.db.get_client().from_("learning_skills").select("*").eq("career_id", career_id).order("level").execute()
		return result.data or []

	async def get_skill_prerequisites(self, skill_id: str) -> List[Dict[str, Any]]:
		result = await self.db.get_client().from_("skill_dependencies").select("*").eq("to_skill_id", skill_id).execute()
		return result.data or []

	async def get_skill_courses(self, skill_id: str) -> List[Dict[str, Any]]:
		result = await self.db.get_client().from_("learning_courses").select("*").eq("skill_id", skill_id).order("rating", desc=True).execute()
		return result.data or []

	async def save_user_learning_roadmap(
		self,
		user_id: str,
		career_id: str,
		career_title: str,
		roadmap_data: Dict[str, Any],
	) -> Dict[str, Any]:
		payload = {
			"user_id": user_id,
			"career_id": career_id,
			"career_title": career_title,
			"title": roadmap_data.get("title", f"Learning Path: {career_title}"),
			"description": roadmap_data.get("description", f"A comprehensive skill-based learning roadmap to become a {career_title}"),
			"skills": roadmap_data.get("skills", []),
			"total_duration_hours": roadmap_data.get("total_duration_hours", 0),
			"estimated_weeks": roadmap_data.get("estimated_weeks", 0),
			"skill_count": roadmap_data.get("skill_count", 0),
		}

		result = await self.db.get_client().from_("user_learning_roadmaps").insert(payload).select().single().execute()
		if result.error:
			raise result.error
		return result.data

	async def list_user_learning_roadmaps(self, user_id: str) -> List[Dict[str, Any]]:
		result = await self.db.get_client().from_("user_learning_roadmaps").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
		return result.data or []

	async def get_user_learning_roadmap_by_career(self, user_id: str, career_id: str) -> Optional[Dict[str, Any]]:
		result = await self.db.get_client().from_("user_learning_roadmaps").select("*").eq("user_id", user_id).eq("career_id", career_id).order("created_at", desc=True).limit(1).execute()
		items = result.data or []
		return items[0] if items else None

	async def get_user_learning_roadmap_by_id(self, user_id: str, roadmap_id: str) -> Optional[Dict[str, Any]]:
		result = await self.db.get_client().from_("user_learning_roadmaps").select("*").eq("user_id", user_id).eq("id", roadmap_id).limit(1).execute()
		items = result.data or []
		return items[0] if items else None

	async def update_learning_roadmap_skills(self, roadmap_id: str, skills: List[Dict[str, Any]]) -> Dict[str, Any]:
		result = await self.db.get_client().from_("user_learning_roadmaps").update({"skills": skills}).eq("id", roadmap_id).select().single().execute()
		if result.error:
			raise result.error
		return result.data

