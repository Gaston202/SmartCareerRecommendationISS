import asyncio
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.core.database import DatabaseService
try:
    from postgrest.exceptions import APIError
except Exception:
    APIError = Exception


ROLE_SKILLS = {
    "backend_developer": [
        ("python", 1),
        ("fastapi", 1),
        ("postgresql", 2),
        ("docker", 3),
        ("redis", 3),
        ("celery", 4),
        ("system_design", 4),
        ("testing", 3),
        ("git", 2),
    ],
    "data_scientist": [
        ("python", 1),
        ("pandas", 1),
        ("numpy", 1),
        ("sql", 2),
        ("machine_learning", 2),
        ("deep_learning", 3),
        ("mlops", 4),
        ("data_visualization", 3),
        ("statistics", 2),
    ],
    "frontend_developer": [
        ("javascript", 1),
        ("typescript", 2),
        ("react", 1),
        ("css", 2),
        ("html", 1),
        ("nextjs", 3),
        ("testing", 3),
        ("performance", 4),
        ("accessibility", 4),
    ],
}


def difficulty_for(priority: int) -> str:
    if priority >= 4:
        return "advanced"
    if priority >= 2:
        return "intermediate"
    return "beginner"


def hours_for(priority: int) -> int:
    if priority >= 4:
        return 50
    if priority >= 2:
        return 30
    return 18


async def main() -> None:
    db = await DatabaseService.create()
    rows = []

    for role_key, skills in ROLE_SKILLS.items():
        for skill_name, priority in skills:
            rows.append(
                {
                    "role_key": role_key,
                    "skill_name": skill_name,
                    "difficulty": difficulty_for(priority),
                    "estimated_duration_hours": hours_for(priority),
                    "prerequisites": [],
                    "priority": priority,
                    "description": f"{skill_name} is a priority {priority} skill for {role_key}.",
                    "is_prerequisite": priority == 1,
                    "metadata": {"seeded_by": "scripts/seed_role_skills.py"},
                    "is_active": True,
                }
            )

    result = await upsert_with_schema_fallback(db, rows)

    print(f"Seeded {len(result.data or rows)} role_skill_map rows")


async def upsert_with_schema_fallback(db: DatabaseService, rows: list[dict]):
    optional_columns = ["description", "is_prerequisite", "metadata"]
    current_rows = rows

    while True:
        try:
            return (
                await db.get_client()
                .from_("role_skill_map")
                .upsert(current_rows, on_conflict="role_key,skill_name")
                .execute()
            )
        except APIError as exc:
            message = str(exc)
            missing = next((column for column in optional_columns if f"'{column}' column" in message), None)
            if not missing:
                raise

            print(f"role_skill_map is missing optional column '{missing}', retrying without it")
            optional_columns.remove(missing)
            current_rows = [
                {key: value for key, value in row.items() if key != missing}
                for row in current_rows
            ]


if __name__ == "__main__":
    asyncio.run(main())
