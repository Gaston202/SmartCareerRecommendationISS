"""
Output schemas for the AI v2 pipeline.

Defines Pydantic models for structuring agent outputs and final results.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum


class AgentType(str, Enum):
    """Enumeration of available agent types."""
    PROFILE = "profile_agent"
    CV = "cv_agent"
    CAREER = "career_agent"
    GAP = "gap_agent"
    ROADMAP = "roadmap_agent"
    EXPLANATION = "explanation_agent"  # NEXT PHASE


class CareerRecommendation(BaseModel):
    """
    Structured career recommendation with detailed information.
    
    Attributes:
        role (str): Job role title
        match_score (Optional[float]): Match score 0-1 indicating fit
        growth_trajectory (Optional[str]): Career growth path
        salary_range (Optional[str]): Expected salary range
        market_demand (Optional[str]): Market demand level (high/medium/low)
        description (Optional[str]): Additional description
    """
    role: str = Field(..., description="Job role title")
    match_score: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Match score 0-1"
    )
    growth_trajectory: Optional[str] = Field(
        default=None,
        description="Career growth path"
    )
    salary_range: Optional[str] = Field(
        default=None,
        description="Expected salary range"
    )
    market_demand: Optional[str] = Field(
        default=None,
        description="Market demand (high/medium/low)"
    )
    description: Optional[str] = Field(
        default=None,
        description="Additional description"
    )


class SkillGapItem(BaseModel):
    """
    Represents a single skill gap.
    
    Attributes:
        skill (str): Skill name
        current_level (Optional[str]): Current proficiency level
        required_level (Optional[str]): Required proficiency level
        priority (Optional[str]): Priority level (high/medium/low)
        resources (Optional[List[str]]): Learning resources
    """
    skill: str = Field(..., description="Skill name")
    current_level: Optional[str] = Field(
        default=None,
        description="Current proficiency level"
    )
    required_level: Optional[str] = Field(
        default=None,
        description="Required proficiency level"
    )
    priority: Optional[str] = Field(
        default=None,
        description="Priority (high/medium/low)"
    )
    resources: Optional[List[str]] = Field(
        default=None,
        description="Learning resources"
    )


class AgentOutput(BaseModel):
    """
    Standard output format for all agents.
    
    Attributes:
        agent_type (AgentType): Type of agent that produced this output
        success (bool): Whether the agent executed successfully
        data (Dict[str, Any]): Agent-specific output data
        error (Optional[str]): Error message if execution failed
    """
    agent_type: AgentType = Field(..., description="Type of agent")
    success: bool = Field(default=True, description="Execution status")
    data: Dict[str, Any] = Field(default_factory=dict, description="Agent output data")
    error: Optional[str] = Field(default=None, description="Error message if any")


class SkillGapAnalysis(BaseModel):
    """
    Represents skill gap analysis for a career target.
    
    Attributes:
        target_role (str): Target job role
        current_skills (List[str]): User's current skills
        required_skills (List[str]): Skills required for target role
        gap_items (List[SkillGapItem]): Detailed skill gaps
        gap_percentage (Optional[float]): Coverage percentage (0-1)
        priority_gaps (Optional[List[str]]): High-priority skills to learn
    """
    target_role: str = Field(..., description="Target career role")
    current_skills: List[str] = Field(default_factory=list, description="Current skills")
    required_skills: List[str] = Field(default_factory=list, description="Required skills")
    gap_items: List[SkillGapItem] = Field(
        default_factory=list,
        description="Detailed skill gaps"
    )
    gap_percentage: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Skill coverage percentage"
    )
    priority_gaps: Optional[List[str]] = Field(
        default=None,
        description="High-priority gaps"
    )


class RoadmapStep(BaseModel):
    """
    Represents a single step in a career roadmap.
    
    Attributes:
        phase (int): Phase number in the roadmap
        title (str): Title of this phase
        duration_months (int): Estimated duration in months
        skills_to_learn (List[str]): Skills to learn in this phase
        difficulty (Optional[str]): Difficulty level (beginner/intermediate/advanced)
        resources (Optional[List[str]]): Learning resources for this phase
        milestones (Optional[List[str]]): Key milestones to achieve
        estimated_cost (Optional[str]): Estimated cost of this phase
    """
    phase: int = Field(..., description="Phase number")
    title: str = Field(..., description="Phase title")
    duration_months: int = Field(default=3, description="Estimated duration")
    skills_to_learn: List[str] = Field(default_factory=list, description="Skills to learn")
    difficulty: Optional[str] = Field(
        default=None,
        description="Difficulty (beginner/intermediate/advanced)"
    )
    resources: Optional[List[str]] = Field(default=None, description="Learning resources")
    milestones: Optional[List[str]] = Field(default=None, description="Milestones")
    estimated_cost: Optional[str] = Field(default=None, description="Estimated cost")


class CareerRecommendationOutput(BaseModel):
    """
    Final output schema for career recommendation pipeline.
    
    Contains aggregated results from all agents in the pipeline.
    
    Attributes:
        user_id (str): User identifier
        recommended_careers (List[CareerRecommendation]): Structured career recommendations
        skill_gaps (List[SkillGapAnalysis]): Skill gap analysis for each career
        roadmap (List[RoadmapStep]): Career roadmap steps
        confidence_score (float): Overall recommendation confidence (0-1)
        agent_outputs (Dict[str, AgentOutput]): Individual agent outputs
    """
    user_id: str = Field(..., description="User identifier")
    recommended_careers: List[CareerRecommendation] = Field(
        default_factory=list,
        description="List of recommended careers with details"
    )
    skill_gaps: List[SkillGapAnalysis] = Field(
        default_factory=list,
        description="Skill gap analyses"
    )
    roadmap: List[RoadmapStep] = Field(
        default_factory=list,
        description="Career roadmap"
    )
    confidence_score: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Confidence score"
    )
    agent_outputs: Dict[str, AgentOutput] = Field(
        default_factory=dict,
        description="Individual agent outputs"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "user_123",
                "recommended_careers": [
                    {
                        "role": "Backend Engineer",
                        "match_score": 0.92,
                        "growth_trajectory": "Senior Backend Engineer → Tech Lead",
                        "salary_range": "$120K - $160K",
                        "market_demand": "high",
                    }
                ],
                "skill_gaps": [],
                "roadmap": [],
                "confidence_score": 0.85,
                "agent_outputs": {},
            }
        }
