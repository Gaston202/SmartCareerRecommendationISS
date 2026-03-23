"""
Main pipeline entry point for AI v2 module.

Provides high-level API for using the career recommendation system.
"""

from typing import Optional, Dict, Any
from .schemas import (
    UserProfile,
    CareerRecommendationInput,
    CareerRecommendationOutput,
)
from .orchestrator import PipelineOrchestrator
from .config import config
from .utils import get_logger

logger = get_logger(__name__)


class CareerRecommendationPipeline:
    """
    High-level API for career recommendation pipeline.
    
    This is the main entry point for external systems (FastAPI, CLI, etc.).
    
    Usage:
        >>> pipeline = CareerRecommendationPipeline()
        >>> user_profile = UserProfile(...)
        >>> result = pipeline.recommend(
        ...     user_profile=user_profile,
        ...     cv_text="...",
        ... )
        >>> print(result.recommended_careers)
    
    TODO:
        - Add caching for repeated recommendations
        - Add async support for long-running pipeline
        - Add webhooks for integration
    """

    def __init__(self):
        """Initialize the pipeline."""
        self.orchestrator = PipelineOrchestrator()
        self.logger = get_logger(__name__)
        
        try:
            config.validate()
            self.logger.info("Pipeline initialized successfully")
        except ValueError as e:
            self.logger.error(f"Configuration validation failed: {e}")
            raise

    def recommend(
        self,
        user_profile: UserProfile,
        cv_text: Optional[str] = None,
        job_market_data: Optional[str] = None,
        preferences: Optional[Dict[str, Any]] = None,
    ) -> CareerRecommendationOutput:
        """
        Generate career recommendations for a user.
        
        Args:
            user_profile (UserProfile): User's profile information
            cv_text (Optional[str]): User's CV text (optional)
            job_market_data (Optional[str]): Job market context (optional)
            preferences (Optional[Dict[str, Any]]): Career preferences (optional)
        
        Returns:
            CareerRecommendationOutput: Complete recommendation result
        
        Example:
            >>> user = UserProfile(
            ...     user_id="user_123",
            ...     name="John Doe",
            ...     email="john@example.com",
            ...     current_skills=["Python", "JavaScript"],
            ...     experience_level="entry",
            ... )
            >>> result = pipeline.recommend(user_profile=user)
            >>> print(result.recommended_careers)
            ['Backend Engineer', 'DevOps Engineer']
        """
        self.logger.info(f"Generating recommendations for user: {user_profile.user_id}")
        
        # Build pipeline input
        pipeline_input: Dict[str, Any] = {
            "user_profile": user_profile,
            "cv_text": cv_text,
            "job_market_data": job_market_data,
            "preferences": preferences,
        }
        
        # Execute pipeline
        result = self.orchestrator.run_pipeline(pipeline_input)
        
        return result

    def recommend_from_dict(self, data: Dict[str, Any]) -> CareerRecommendationOutput:
        """
        Generate recommendations from dictionary input.
        
        Useful for REST API and other external integrations.
        
        Args:
            data (Dict[str, Any]): Input data dictionary
        
        Returns:
            CareerRecommendationOutput: Recommendation result
        
        TODO:
            - Add input validation using Pydantic
            - Add error responses
        """
        input_schema = CareerRecommendationInput(**data)
        
        return self.recommend(
            user_profile=input_schema.user_profile,
            cv_text=input_schema.cv_text,
            job_market_data=input_schema.job_market_data,
            preferences=input_schema.preferences,
        )

    def recommend_with_tools(
        self,
        user_profile: UserProfile,
        cv_text: Optional[str] = None,
        target_role: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generate career recommendations using the tool-calling system.
        
        This method demonstrates how to use individual tools for specific tasks:
        - Extract skills from CV
        - Fetch career requirements
        - Compute skill gaps
        - Generate learning roadmap
        - Retrieve supporting documents
        
        Args:
            user_profile (UserProfile): User's profile information
            cv_text (Optional[str]): User's CV text
            target_role (Optional[str]): Target career role (default: "Backend Engineer")
        
        Returns:
            Dict[str, Any]: Tool results with all intermediate outputs
        
        Example:
            >>> pipeline = CareerRecommendationPipeline()
            >>> result = pipeline.recommend_with_tools(
            ...     user_profile=user,
            ...     cv_text="Software engineer with Python experience...",
            ...     target_role="Backend Engineer"
            ... )
            >>> print(result["roadmap_phases"])
        
        TODO:
            - Add caching to avoid redundant tool calls
            - Make tool calls async for faster execution
            - Add fallback logic if a tool fails
            - Add tool call cost tracking
        """
        self.logger.info(f"Starting tool-based recommendation for {user_profile.user_id}")
        
        pipeline_input = {
            "user_profile": user_profile,
            "cv_text": cv_text,
            "target_role": target_role or "Backend Engineer",
        }
        
        return self.orchestrator.run_tool_pipeline(pipeline_input)

    def list_available_tools(self) -> list:
        """
        List all tools available for agents to call.
        
        Returns:
            list: Names of available tools
        
        Example:
            >>> pipeline = CareerRecommendationPipeline()
            >>> tools = pipeline.list_available_tools()
            >>> print(tools)
            ["retrieve_documents", "extract_skills", ...]
        """
        return self.orchestrator.list_available_tools()

    def call_tool(self, tool_name: str, **kwargs) -> Dict[str, Any]:
        """
        Call a specific tool directly.
        
        Args:
            tool_name (str): Name of the tool to call
            **kwargs: Arguments for the tool
        
        Returns:
            Dict[str, Any]: Tool output
        
        Example:
            >>> pipeline = CareerRecommendationPipeline()
            >>> result = pipeline.call_tool(
            ...     "extract_skills",
            ...     cv_text="Python, JavaScript, SQL..."
            ... )
        """
        return self.orchestrator.call_tool(tool_name, **kwargs)


# Convenience function for quick testing
def get_pipeline() -> CareerRecommendationPipeline:
    """
    Get a pipeline instance.
    
    Useful for dependency injection in FastAPI or similar frameworks.
    """
    return CareerRecommendationPipeline()


# Example usage and testing
if __name__ == "__main__":
    """
    Quick test of the pipeline with mock data.
    
    Run with: python -m ai_v2.main_pipeline
    """
    
    # Create mock user profile
    mock_user = UserProfile(
        user_id="test_user_001",
        name="Alice Johnson",
        email="alice@example.com",
        current_skills=["Python", "JavaScript", "SQL"],
        experience_level="entry",
        education="Bachelor's in Computer Science",
    )
    
    # Create pipeline and run
    try:
        pipeline = CareerRecommendationPipeline()
        
        # =========================================
        # EXAMPLE 1: Traditional Agent-Based Pipeline
        # =========================================
        print("\n" + "="*60)
        print("EXAMPLE 1: Traditional Agent-Based Pipeline")
        print("="*60)
        
        result = pipeline.recommend(
            user_profile=mock_user,
            cv_text="Software Developer with 1 year of experience in Django and React.",
            preferences={"preferred_roles": ["Backend Engineer", "Full-stack Engineer"]},
        )
        
        # Display results
        print(f"User ID: {result.user_id}")
        print(f"Recommended Careers: {result.recommended_careers}")
        print(f"Confidence Score: {result.confidence_score:.2%}")
        print(f"Total Roadmap Duration: {len(result.roadmap)} phases")
        print("✓ Recommendation generated successfully!")
        print("="*60 + "\n")
        
        # =========================================
        # EXAMPLE 2: Tool-Based Pipeline
        # =========================================
        print("="*60)
        print("EXAMPLE 2: Tool-Based Pipeline")
        print("="*60)
        
        tool_result = pipeline.recommend_with_tools(
            user_profile=mock_user,
            cv_text="Software Developer with 1 year of experience in Django and React.",
            target_role="Backend Engineer",
        )
        
        # Display tool results
        print(f"Pipeline Status: {tool_result['status']}")
        print(f"User ID: {tool_result.get('user_id')}")
        print(f"Target Role: {tool_result.get('target_role')}")
        
        # Show completed steps
        steps_completed = tool_result.get('steps_completed', [])
        print(f"\n✓ Steps Completed ({len(steps_completed)}/5):")
        for i, step in enumerate(steps_completed, 1):
            print(f"  {i}. {step}")
        
        # Show extracted data from each step
        print("\nExtracted Data:")
        
        if tool_result.get("extracted_skills"):
            skills_data = tool_result["extracted_skills"]
            if skills_data.get("success"):
                print(f"  • Skills: {len(skills_data.get('skills', []))} keywords found")
        
        if tool_result.get("career_requirements"):
            req = tool_result["career_requirements"]
            if req.get("success"):
                print(f"  • Requirements: {len(req.get('required_skills', []))} required skills")
                if req.get('salary_range'):
                    print(f"    Salary: {req.get('salary_range')}")
        
        if tool_result.get("skill_gap"):
            gap = tool_result["skill_gap"]
            if gap.get("success"):
                print(f"  • Skill Gap: {gap.get('gap_percentage', 0):.1%} coverage")
                gap_skills = gap.get('gap_skills', [])
                if gap_skills:
                    print(f"    Missing: {', '.join(gap_skills[:3])}")
        
        if tool_result.get("roadmap"):
            roadmap = tool_result["roadmap"]
            if roadmap.get("success"):
                phases = roadmap.get('phases', [])
                print(f"  • Roadmap: {len(phases)} phases ({roadmap.get('total_months', 0)} months)")
        
        if tool_result.get("documents"):
            docs = tool_result["documents"]
            if docs.get("success"):
                print(f"  • Documents: {docs.get('count', 0)} resources retrieved")
        
        print("\n✓ Tool-based recommendation completed!")
        print("="*60 + "\n")
        
        # =========================================
        # EXAMPLE 3: Individual Tool Calls
        # =========================================
        print("="*60)
        print("EXAMPLE 3: Individual Tool Calls")
        print("="*60)
        
        cv_text = "Senior Python developer with 5 years experience. Skills: Python, FastAPI, PostgreSQL, Redis, Docker, Kubernetes, AWS, GCP."
        
        # Call tools individually
        print("\n[1] Extracting skills from CV...")
        skills_result = pipeline.call_tool("extract_skills", cv_text=cv_text)
        if skills_result.get("success"):
            print(f"    Found {len(skills_result.get('skills', []))} skills across {len(skills_result.get('categories', {}))} categories")
        
        print("\n[2] Getting requirements for Backend Engineer role...")
        reqs_result = pipeline.call_tool("get_career_requirements", role="Backend Engineer")
        if reqs_result.get("success"):
            print(f"    Required skills: {', '.join(reqs_result.get('required_skills', [])[:3])}...")
        
        print("\n[3] Computing skill gap...")
        gap_result = pipeline.call_tool(
            "compute_skill_gap",
            user_skills=["Python", "FastAPI", "PostgreSQL", "Docker"],
            required_skills=["Python", "Django", "PostgreSQL", "Redis", "Kubernetes"]
        )
        if gap_result.get("success"):
            print(f"    Gap score: {gap_result.get('gap_percentage', 0):.1%}")
        
        print("\n[4] Generating learning roadmap...")
        roadmap_result = pipeline.call_tool(
            "generate_roadmap",
            missing_skills=["Redis", "Kubernetes"],
            target_role="Backend Engineer",
            current_experience="5 years Python development"
        )
        if roadmap_result.get("success"):
            print(f"    Roadmap phases: {len(roadmap_result.get('phases', []))}")
        
        print("\n[5] Retrieving supporting documents...")
        docs_result = pipeline.call_tool(
            "retrieve_documents",
            query="Backend engineer skills and requirements",
            top_k=3
        )
        if docs_result.get("success"):
            print(f"    Retrieved {docs_result.get('count', 0)} documents")
        
        print("\n✓ All individual tool calls completed!")
        print("="*60 + "\n")
        
        # =========================================
        # EXAMPLE 4: List Available Tools
        # =========================================
        print("="*60)
        print("EXAMPLE 4: Available Tools")
        print("="*60)
        tools = pipeline.list_available_tools()
        print(f"Available tools for agents: {', '.join(tools)}")
        print("="*60 + "\n")
        
    except Exception as e:
        logger.error(f"Pipeline failed: {e}")
        raise
