"""
User Profile Merger Service.

Merges quiz profile and CV profile into a single unified user profile.

Rules:
- Quiz provides self-reported preferences
- CV provides observed evidence
- Both are merged with confidence levels
- Conflicts are resolved by keeping both with source attribution
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from ..utils import get_logger
from ..schemas.quiz_schemas import UserProfileSchema

logger = get_logger(__name__)


class ProfileMerger:
    """Merges quiz and CV profiles into unified profile."""

    def merge(
        self,
        quiz_profile: Optional[UserProfileSchema],
        cv_profile: Optional[UserProfileSchema],
        user_id: str,
    ) -> UserProfileSchema:
        """
        Merge quiz profile and CV profile into unified profile.
        
        Args:
            quiz_profile: Profile built from quiz answers
            cv_profile: Profile built from CV analysis
            user_id: User identifier
        
        Returns:
            Merged UserProfileSchema
        """
        try:
            logger.info(f"Merging profiles for user {user_id}")
            
            # Initialize merged profile
            merged = UserProfileSchema(
                user_id=user_id,
                last_updated=datetime.utcnow().isoformat(),
            )
            
            # If we have neither profile, return empty
            if not quiz_profile and not cv_profile:
                logger.warning(f"No profiles to merge for user {user_id}")
                return merged
            
            # If we only have one, use it as base
            if quiz_profile and not cv_profile:
                return self._add_source_evidence(quiz_profile, "quiz", user_id)
            
            if cv_profile and not quiz_profile:
                return self._add_source_evidence(cv_profile, "cv", user_id)
            
            # Merge interests: combine both, prioritize quiz (self-reported)
            merged.interests = self._merge_lists(
                quiz_profile.interests or [],
                cv_profile.inferred_interests or [],
                source_evidence_quiz=f"User self-reported interest"
            )
            merged.inferred_interests = cv_profile.inferred_interests or []
            
            # Merge hobbies: mostly from quiz
            merged.hobbies = quiz_profile.hobbies or []
            
            # Merge work preferences: combine both
            merged.work_preferences = self._merge_lists(
                quiz_profile.work_preferences or [],
                cv_profile.inferred_interests or [],
                source_evidence_quiz="User preference"
            )
            
            # Merge strengths: from both sources
            merged.strengths = self._merge_lists(
                quiz_profile.strengths or [],
                [s for s in (cv_profile.strengths or []) if s not in (quiz_profile.strengths or [])],
                source_evidence_quiz="Self-identified",
                source_evidence_cv="Inferred from CV evidence"
            )
            
            # Merge preferred problems: from quiz
            merged.preferred_problems = quiz_profile.preferred_problems or []
            
            # Merge CV skills and background
            merged.cv_skills = cv_profile.cv_skills or []
            merged.cv_projects = cv_profile.cv_projects or []
            merged.cv_background = cv_profile.cv_background
            
            # Merge inferred skills: combine all
            all_inferred = set((quiz_profile.inferred_skills or []) + 
                              (cv_profile.inferred_skills or []))
            merged.inferred_skills = list(all_inferred)
            
            # Merge dislikes: from quiz
            merged.disliked_tasks = quiz_profile.disliked_tasks or []
            
            # Build evidence trail
            merged.evidence = self._merge_evidence(
                quiz_profile.evidence or {"quiz": [], "cv": []},
                cv_profile.evidence or {"quiz": [], "cv": []},
            )
            
            # Calculate confidence
            merged.confidence = self._calculate_confidence(quiz_profile, cv_profile)
            
            logger.info(f"Successfully merged profiles for user {user_id}. "
                       f"Merged interests: {len(merged.interests)}, "
                       f"confidence: {merged.confidence:.2f}")
            
            return merged
            
        except Exception as e:
            logger.error(f"Error merging profiles: {e}", exc_info=True)
            # Return quiz profile as fallback
            return quiz_profile or UserProfileSchema(
                user_id=user_id,
                last_updated=datetime.utcnow().isoformat(),
            )

    def _merge_lists(
        self,
        quiz_list: List[str],
        cv_list: List[str],
        source_evidence_quiz: str = "quiz",
        source_evidence_cv: str = "cv",
    ) -> List[str]:
        """
        Merge two lists, deduplicating and prioritizing quiz items.
        
        Args:
            quiz_list: Items from quiz (user preferences)
            cv_list: Items from CV (observed evidence)
            source_evidence_quiz: Evidence source label for quiz items
            source_evidence_cv: Evidence source label for CV items
        
        Returns:
            Merged list with deduplication
        """
        # Normalize and combine
        combined = []
        seen = set()
        
        # Add quiz items first (higher priority)
        for item in quiz_list:
            normalized = item.lower().strip()
            if normalized not in seen:
                combined.append(item)
                seen.add(normalized)
        
        # Add CV items not already seen
        for item in cv_list:
            normalized = item.lower().strip()
            if normalized not in seen:
                combined.append(item)
                seen.add(normalized)
        
        return combined[:20]  # Cap at 20 items

    def _merge_evidence(
        self,
        quiz_evidence: Dict[str, List[str]],
        cv_evidence: Dict[str, List[str]],
    ) -> Dict[str, List[str]]:
        """Merge evidence trails from both sources."""
        merged_evidence = {"quiz": [], "cv": []}
        
        # Combine quiz evidence
        merged_evidence["quiz"] = list(set(
            (quiz_evidence.get("quiz") or []) +
            (cv_evidence.get("quiz") or [])
        ))
        
        # Combine CV evidence
        merged_evidence["cv"] = list(set(
            (quiz_evidence.get("cv") or []) +
            (cv_evidence.get("cv") or [])
        ))
        
        return merged_evidence

    def _calculate_confidence(
        self,
        quiz_profile: Optional[UserProfileSchema],
        cv_profile: Optional[UserProfileSchema],
    ) -> float:
        """
        Calculate confidence score for merged profile.
        
        Confidence is higher when:
        - Both quiz and CV exist (convergent evidence)
        - Multiple attributes align
        - Evidence trails are long
        
        Returns:
            Confidence score 0-1
        """
        confidence = 0.5  # Base confidence
        
        if not quiz_profile or not cv_profile:
            # Only one source
            return 0.6
        
        # Both sources exist - increase confidence
        confidence = 0.7
        
        # Check for alignment
        alignment = 0
        
        # Interests alignment
        quiz_interests = set(i.lower() for i in (quiz_profile.interests or []))
        cv_interests = set(i.lower() for i in (cv_profile.inferred_interests or []))
        if quiz_interests & cv_interests:
            alignment += 1
        
        # Strengths alignment
        quiz_strengths = set(s.lower() for s in (quiz_profile.strengths or []))
        cv_strengths = set(s.lower() for s in (cv_profile.strengths or []))
        if quiz_strengths & cv_strengths:
            alignment += 1
        
        # Work preferences alignment
        if (quiz_profile.work_preferences or []) and (cv_profile.inferred_interests or []):
            alignment += 0.5
        
        # Boost confidence based on alignment
        confidence += min(alignment * 0.1, 0.25)
        
        # Evidence trail quality
        total_evidence = (
            len((quiz_profile.evidence.get("quiz") or [])) +
            len((cv_profile.evidence.get("cv") or []))
        )
        if total_evidence > 5:
            confidence += 0.05
        
        return min(confidence, 1.0)

    def _add_source_evidence(
        self,
        profile: UserProfileSchema,
        source: str,  # "quiz" or "cv"
        user_id: str,
    ) -> UserProfileSchema:
        """Add source attribution to profile when only one source exists."""
        profile.user_id = user_id
        profile.last_updated = datetime.utcnow().isoformat()
        
        # Ensure evidence dict exists
        if not profile.evidence:
            profile.evidence = {"quiz": [], "cv": []}
        
        if source == "quiz":
            if not profile.evidence.get("quiz"):
                profile.evidence["quiz"] = [
                    f"User answered {len([i for i in profile.interests])} interest questions"
                ]
        elif source == "cv":
            if not profile.evidence.get("cv"):
                profile.evidence["cv"] = [
                    f"Extracted skills, projects, and experience from CV"
                ]
        
        # Adjust confidence for single source
        profile.confidence = 0.65 if source == "quiz" else 0.70
        
        return profile


def merge_profiles(
    quiz_profile: Optional[Dict[str, Any]],
    cv_profile: Optional[Dict[str, Any]],
    user_id: str,
) -> Dict[str, Any]:
    """
    Convenience function to merge two profile dictionaries.
    
    Args:
        quiz_profile: Quiz profile as dict
        cv_profile: CV profile as dict
        user_id: User identifier
    
    Returns:
        Merged profile as dict
    """
    merger = ProfileMerger()
    
    # Convert dicts to schemas
    quiz_schema = UserProfileSchema(**quiz_profile, user_id=user_id) if quiz_profile else None
    cv_schema = UserProfileSchema(**cv_profile, user_id=user_id) if cv_profile else None
    
    # Merge
    merged_schema = merger.merge(quiz_schema, cv_schema, user_id)
    
    # Convert back to dict for API response
    return merged_schema.model_dump()
