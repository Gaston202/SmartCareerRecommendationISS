import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture
def client() -> TestClient:
    """Create test client."""
    return TestClient(app)


def test_health_endpoint(client: TestClient):
    """Test health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "SmartCareer" in data["app"]


def test_auth_health_endpoint(client: TestClient):
    """Test auth module health."""
    response = client.get("/api/v1/auth/health")
    assert response.status_code == 200
    data = response.json()
    assert data["module"] == "auth"
    assert data["status"] == "ok"


def test_quiz_health_endpoint(client: TestClient):
    """Test quiz module health."""
    response = client.get("/api/v1/quiz/health")
    assert response.status_code == 200
    data = response.json()
    assert data["module"] == "quiz"
    assert data["status"] == "ok"


def test_career_health_endpoint(client: TestClient):
    """Test career module health."""
    response = client.get("/api/v1/career/health")
    assert response.status_code == 200
    data = response.json()
    assert data["module"] == "career"
    assert data["status"] == "ok"


def test_cv_health_endpoint(client: TestClient):
    """Test CV module health."""
    response = client.get("/api/v1/cv/health")
    assert response.status_code == 200
    data = response.json()
    assert data["module"] == "cv"
    assert data["status"] == "ok"


def test_roadmap_health_endpoint(client: TestClient):
    """Test roadmap module health."""
    response = client.get("/api/v1/roadmap/health")
    assert response.status_code == 200
    data = response.json()
    assert data["module"] == "roadmap"
    assert data["status"] == "ok"


def test_learning_roadmap_health_endpoint(client: TestClient):
    """Test learning roadmap module health."""
    response = client.get("/api/v1/learning-roadmap/health")
    assert response.status_code == 200
    data = response.json()
    assert data["module"] == "learning_roadmap"
    assert data["status"] == "ok"


def test_api_v1_prefix(client: TestClient):
    """Test that API v1 prefix works."""
    response = client.get("/api/v1/auth/health")
    assert response.status_code == 200


def test_invalid_endpoint(client: TestClient):
    """Test invalid endpoint returns 404."""
    response = client.get("/api/v1/invalid")
    assert response.status_code == 404