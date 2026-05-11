"""API schemas package."""
from app.api.schemas.auth import (
    TokenValidationRequest,
    TokenValidationResponse,
    UserProfileRequest,
    UserProfileResponse,
    AuthHealthResponse,
)
from app.api.schemas.cv import (
    CvUploadResponse,
    CvAnalysisResponse,
    CvStatusResponse,
    CvHealthResponse,
)
from app.api.schemas.quiz import (
    QuizStartResponse,
    QuizAnswerResponse,
    QuizResultResponse,
    QuizHistoryResponse,
    QuizHealthResponse,
)
from app.api.schemas.career import (
    RecommendCareersRequest,
    CareerMatchResponse,
    CareerListResponse,
    CareerHealthResponse,
)

__all__ = [
    "TokenValidationRequest",
    "TokenValidationResponse",
    "UserProfileRequest",
    "UserProfileResponse",
    "AuthHealthResponse",
    "CvUploadResponse",
    "CvAnalysisResponse",
    "CvStatusResponse",
    "CvHealthResponse",
    "QuizStartResponse",
    "QuizAnswerResponse",
    "QuizResultResponse",
    "QuizHistoryResponse",
    "QuizHealthResponse",
    "RecommendCareersRequest",
    "CareerMatchResponse",
    "CareerListResponse",
    "CareerHealthResponse",
]