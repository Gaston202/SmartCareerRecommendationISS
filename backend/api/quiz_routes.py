"""
Adaptive Quiz, CV Analysis, and Profile API Endpoints.

New endpoints for:
- POST /quiz/next-question - Generate adaptive quiz question
- POST /quiz/save-answer - Save quiz answer and update profile (with upsert logic)
- POST /cv/analyze - Analyze CV with evidence extraction
- POST /profile/merge - Merge quiz + CV profiles
- GET /profile/{user_id} - Get current user profile
"""

import os
import sys
import json
from datetime import datetime
from typing import Optional, Dict, Any

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import logging

# Import services
from ai_v2.services.quiz_generator import AdaptiveQuizGenerator
from ai_v2.services.cv_analyzer import CVAnalyzer
from ai_v2.services.profile_merger import ProfileMerger
from ai_v2.services.pdf_extractor import extract_text_from_pdf_or_base64
from ai_v2.schemas.quiz_schemas import (
    QuizQuestionRequest,
    QuizQuestionResponse,
    QuizAnswerRequest,
    QuizAnswerResponse,
    CVAnalysisRequest,
    CVAnalysisResponse,
    ProfileMergeRequest,
    ProfileMergeResponse,
    UserProfileSchema,
)
from ai_v2.utils import get_logger
from services.supabase_client import get_supabase_client

logger = get_logger(__name__)

# Initialize services
quiz_generator = AdaptiveQuizGenerator()
cv_analyzer = CVAnalyzer()
profile_merger = ProfileMerger()
supabase = get_supabase_client()


def create_quiz_routes(app: FastAPI) -> None:
    """Create quiz-related endpoints."""
    
    @app.post("/quiz/next-question")
    async def get_next_quiz_question(request: QuizQuestionRequest) -> QuizQuestionResponse:
        """
        Generate next adaptive quiz question based on previous answers.
        
        This endpoint:
        1. Takes all previous answers for context
        2. Generates a contextual follow-up question
        3. Avoids repeating or semantically similar questions
        4. Adapts based on accumulated user profile
        
        Request:
        {
            "user_id": "user_123",
            "session_id": "session_abc",  # Optional but recommended
            "previous_answers": [
                {
                    "question": "...",
                    "answer": "...",
                    "inferred_interests": ["..."],
                    ...
                }
            ],
            "user_profile": { ... },
            "question_number": 1
        }
        
        Response:
        {
            "success": true,
            "data": {
                "question_number": 1,
                "question": "What makes you lose track of time?",
                "category": "interest_discovery",
                "options": [...]
            }
        }
        """
        try:
            # Log incoming request
            logger.debug(f"📥 [QUIZ] Received request from user {request.user_id}")
            logger.debug(f"   Session: {request.session_id}")
            logger.debug(f"   Question #: {request.question_number}")
            logger.debug(f"   Previous answers: {len(request.previous_answers)}")
            logger.debug(f"   User profile present: {request.user_profile is not None}")
            if request.previous_answers:
                logger.debug(f"   Previous answers detail: [{', '.join([a.answer[:30] + '...' for a in request.previous_answers[:2]])}]")
            
            logger.info(f"🔄 [QUIZ] Generating question #{request.question_number} for user {request.user_id}")
            
            # Generate next question
            previous_answers_data = [a.model_dump() for a in request.previous_answers]
            logger.debug(f"   Serialized {len(previous_answers_data)} previous answers for generator")
            
            response = quiz_generator.generate_next_question(
                previous_answers=previous_answers_data,
                current_profile=request.user_profile,
            )
            
            # Log RAW response from generator
            if response:
                logger.debug(f"🤖 [QUIZ] Raw generator response:")
                logger.debug(f"   success={response.success}")
                logger.debug(f"   data keys: {list(response.data.keys()) if response.data else 'None'}")
                if response.data:
                    logger.debug(f"   question: {response.data.get('question', '')[:70]}...")
                    logger.debug(f"   category: {response.data.get('category', 'unknown')}")
                    logger.debug(f"   options count: {len(response.data.get('options', []))}")
            
            # Log response details
            if response.success and response.data:
                logger.debug(f"✅ [QUIZ] Question generated successfully")
                logger.debug(f"   Question text: {response.data.get('question', '')[:60]}...")
                logger.debug(f"   Category: {response.data.get('category', 'unknown')}")
                logger.debug(f"   Options: {len(response.data.get('options', []))}")
                logger.info(f"📤 [QUIZ] ✓ Question #{request.question_number} ready")
            else:
                logger.warning(f"⚠️  [QUIZ] Question generation returned success=False")
                logger.debug(f"   Error: {response.error}")
            
            logger.debug(f"📤 [QUIZ] Returning response")
            return response
            
        except Exception as e:
            logger.error(f"❌ [QUIZ] Error generating quiz question: {e}", exc_info=True)
            return QuizQuestionResponse(
                success=False,
                error=f"Failed to generate question: {str(e)}"
            )
    
    @app.post("/quiz/save-answer")
    async def save_quiz_answer(request: QuizAnswerRequest) -> QuizAnswerResponse:
        """
        Save quiz answer with upsert logic to prevent duplicates.
        
        This endpoint:
        1. Saves the answer using upsert (update if exists, insert if not)
        2. Updates user profile with inferred attributes
        3. Returns current accumulated profile
        
        Request:
        {
            "user_id": "user_123",
            "session_id": "session_abc",
            "question_number": 1,
            "question": "...",
            "answer": "...",
            "reasoning": "..." (optional)
        }
        
        Response:
        {
            "success": true,
            "data": {
                "saved": true,
                "question_number": 1,
                "profile_updated": true,
                "current_profile": { ... }
            }
        }
        """
        try:
            logger.debug(f"📥 [QUIZ-SAVE] Received save answer request")
            logger.debug(f"   User: {request.user_id}")
            logger.debug(f"   Session: {request.session_id}")
            logger.debug(f"   Question #{request.question_number}")
            logger.debug(f"   Question: {request.question[:50]}...")
            logger.debug(f"   Answer: {request.answer[:50]}...")
            logger.debug(f"   Reasoning: {request.reasoning[:30] if request.reasoning else 'none'}...")
            
            logger.info(f"💾 [QUIZ-SAVE] Saving answer for question #{request.question_number}")
            
            # Save to Supabase with upsert
            # Upsert key: (session_id, question_number)
            upsert_data = {
                "session_id": request.session_id,
                "question_number": request.question_number,
                "user_id": request.user_id,
                "question": request.question,
                "answer": request.answer,
                "reasoning": request.reasoning,
                "saved_at": datetime.utcnow().isoformat(),
            }
            logger.debug(f"   Upsert data: {list(upsert_data.keys())}")
            
            # Upsert: update if exists (by session_id + question_number), else insert
            response = supabase.table("user_quiz_responses").upsert(
                upsert_data,
                on_conflict=["session_id", "question_number"],  # Composite key
            ).execute()
            
            if not response.data:
                logger.error(f"❌ [QUIZ-SAVE] Upsert returned no data")
                raise Exception("Failed to save answer in database")
            
            logger.debug(f"✅ [QUIZ-SAVE] Upserted to database")
            logger.info(f"Answer saved successfully for question #{request.question_number}")
            
            # Update user profile with inferred attributes from answer
            profile_updates = _infer_profile_from_answer(
                question=request.question,
                answer=request.answer,
            )
            
            # Fetch current profile or create new one
            profile_response = supabase.table("user_profiles").select("*").eq(
                "user_id", request.user_id
            ).order("updated_at", ascending=False).limit(1).execute()
            
            if profile_response.data:
                # Update existing profile
                existing_profile = profile_response.data[0]
                for key, value in profile_updates.items():
                    if key not in existing_profile:
                        existing_profile[key] = value
                    elif isinstance(value, list) and isinstance(existing_profile.get(key), list):
                        # Merge lists and deduplicate
                        merged_list = list(set(existing_profile[key] + value))
                        existing_profile[key] = merged_list
                    elif isinstance(value, dict) and isinstance(existing_profile.get(key), dict):
                        # Merge dicts
                        existing_profile[key].update(value)
                
                existing_profile["updated_at"] = datetime.utcnow().isoformat()
                
                profile_update_response = supabase.table("user_profiles").update(
                    existing_profile
                ).eq("user_id", request.user_id).execute()
                
                current_profile = profile_update_response.data[0] if profile_update_response.data else existing_profile
            else:
                # Create new profile
                new_profile = {
                    "user_id": request.user_id,
                    "created_at": datetime.utcnow().isoformat(),
                    "updated_at": datetime.utcnow().isoformat(),
                    **profile_updates
                }
                
                profile_create_response = supabase.table("user_profiles").insert(
                    new_profile
                ).execute()
                
                current_profile = profile_create_response.data[0] if profile_create_response.data else new_profile
            
            logger.info(f"Profile updated for user {request.user_id}")
            
            # Return success with updated profile
            return QuizAnswerResponse(
                success=True,
                data={
                    "saved": True,
                    "question_number": request.question_number,
                    "profile_updated": True,
                    "current_profile": current_profile,
                }
            )
            
        except Exception as e:
            logger.error(f"Error saving quiz answer: {e}", exc_info=True)
            
            # Check if it's a specific error type
            if "duplicate" in str(e).lower():
                # If it's truly a duplicate insert attempt, try updating instead
                try:
                    logger.info("Duplicate detected, attempting update...")
                    response = supabase.table("user_quiz_responses").update(
                        {
                            "answer": request.answer,
                            "reasoning": request.reasoning,
                            "saved_at": datetime.utcnow().isoformat(),
                        }
                    ).eq("session_id", request.session_id).eq(
                        "question_number", request.question_number
                    ).execute()
                    
                    return QuizAnswerResponse(
                        success=True,
                        data={
                            "saved": True,
                            "question_number": request.question_number,
                            "updated": True,
                        }
                    )
                except Exception as update_error:
                    logger.error(f"Update failed: {update_error}")
            
            return QuizAnswerResponse(
                success=False,
                error=f"Failed to save answer: {str(e)}"
            )


def create_cv_routes(app: FastAPI) -> None:
    """Create CV analysis endpoints."""
    
    @app.post("/cv/analyze")
    async def analyze_cv(request: CVAnalysisRequest) -> CVAnalysisResponse:
        """
        Analyze CV with evidence extraction and improvements.
        
        This endpoint:
        1. Extracts text from PDF (if pdf_base64 provided) or uses plain text
        2. Extracts skills, projects, experience from CV text
        3. Generates specific improvements with examples
        4. Infers interests and strengths from CV
        5. Merges with quiz profile if provided
        
        Request:
        {
            "user_id": "user_123",
            "cv_text": "..." (plain text CV)
            "pdf_base64": "..." (base64-encoded PDF - preferred)
            "current_profile": { ... } (optional)
        }
        
        Response:
        {
            "success": true,
            "data": {
                "summary": "...",
                "strengths": [...],
                "improvements": [
                    {
                        "issue": "...",
                        "evidence_from_cv": "...",
                        "why_it_matters": "...",
                        "improved_example": "..."
                    }
                ],
                "extracted_evidence": {
                    "skills": [...],
                    "projects": [...],
                    "experience": [...],
                    "education": [...]
                },
                "profile_updates": { ... }
            }
        }
        """
        try:
            # Log incoming request
            logger.debug(f"📥 [CV] Received request from user {request.user_id}")
            logger.debug(f"   PDF provided: {bool(request.pdf_base64 and request.pdf_base64.strip())}")
            logger.debug(f"   Text provided: {bool(request.cv_text and request.cv_text.strip())}")
            if request.pdf_base64:
                logger.debug(f"   PDF size: {len(request.pdf_base64)} chars")
            if request.cv_text:
                logger.debug(f"   Text size: {len(request.cv_text)} chars")
            logger.debug(f"   Current profile present: {request.current_profile is not None}")
            
            # Determine input type
            has_pdf = bool(request.pdf_base64 and request.pdf_base64.strip())
            has_text = bool(request.cv_text and request.cv_text.strip())
            
            if not has_pdf and not has_text:
                logger.error(f"❌ [CV] No CV content provided for user {request.user_id}")
                return CVAnalysisResponse(
                    success=False,
                    error="Either pdf_base64 or cv_text must be provided"
                )
            
            # Extract text from PDF or use plain text
            cv_text = ""
            source_type = ""
            
            if has_pdf:
                logger.info(f"🔄 [CV] Extracting text from PDF for user {request.user_id}")
                logger.debug(f"   PDF size: {len(request.pdf_base64)} chars")
                cv_text, source_type = extract_text_from_pdf_or_base64(request.pdf_base64)
                logger.debug(f"   PDF extraction result: source_type={source_type}, text_len={len(cv_text)}")
                
                if not cv_text:
                    logger.error(f"❌ [CV] Failed to extract text from PDF (source_type={source_type})")
                    return CVAnalysisResponse(
                        success=False,
                        error=f"Could not extract text from PDF. Possible issues: (1) Image-based PDF (2) Corrupted PDF (3) PyMuPDF not installed. Please provide plain text CV instead."
                    )
            else:
                logger.info(f"🔄 [CV] Processing text CV for user {request.user_id}")
                logger.debug(f"   Text size: {len(request.cv_text)} chars")
                cv_text = request.cv_text
                source_type = "text"
            
            logger.debug(f"✅ [CV] Text extracted ({source_type}): {len(cv_text)} chars")
            logger.debug(f"   First 100 chars: {cv_text[:100]}...")
            
            # ✅ Explicit empty check AFTER extraction
            if not cv_text or not cv_text.strip():
                logger.warning(f"⚠️  [CV] cv_text is empty after extraction (source={source_type})")
                return CVAnalysisResponse(
                    success=False,
                    error=f"Could not extract any text from CV (source: {source_type}). Please check the file format."
                )
            
            # Analyze CV
            logger.info(f"🔄 [CV] Starting CV analysis (source: {source_type})")
            response = cv_analyzer.analyze(
                cv_text=cv_text,
                current_profile=request.current_profile,
            )
            
            # Log analysis results
            if response.success and response.data:
                # ✅ Skills are nested under extracted_evidence - CORRECT MAPPING
                skills = response.data.get('extracted_evidence', {}).get('skills', [])
                projects = response.data.get('extracted_evidence', {}).get('projects', [])
                profile_updates = response.data.get('profile_updates', {}) or {}
                interests = profile_updates.get('interests', [])
                strengths = response.data.get('strengths', [])
                improvements = response.data.get('improvements', [])
                summary = response.data.get('summary', '')
                
                logger.debug(f"✅ [CV] Analysis complete")
                logger.debug(f"   Skills extracted: {len(skills)}")
                if skills:
                    logger.debug(f"     - {', '.join(skills[:5])}{'...' if len(skills) > 5 else ''}")
                logger.debug(f"   Strengths identified: {len(strengths)}")
                if strengths:
                    logger.debug(f"     - {', '.join(strengths[:3])}{'...' if len(strengths) > 3 else ''}")
                logger.debug(f"   Improvement suggestions: {len(improvements)}")
                logger.debug(f"   Summary: {summary[:80]}...")
                logger.info(f"✅ [CV] Analysis successful: {len(skills)} skills, {len(strengths)} strengths")
                
                # Transform for mobile app compatibility
                # Mobile expects: ats_score, careers (count), skills (count) at top level
                if response.data:
                    response.data["ats_score"] = 70  # Default ATS score (no real parser)
                    response.data["careers"] = 0  # Will be filled by career matching endpoint
                    response.data["skills"] = len(skills)  # Number of extracted skills
                    response.data["extracted_skills"] = skills
                    response.data["extracted_interests"] = interests
                    response.data["career_suggestions"] = []
                    response.data["ats_issues"] = [
                        {
                            "type": "info",
                            "severity": "info",
                            "description": summary,
                        }
                    ] if summary else []
                    response.data["ats_suggestions"] = [
                        {
                            "section": "projects" if projects else "cv",
                            "suggestion": imp.get("issue", ""),
                            "example": imp.get("improved_example"),
                        }
                        for imp in improvements
                        if isinstance(imp, dict) and imp.get("issue")
                    ]
            else:
                logger.warning(f"⚠️  [CV] Analysis returned success=False")
                logger.debug(f"   Error: {response.error}")
            
            # Add extraction source to the response data
            if response.success and response.data:
                response.data["extraction_source"] = source_type
                logger.debug(f"   Added extraction_source: {source_type}")
            
            return response
            
        except Exception as e:
            logger.error(f"Error analyzing CV: {e}", exc_info=True)
            return CVAnalysisResponse(
                success=False,
                error=f"Failed to analyze CV: {str(e)}"
            )
    
    # Alias for mobile app compatibility - mobile calls /analyze-cv
    @app.post("/analyze-cv")
    async def analyze_cv_alias(request: CVAnalysisRequest) -> CVAnalysisResponse:
        """
        Alias for /cv/analyze endpoint to support mobile app.
        Mobile SDK calls POST /analyze-cv, so we provide this alias.
        
        Accepts either:
        - pdf_base64: Base64 encoded PDF (preferred for Claude document vision)
        - cv_text: Plain text CV content (fallback)
        """
        return await analyze_cv(request)


def create_profile_routes(app: FastAPI) -> None:
    """Create profile merging endpoints."""
    
    @app.post("/profile/merge")
    async def merge_profiles(request: ProfileMergeRequest) -> ProfileMergeResponse:
        """
        Merge quiz profile and CV profile into unified profile.
        
        This endpoint:
        1. Takes both profiles as input
        2. Resolves conflicts intelligently  
        3. Returns merged profile with confidence score
        4. Provides recommendations based on merged data
        
        Request:
        {
            "user_id": "user_123",
            "quiz_profile": { ... },
            "cv_profile": { ... }
        }
        
        Response:
        {
            "success": true,
            "data": {
                "profile": { ... },
                "confidence": 0.85,
                "recommendations": [...]
            }
        }
        """
        try:
            logger.info(f"Merging profiles for user {request.user_id}")
            
            # Merge profiles
            merged = profile_merger.merge(
                quiz_profile=request.quiz_profile,
                cv_profile=request.cv_profile,
                user_id=request.user_id,
            )
            
            # Generate recommendations based on merged profile
            recommendations = _get_recommendations_from_profile(merged)
            
            return ProfileMergeResponse(
                success=True,
                data={
                    "profile": merged.model_dump(),
                    "confidence": merged.confidence,
                    "recommendations": recommendations,
                }
            )
            
        except Exception as e:
            logger.error(f"Error merging profiles: {e}", exc_info=True)
            return ProfileMergeResponse(
                success=False,
                error=f"Failed to merge profiles: {str(e)}"
            )
    
    @app.get("/profile/{user_id}")
    async def get_user_profile(user_id: str) -> Dict[str, Any]:
        """
        Retrieve current user profile from database.
        
        Returns the latest merged profile for the user.
        """
        try:
            logger.info(f"Retrieving profile for user {user_id}")
            
            # Query Supabase for latest profile
            response = supabase.table("user_profiles").select("*").eq(
                "user_id", user_id
            ).order("updated_at", ascending=False).limit(1).execute()
            
            if not response.data:
                return {
                    "success": False,
                    "error": "Profile not found",
                    "data": None,
                }
            
            profile_data = response.data[0]
            
            return {
                "success": True,
                "data": profile_data,
            }
            
        except Exception as e:
            logger.error(f"Error retrieving profile: {e}", exc_info=True)
            return {
                "success": False,
                "error": f"Failed to retrieve profile: {str(e)}",
                "data": None,
            }


def _get_recommendations_from_profile(profile: UserProfileSchema) -> list:
    """Generate top-level recommendations from merged profile."""
    recommendations = []
    
    # Recommend careers based on interests + strengths
    if profile.interests and profile.strengths:
        interests_str = ", ".join(profile.interests[:3])
        strengths_str = ", ".join(profile.strengths[:2])
        recommendations.append(
            f"Your interest in {interests_str} combined with your {strengths_str} "
            f"suggests roles in these areas"
        )
    
    # Recommend learning paths based on skills gap
    if profile.cv_skills and profile.inferred_skills:
        gap = set(profile.inferred_skills) - set(profile.cv_skills)
        if gap:
            recommendations.append(
                f"Consider developing skills in: {', '.join(list(gap)[:3])}"
            )
    
    # Recommend work environment based on preferences
    if profile.work_preferences:
        prefs = ", ".join(profile.work_preferences[:3])
        recommendations.append(f"Seek roles that offer {prefs}")
    
    return recommendations


def _infer_profile_from_answer(question: str, answer: str) -> Dict[str, Any]:
    """
    Infer profile attributes from a quiz Q&A pair using both keyword matching and LLM.
    
    This function:
    1. Uses keyword matching for quick, reliable inferences
    2. Optionally uses LLM for deeper semantic understanding
    3. Combines evidence from the Q&A into profile attributes
    
    Args:
        question: The quiz question text
        answer: The user's answer
    
    Returns:
        Dict with inferred profile attributes to update
    """
    profile_updates = {
        "interests": [],
        "strengths": [],
        "work_preferences": [],
        "disliked_tasks": [],
        "hobbies": [],
        "inferred_skills": [],
        "quiz_evidence": [],
    }
    
    question_lower = question.lower()
    answer_lower = answer.lower()
    
    # Infer interests from answers about activities, free time, etc.
    if any(phrase in question_lower for phrase in ["activity", "enjoy", "free time", "lose track", "accomplish", "interested"]):
        interest_keywords = {
            "building": ["building", "creating", "developing", "engineering", "constructing", "making"],
            "problem-solving": ["solving", "logical", "problem", "debugging", "analyzing", "troubleshooting"],
            "design": ["design", "creative", "art", "visual", "interface", "ux", "aesthetic"],
            "data": ["data", "analysis", "analytics", "insights", "statistics", "pattern"],
            "people-focused": ["helping", "people", "teaching", "mentoring", "support", "coaching"],
            "organization": ["organizing", "management", "process", "planning", "organize", "structure"],
            "communication": ["communication", "speaking", "writing", "presenting", "expression"],
            "learning": ["learning", "education", "research", "study", "knowledge"],
            "leadership": ["leading", "management", "strategy", "direction", "team"],
        }
        
        for interest, keywords in interest_keywords.items():
            if any(kw in answer_lower for kw in keywords):
                profile_updates["interests"].append(interest)
    
    # Infer hobbies and projects from free time answers
    if "free time" in question_lower or "hobby" in question_lower or "personal" in question_lower:
        hobby_keywords = {
            "projects": ["project", "build", "create", "develop", "coding"],
            "learning": ["learn", "skill", "technology", "knowledge"],
            "creative": ["creative", "art", "design", "music", "write"],
            "sports": ["sport", "exercise", "fitness", "athletic"],
            "social": ["social", "friends", "community", "group"],
        }
        
        for hobby, keywords in hobby_keywords.items():
            if any(kw in answer_lower for kw in keywords):
                profile_updates["hobbies"].append(hobby)
    
    # Infer work preferences from environment questions
    if "prefer" in question_lower and ("work" in question_lower or "environment" in question_lower or "setting" in question_lower):
        pref_keywords = {
            "collaborative": ["team", "collaborate", "together", "group", "sync", "meeting"],
            "independent": ["independent", "solo", "autonomous", "alone", "autonomy"],
            "structured": ["structured", "process", "rules", "clear", "organized", "order"],
            "flexible": ["flexible", "autonomy", "freedom", "experiment", "creativity"],
            "client-facing": ["client", "customer", "external", "direct", "user"],
            "remote": ["remote", "work from home", "distributed"],
        }
        
        for pref, keywords in pref_keywords.items():
            if any(kw in answer_lower for kw in keywords):
                profile_updates["work_preferences"].append(pref)
    
    # Infer disliked tasks from questions about dislikes
    if any(phrase in question_lower for phrase in ["unappealing", "dealbreaker", "dislike", "least", "avoid", "not"]):
        dislike_keywords = {
            "repetitive-work": ["repetitive", "routine", "boring", "monotonous", "same"],
            "high-pressure": ["pressure", "deadline", "stress", "urgent", "rush"],
            "travel": ["travel", "travel-heavy", "commute", "on-the-road"],
            "politics": ["politics", "office dynamics", "politics", "favoritism"],
            "compliance": ["regulation", "compliance", "bureaucracy", "red tape", "legal"],
            "sales-focused": ["sales", "selling", "pitching", "commission"],
            "routine": ["routine", "repetitive", "predictable"],
        }
        
        for dislike, keywords in dislike_keywords.items():
            if any(kw in answer_lower for kw in keywords):
                profile_updates["disliked_tasks"].append(dislike)
    
    # Infer strengths from answers about skills and abilities
    if any(phrase in question_lower for phrase in ["strength", "best at", "good at", "pride", "proud", "excel"]):
        strength_keywords = {
            "problem-solving": ["solving", "logical", "analytical", "breaking down", "logic"],
            "communication": ["communication", "express", "articulate", "explain", "clarity"],
            "leadership": ["lead", "manage", "direct", "organize", "guide"],
            "creativity": ["creative", "innovation", "novel", "outside the box"],
            "technical-skills": ["technical", "coding", "programming", "technology", "engineering"],
            "teamwork": ["collaborate", "team", "together", "cooperative"],
            "adaptability": ["adapt", "flexible", "quick learner", "versatile"],
            "attention-to-detail": ["detail", "organized", "precise", "meticulous"],
        }
        
        for strength, keywords in strength_keywords.items():
            if any(kw in answer_lower for kw in keywords):
                profile_updates["strengths"].append(strength)
    
    # Extract implied skills for certain keywords
    if any(word in answer_lower for word in ["coding", "programming", "python", "javascript", "react", "sql"]):
        profile_updates["inferred_skills"].extend(["technical", "coding", "software"])
    
    if any(word in answer_lower for word in ["design", "ui", "ux", "visual", "design", "creative"]):
        profile_updates["inferred_skills"].extend(["design", "creative", "visual"])
    
    if any(word in answer_lower for word in ["management", "lead", "leadership", "team", "people"]):
        profile_updates["inferred_skills"].extend(["leadership", "management", "communication"])
    
    # Add this Q&A as evidence
    profile_updates["quiz_evidence"].append({
        "question": question,
        "answer": answer,
        "timestamp": datetime.utcnow().isoformat(),
    })
    
    # Remove empty lists and duplicates
    cleaned_updates = {}
    for k, v in profile_updates.items():
        if isinstance(v, list):
            # Remove duplicates while preserving order
            unique_list = list(dict.fromkeys(v))
            if unique_list:
                cleaned_updates[k] = unique_list
        elif v:
            cleaned_updates[k] = v
    
    return cleaned_updates
