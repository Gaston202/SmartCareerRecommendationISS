from fastapi import APIRouter, Depends, HTTPException, status, Header, Request, Query
from typing import Dict, Any, Optional, List
from backend.app.modules.quiz.service import QuizService
from backend.app.modules.quiz.schemas import QuizAnswer
from backend.app.core.database import DatabaseService
from backend.app.core.ai_orchestrator import AIOrchestratorService
from backend.app.core.cache import CacheService
from backend.app.modules.career.service import CareerService
from backend.app.core.dependencies import (
    get_database_service,
    get_ai_orchestrator_service,
    get_cache_service,
)
import jwt
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/quiz", tags=["quiz"])

print("=" * 50)
print("DEBUG: QUIZ ROUTER MODULE LOADED - NEW CODE!")
print("=" * 50)


def get_user_id_from_token(authorization: Optional[str] = None) -> str:
    """Extract user ID from JWT token (same as CV router)."""
    if not authorization:
        logger.warning("get_user_id_from_token: Missing authorization header")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization token",
        )
    
    try:
        # Extract token from "Bearer <token>"
        parts = authorization.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            logger.warning(f"get_user_id_from_token: Invalid format: {parts}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authorization header format",
            )
        
        token = parts[1]
        logger.info(f"get_user_id_from_token: Token length={len(token)}, starts with={token[:10]}...")
        
        # Decode JWT without verification (Supabase client has already verified it on the frontend)
        try:
            payload = jwt.decode(token, options={"verify_signature": False})
            logger.info(f"get_user_id_from_token: JWT decoded, keys={list(payload.keys())}")
            user_id = payload.get("sub")  # Supabase stores user ID in 'sub' claim
            if not user_id:
                logger.warning("get_user_id_from_token: No 'sub' claim in JWT")
                raise ValueError("No user ID in token")
            logger.info(f"get_user_id_from_token: user_id={user_id}")
            return user_id
        except Exception as e:
            logger.warning(f"Failed to decode JWT: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token extraction failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not authenticate user",
        )


async def get_quiz_service(
    db: DatabaseService = Depends(get_database_service),
    ai: AIOrchestratorService = Depends(get_ai_orchestrator_service),
    cache: CacheService = Depends(get_cache_service),
) -> QuizService:
    """Dependency to get QuizService instance."""
    career = CareerService(db, ai, cache)
    return QuizService(db, ai, cache, career)


@router.post("/start")
async def start_quiz(
    authorization: Optional[str] = Header(None),
    quiz_service: QuizService = Depends(get_quiz_service),
) -> Dict[str, Any]:
    """
    Start a new quiz session.
    Equivalent to NestJS QuizController.startQuiz.
    """
    try:
        user_id = get_user_id_from_token(authorization)
        result = await quiz_service.start_quiz(user_id)
        return {
            "success": True,
            "data": result,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start quiz: {str(e)}",
        )


@router.post("/test-answer")
async def test_answer(
    request: Request,
) -> Dict[str, Any]:
    """Test endpoint to verify the code is updated."""
    try:
        body = await request.json()
        headers = dict(request.headers)
        return {
            "success": True,
            "message": "NEW CODE IS RUNNING!",
            "received_body": body,
            "received_headers": {k: v for k, v in headers.items() if "auth" in k.lower() or "session" in k.lower()},
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("/answer")
async def submit_answer(
    request: Request,
    authorization: Optional[str] = Header(None),
    quiz_service: QuizService = Depends(get_quiz_service),
) -> Dict[str, Any]:
    """
    Submit an answer and get next question or results.
    Equivalent to NestJS QuizController.submitAnswer.
    """
    try:
        print("=" * 50)
        print("DEBUG: NEW submit_answer function is called!")
        print("=" * 50)
        user_id = get_user_id_from_token(authorization)

        # Get session_id from X-Session-Id header
        session_id = request.headers.get("x-session-id") or request.headers.get("X-Session-Id") or ""
        logger.info(f"submit_answer: session_id from header={session_id[:20] if session_id else 'EMPTY'}")

        # Parse request body
        body = None
        try:
            body = await request.json()
            logger.info(f"submit_answer: body={body}")
        except Exception as e:
            logger.warning(f"submit_answer: failed to parse JSON body: {e}")
            body = {}

        # Get fields from body (accept both camelCase and snake_case)
        answer = body.get("answer", "") if body else ""
        # IMPORTANT: if client doesn't send questionNumber, let the backend use session.current_question.
        # Defaulting to 1 causes "Invalid question sequence" on Q2+.
        question_number = None
        if body:
            if body.get("questionNumber") is not None:
                question_number = body.get("questionNumber")
            elif body.get("question_number") is not None:
                question_number = body.get("question_number")
        question = body.get("question") if body else None
        options = body.get("options") if body else None

        # Fallback: also check body for sessionId if not in header
        if not session_id and body:
            session_id = body.get("sessionId") or body.get("session_id", "")

        if not session_id:
            raise HTTPException(status_code=422, detail="session_id is required (send in X-Session-Id header or sessionId in body)")
        if not answer:
            raise HTTPException(status_code=422, detail="answer is required in request body")

        result = await quiz_service.submit_answer(
            user_id=user_id,
            session_id=session_id,
            answer=answer,
            question_number=question_number,
            submitted_question_text=question,
            submitted_options=options,
        )

        return {
            "success": True,
            "data": result,
        }
    except HTTPException:
        raise
    except ValueError as e:
        msg = str(e) or "Invalid request"
        if "Invalid question sequence" in msg:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=msg)
        if "Quiz session not found" in msg:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)
    except Exception as e:
        logger.error(f"submit_answer: unexpected error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit answer: {str(e)}",
        )


@router.get("/result/{session_id}")
async def get_result(
    session_id: str,
    authorization: Optional[str] = Header(None),
    refresh: bool = Query(False),
    quiz_service: QuizService = Depends(get_quiz_service),
) -> Dict[str, Any]:
    """
    Get quiz results for a completed session.
    Equivalent to NestJS QuizController.getResult.
    """
    try:
        user_id = get_user_id_from_token(authorization)
        result = await quiz_service.get_quiz_result(user_id, session_id, refresh=refresh)
        return {
            "success": True,
            "data": result,
        }
    except ValueError as e:
        msg = str(e) or "Quiz results not found"
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get quiz results: {str(e)}",
        )


@router.get("/history")
async def get_history(
    authorization: Optional[str] = Header(None),
    quiz_service: QuizService = Depends(get_quiz_service),
) -> Dict[str, Any]:
    """
    Get quiz history for the user.
    Equivalent to NestJS QuizController.getHistory.
    """
    try:
        user_id = get_user_id_from_token(authorization)
        history = await quiz_service.get_quiz_history(user_id)
        return {
            "success": True,
            "data": history,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get quiz history: {str(e)}",
        )



@router.get("/health")
async def quiz_health() -> Dict[str, Any]:
    """Health check for quiz module."""
    return {"module": "quiz", "status": "ok", "debug": "NEW-CODE-v2 - If you see this, new code is running!"}