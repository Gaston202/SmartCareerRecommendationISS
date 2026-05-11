import pytest
from fastapi.testclient import TestClient
from types import SimpleNamespace

from app.main import app
from app.core.auth import AuthService
from app.core.dependencies import get_current_user
from app.modules.learning_roadmap.router import get_learning_roadmap_service


class DummyAnonClient:
    class auth:
        @staticmethod
        async def get_user(token):
            return SimpleNamespace(
                data=SimpleNamespace(
                    user=SimpleNamespace(
                        id="user-1",
                        email="test@example.com",
                        aud="authenticated",
                        role="authenticated",
                        email_confirmed_at=None,
                        created_at="2026-04-29T00:00:00Z",
                    )
                )
            )


class DummyMissingUserAnonClient:
    class auth:
        @staticmethod
        async def get_user(token):
            return SimpleNamespace(data=SimpleNamespace(user=None))


class DummyDB:
    def __init__(self, client):
        self._client = client

    def get_anon_client(self):
        return self._client


class DummyRoadmapService:
    async def generate_learning_roadmap(
        self,
        user_id: str,
        career_id: str,
        career_title: str,
        career_description: str,
        user_profile=None,
    ):
        return {
            "mode": "learning_roadmap_v1",
            "target_role": career_title,
            "career_id": career_id,
            "confidence": 1.0,
            "weak_evidence": False,
            "steps": [
                {
                    "skill_name": "TypeScript fundamentals",
                    "why_it_matters": "Required for the target role.",
                    "difficulty": "beginner",
                    "estimated_duration_hours": 12,
                    "prerequisites": [],
                    "resource_title": "TypeScript Handbook",
                    "provider": "Microsoft",
                    "source_url": "https://www.typescriptlang.org/docs/",
                    "confidence_score": 0.95,
                    "order_index": 0,
                }
            ],
            "roadmap": {
                "id": "roadmap-1",
                "user_id": user_id,
                "career_id": career_id,
                "career_title": career_title,
                "title": f"Learning Path: {career_title}",
                "description": career_description,
                "skills": [],
                "total_duration_hours": 12,
                "estimated_weeks": 2,
                "skill_count": 1,
                "created_at": "2026-04-29T00:00:00Z",
            },
        }


@pytest.fixture
def client() -> TestClient:
    original_overrides = dict(app.dependency_overrides)
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides = original_overrides


@pytest.mark.asyncio
async def test_validate_user_from_supabase_accepts_auth_response_without_error_field():
    service = AuthService(DummyDB(DummyAnonClient()))

    user = await service.validate_user_from_supabase("fake-token")

    assert user["id"] == "user-1"
    assert user["email"] == "test@example.com"


@pytest.mark.asyncio
async def test_validate_user_from_supabase_rejects_missing_user():
    service = AuthService(DummyDB(DummyMissingUserAnonClient()))

    with pytest.raises(ValueError, match="Invalid or expired token"):
        await service.validate_user_from_supabase("fake-token")


def test_learning_roadmap_generate_accepts_authenticated_user(client: TestClient):
    app.dependency_overrides[get_current_user] = lambda: {
        "id": "user-1",
        "email": "test@example.com",
        "role": "authenticated",
    }
    app.dependency_overrides[get_learning_roadmap_service] = lambda: DummyRoadmapService()

    response = client.post(
        "/api/v1/learning-roadmap/generate",
        json={
            "career_title": "Frontend Developer",
            "career_description": "Build modern web interfaces",
            "max_steps": 6,
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["target_role"] == "Frontend Developer"
    assert data["data"]["steps"][0]["skill_name"] == "TypeScript fundamentals"
