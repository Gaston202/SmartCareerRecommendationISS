"""Quiz endpoints - API controller for quiz operations."""
from fastapi import APIRouter, HTTPException, status, Header, Request
from typing import Optional
import logging
from app.api.schemas.quiz import (
    QuizStartResponse,
    QuizAnswerResponse,
    QuizResultResponse,
    QuizHistoryResponse,
    QuizHealthResponse,
)
from app.api.deps import get_quiz_service, get_user_id_from_token

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/quiz", tags=["quiz"])


@router.post("/start")
async def start_quiz(
    authorization: Optional[str] = Header(None),
):
    """Start a new quiz session."""
    try:
        user_id = await get_user_id_from_token(authorization)
        quiz_service = await get_quiz_service()
        result = await quiz_service.start_quiz(user_id)
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to start quiz",
        )


@router.post("/answer")
async def submit_answer(
    request: Request,
    authorization: Optional[str] = Header(None),
):
    """Submit an answer and get next question or results."""
    try:
        user_id = await get_user_id_from_token(authorization)
        quiz_service = await get_quiz_service()

        session_id = request.headers.get("x-session-id") or ""
        try:
            body = await request.json()
        except Exception:
            body = {}

        if not session_id:
            session_id = body.get("sessionId") or body.get("session_id", "")

        answer = body.get("answer", "")
        question_number = body.get("questionNumber") or body.get("question_number")
        question = body.get("question")
        options = body.get("options")

        if not session_id:
            raise HTTPException(status_code=422, detail="session_id is required")
        if not answer:
            raise HTTPException(status_code=422, detail="answer is required")

        result = await quiz_service.submit_answer(
            user_id=user_id,
            session_id=session_id,
            answer=answer,
            question_number=question_number,
            submitted_question_text=question,
            submitted_options=options,
        )

        return {"success": True, "data": result}
    except HTTPException:
        raise
    except ValueError as e:
        msg = str(e)
        if "Invalid question sequence" in msg:
            raise HTTPException(status_code=409, detail=msg)
        if "Quiz session not found" in msg:
            raise HTTPException(status_code=404, detail=msg)
        raise HTTPException(status_code=400, detail=msg)
    except Exception as e:
        logger.error(f"submit_answer failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to submit answer",
        )


@router.get("/result/{session_id}")
async def get_result(
    session_id: str,
    authorization: Optional[str] = Header(None),
):
    """Get quiz results for a completed session."""
    try:
        user_id = await get_user_id_from_token(authorization)
        quiz_service = await get_quiz_service()
        result = await quiz_service.get_quiz_result(user_id, session_id)
        return {"success": True, "data": result}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get quiz results",
        )


@router.get("/history")
async def get_history(
    authorization: Optional[str] = Header(None),
):
    """Get quiz history for the user."""
    try:
        user_id = await get_user_id_from_token(authorization)
        quiz_service = await get_quiz_service()
        history = await quiz_service.get_quiz_history(user_id)
        return {"success": True, "data": history}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get quiz history",
        )


@router.get("/health", response_model=QuizHealthResponse)
async def quiz_health() -> QuizHealthResponse:
    """Health check for quiz module."""
    return QuizHealthResponse()