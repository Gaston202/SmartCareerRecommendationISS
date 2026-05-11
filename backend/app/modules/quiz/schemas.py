from pydantic import BaseModel, Field
from typing import List, Optional, Any
from datetime import datetime


class QuizQuestionOption(BaseModel):
    id: str  # 'red' | 'blue' | 'green' | 'yellow'
    label: str
    icon: str


class QuizQuestion(BaseModel):
    type: str = "question"
    question_number: int = Field(..., ge=1, le=10)
    total_questions: int = 10
    question: str
    options: List[QuizQuestionOption]


class QuizAnswer(BaseModel):
    question_number: int
    question: str
    selected_label: str
    all_options: List[str]


class QuizSession(BaseModel):
    id: str
    user_id: str
    quiz_id: str
    status: str  # 'in_progress' | 'completed'
    current_question: int
    answers: List[dict]
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class QuizResults(BaseModel):
    type: str = "results"
    careers: List[dict]
    novaProfile: dict


class StartQuizResponse(BaseModel):
    session: QuizSession
    question: QuizQuestion


class SubmitAnswerResponse(BaseModel):
    question: Optional[QuizQuestion] = None
    results: Optional[QuizResults] = None