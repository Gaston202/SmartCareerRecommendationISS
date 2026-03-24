"""
Orchestrator for AI v2 pipeline.

Manages agent execution sequencing and state management.
Now includes tool calling capability for agents to interact with external logic.
"""

from typing import Dict, Any, List, Optional
from .config import config
from .schemas import (
    AgentType,
    AgentOutput,
    CareerRecommendationOutput,
    CareerRecommendation,
    SkillGapItem,
    SkillGapAnalysis,
    RoadmapStep,
)
from .agents import (
    ProfileAgent,
    CVAgent,
    CareerAgent,
    GapAgent,
    RoadmapAgent,
    ExplanationAgent,
)
from .tools import get_tool, list_tools, call_tool
from .utils import get_logger

logger = get_logger(__name__)


class PipelineOrchestrator:
    """
    Orchestrator for managing agent execution pipeline.
    
    Responsibility:
        - Sequence agent execution in the correct order
        - Manage data flow between agents
        - Handle errors and failures gracefully
        - Collect and aggregate results
        - Enforce configuration and feature flags
    
    Pipeline Flow:
        1. ProfileAgent: Analyze user profile
        2. CVAgent: Extract CV information (if provided)
        3. CareerAgent: Generate career recommendations
        4. GapAgent: Analyze skill gaps for each career
        5. RoadmapAgent: Generate learning roadmap
        6. ExplanationAgent: Generate explanations for why careers match
    
    TODO:
        - Implement retry logic for failed agents
        - Add timeout handling per agent
        - Support conditional agent execution
        - Implement multi-agent consensus for career selection
        - Add observability/monitoring hooks
        - Support parallel agent execution where possible
    """

    def __init__(self):
        """Initialize the orchestrator and all agents."""
        self.logger = get_logger(__name__)
        
        # Initialize agents
        self.profile_agent = ProfileAgent()
        self.cv_agent = CVAgent()
        self.career_agent = CareerAgent()
        self.gap_agent = GapAgent()
        self.roadmap_agent = RoadmapAgent()
        self.explanation_agent = ExplanationAgent()
        
        self.agent_outputs: Dict[str, AgentOutput] = {}
        
        self.logger.info("PipelineOrchestrator initialized")

    def run_pipeline(
        self,
        pipeline_input: Dict[str, Any],
    ) -> CareerRecommendationOutput:
        """
        Execute the complete recommendation pipeline.
        
        Pipeline Data Flow:
            1. ProfileAgent: Analyze user profile
            2. CVAgent: Extract skills from CV
            3. CareerAgent: Get required_skills for recommended careers
            4. GapAgent: Compare skills vs required_skills → missing_skills
            5. RoadmapAgent: Generate learning path for missing_skills
        
        Args:
            pipeline_input (Dict[str, Any]): Input dict containing:
                - user_profile: UserProfile object
                - cv_text: Optional CV text
                - job_market_data: Optional market data
                - preferences: Optional career preferences
        
        Returns:
            CareerRecommendationOutput: Complete recommendation result
        
        Raises:
            ValueError: If critical inputs are missing
        """
        self.logger.info("Starting recommendation pipeline")
        
        try:
            # Validate input
            if "user_profile" not in pipeline_input:
                raise ValueError("user_profile is required in pipeline input")
            
            user_id = pipeline_input["user_profile"].user_id
            
            # Stage 1: Profile Analysis
            if config.ENABLE_PROFILE_AGENT:
                self.logger.info("Stage 1: Running Profile Agent")
                profile_output = self._run_agent(
                    self.profile_agent,
                    pipeline_input,
                )
                self.agent_outputs["profile"] = profile_output
            
            # Stage 2: CV Analysis (extract skills)
            cv_skills = []
            if config.ENABLE_CV_AGENT and pipeline_input.get("cv_text"):
                self.logger.info("Stage 2: Running CV Agent")
                cv_output = self._run_agent(
                    self.cv_agent,
                    pipeline_input,
                )
                self.agent_outputs["cv"] = cv_output
                
                # Extract skills from CV
                cv_data = cv_output.data or {}
                cv_skills = cv_data.get("skills_extracted", [])
                self.logger.info(f"  → Extracted {len(cv_skills)} skills from CV")
            
            # Stage 3: Career Recommendation (get required_skills)
            required_skills = []
            if config.ENABLE_CAREER_AGENT:
                self.logger.info("Stage 3: Running Career Agent")
                career_input = self._prepare_agent_input(
                    pipeline_input,
                    self.agent_outputs,
                )
                career_output = self._run_agent(
                    self.career_agent,
                    career_input,
                )
                self.agent_outputs["career"] = career_output
                
                # Extract required_skills from career recommendations
                career_data = career_output.data or {}
                careers = career_data.get("recommended_careers", [])
                if careers and isinstance(careers[0], dict):
                    required_skills = careers[0].get("required_skills", [])
                self.logger.info(f"  → Identified {len(required_skills)} required skills")
            
            # Stage 4: Gap Analysis (compare CV skills vs required_skills)
            missing_skills = []
            if config.ENABLE_GAP_AGENT:
                self.logger.info("Stage 4: Running Gap Agent")
                
                # Build gap input with CV skills and required skills
                gap_input = self._prepare_agent_input(
                    pipeline_input,
                    self.agent_outputs,
                )
                gap_input["current_skills"] = cv_skills or pipeline_input.get("user_profile").current_skills
                gap_input["required_skills"] = required_skills
                
                gap_output = self._run_agent(
                    self.gap_agent,
                    gap_input,
                )
                self.agent_outputs["gap"] = gap_output
                
                # Extract missing_skills from gap analysis
                gap_data = gap_output.data or {}
                
                # Use priority_gaps directly as missing_skills (skills to learn)
                missing_skills = gap_data.get("priority_gaps", [])
                
                # If priority_gaps not available, extract from gap_items
                if not missing_skills:
                    gap_analysis = gap_data.get("gaps", [])
                    if gap_analysis and isinstance(gap_analysis[0], dict):
                        gap_items = gap_analysis[0].get("gap_items", [])
                        missing_skills = [item["skill"] if isinstance(item, dict) else item for item in gap_items]
                
                self.logger.info(f"  → Identified {len(missing_skills)} skill gaps")
            
            # Stage 5: Roadmap Generation (create learning path for missing skills)
            if config.ENABLE_ROADMAP_AGENT:
                self.logger.info("Stage 5: Running Roadmap Agent")
                
                # Build roadmap input with missing skills
                roadmap_input = self._prepare_agent_input(
                    pipeline_input,
                    self.agent_outputs,
                )
                roadmap_input["missing_skills"] = missing_skills
                
                # Get target role from preferences or use default
                preferences = pipeline_input.get("preferences", {}) or {}
                preferred_roles = preferences.get("preferred_roles", [])
                roadmap_input["target_role"] = (
                    preferred_roles[0] if preferred_roles else "Backend Engineer"
                )
                roadmap_input["experience_level"] = pipeline_input.get("user_profile").experience_level
                
                roadmap_output = self._run_agent(
                    self.roadmap_agent,
                    roadmap_input,
                )
                self.agent_outputs["roadmap"] = roadmap_output
                self.logger.info("  → Roadmap generated successfully")
            
            # Stage 6: Explanation Generation (explain why careers match)
            if config.ENABLE_EXPLANATION_AGENT:
                self.logger.info("Stage 6: Running Explanation Agent")
                
                # Get first (best) career recommendation for explanation
                career_data = self.agent_outputs.get("career", AgentOutput(agent_type=AgentType.CAREER, success=False, data={})).data or {}
                career_recs = career_data.get("recommended_careers", [])
                primary_career = career_recs[0] if career_recs else None
                
                if primary_career:
                    # Get skills data
                    user_skills = career_data.get("user_skills", [])
                    required_skills = primary_career.get("required_skills", [])
                    
                    explain_input = self._prepare_agent_input(
                        pipeline_input,
                        self.agent_outputs,
                    )
                    explain_input["career_recommendation"] = primary_career
                    explain_input["user_skills"] = user_skills
                    explain_input["required_skills"] = required_skills
                    explain_input["user_profile"] = pipeline_input.get("user_profile")
                    
                    explanation_output = self._run_agent(
                        self.explanation_agent,
                        explain_input,
                    )
                    self.agent_outputs["explanation"] = explanation_output
                    self.logger.info("  → Career explanation generated")
            
            # Aggregate results
            final_output = self._aggregate_results(user_id)
            
            self.logger.info("Pipeline execution completed successfully")
            
            return final_output
        
        except Exception as e:
            self.logger.error(f"Pipeline execution failed: {str(e)}", exc_info=True)
            raise

    def _run_agent(
        self,
        agent: Any,
        agent_input: Dict[str, Any],
    ) -> AgentOutput:
        """
        Execute a single agent with error handling.
        
        TODO:
            - Add timeout
            - Add retry logic
            - Add detailed error reporting
        """
        try:
            output = agent.run(agent_input)
            if output.success:
                self.logger.info(f"✓ {agent.name} completed successfully")
            else:
                self.logger.warning(f"✗ {agent.name} failed: {output.error}")
            return output
        except Exception as e:
            self.logger.error(f"Exception in {agent.name}: {str(e)}")
            return AgentOutput(
                agent_type=agent.agent_type,
                success=False,
                error=f"Agent execution failed: {str(e)}",
            )

    def _prepare_agent_input(
        self,
        base_input: Dict[str, Any],
        agent_outputs: Dict[str, AgentOutput],
    ) -> Dict[str, Any]:
        """
        Prepare input for next agent by merging previous outputs.
        
        TODO:
            - Implement smart input preparation based on agent type
            - Add input validation and transformation
        """
        prepared_input = base_input.copy()
        
        # Extract data from previous agents
        for agent_name, output in agent_outputs.items():
            if output.success:
                prepared_input[f"{agent_name}_data"] = output.data
        
        return prepared_input

    def _aggregate_results(self, user_id: str) -> CareerRecommendationOutput:
        """
        Aggregate individual agent outputs into final result.
        
        Converts raw data from agents into structured objects.
        
        TODO:
            - Extract career recommendations from CareerAgent output
            - Extract skill gaps from GapAgent output
            - Extract roadmap from RoadmapAgent output
            - Calculate confidence scores
        """
        # Extract profile data
        profile_data = self.agent_outputs.get(
            "profile",
            AgentOutput(agent_type=AgentType.PROFILE, success=False, data={})
        ).data or {}
        
        # Extract CV data
        cv_data = self.agent_outputs.get(
            "cv",
            AgentOutput(agent_type=AgentType.CV, success=False, data={})
        ).data or {}
        
        # Extract recommendations from career agent and convert to structured objects
        career_data = self.agent_outputs.get(
            "career",
            AgentOutput(agent_type=AgentType.CAREER, success=False, data={})
        ).data or {}
        
        # Convert career recommendations to structured objects
        career_recs_raw = career_data.get("recommended_careers", [])
        recommended_careers = []
        for career in career_recs_raw:
            if isinstance(career, str):
                # Convert string to CareerRecommendation object
                recommended_careers.append(
                    CareerRecommendation(role=career)
                )
            elif isinstance(career, dict):
                # Convert dict to CareerRecommendation object
                recommended_careers.append(
                    CareerRecommendation(**career)
                )
        
        # Extract gap analyses from gap agent
        gap_data = self.agent_outputs.get(
            "gap",
            AgentOutput(agent_type=AgentType.GAP, success=False, data={})
        ).data or {}
        
        # Convert gap data to structured objects
        gaps_raw = gap_data.get("gaps", [])
        skill_gaps = []
        for gap in gaps_raw:
            if isinstance(gap, dict):
                # If gap_items are provided as dicts, convert to SkillGapItem objects
                gap_items = gap.get("gap_items", [])
                if gap_items and isinstance(gap_items[0], dict):
                    gap["gap_items"] = [SkillGapItem(**item) for item in gap_items]
                skill_gaps.append(SkillGapAnalysis(**gap))
        
        # Extract roadmap from roadmap agent
        roadmap_data = self.agent_outputs.get(
            "roadmap",
            AgentOutput(agent_type=AgentType.ROADMAP, success=False, data={})
        ).data or {}
        
        # Convert roadmap steps to structured objects
        roadmap_steps_raw = roadmap_data.get("phases", [])
        roadmap_steps = []
        for step in roadmap_steps_raw:
            if isinstance(step, dict):
                roadmap_steps.append(RoadmapStep(**step))
        
        # Calculate overall confidence
        confidence = career_data.get("confidence_score", 0.5)
        
        return CareerRecommendationOutput(
            user_id=user_id,
            recommended_careers=recommended_careers,
            skill_gaps=skill_gaps,
            roadmap=roadmap_steps,
            confidence_score=confidence,
            agent_outputs=self.agent_outputs,
        )

    # ========================================================================
    # Tool Calling Methods - NEW: Enable agents to call external tools
    # ========================================================================

    def call_tool(self, tool_name: str, **kwargs) -> Dict[str, Any]:
        """
        Call a tool from the tool registry.
        
        This allows agents to execute external logic without embedding
        implementation details directly in agent code.
        
        Args:
            tool_name (str): Name of the tool to call (e.g., "extract_skills")
            **kwargs: Arguments to pass to the tool
        
        Returns:
            Dict[str, Any]: Tool output
        
        Example:
            >>> orchestrator = PipelineOrchestrator()
            >>> result = orchestrator.call_tool(
            ...     "extract_skills",
            ...     cv_text="Software engineer with Python experience..."
            ... )
        
        TODO:
            - Add tool call caching
            - Add cost tracking for API-based tools
            - Add retry logic for failed tool calls
        """
        self.logger.info(f"Tool call: {tool_name}")
        try:
            result = call_tool(tool_name, **kwargs)
            return result
        except Exception as e:
            self.logger.error(f"Tool call failed: {tool_name} - {str(e)}")
            return {"success": False, "error": str(e)}

    def run_tool_pipeline(self, pipeline_input: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a tool-based pipeline that demonstrates tool calling flow.
        
        This is an example of how agents can use tools to accomplish tasks.
        Shows a complete flow: CV → Extract Skills → Get Requirements → Gap Analysis → Roadmap
        
        Args:
            pipeline_input (Dict[str, Any]): Input containing user_profile and optional cv_text
        
        Returns:
            Dict[str, Any]: Complete tool execution result with steps_completed tracking
        
        Example:
            >>> result = orchestrator.run_tool_pipeline({
            ...     "user_profile": user_profile,
            ...     "cv_text": "Software engineer with 2 years Python experience"
            ... })
            >>> print(result["steps_completed"])
            ["extract_skills", "get_career_requirements", "compute_skill_gap", "generate_roadmap", "retrieve_documents"]
            >>> print(result["gap"]["gap_percentage"])
        
        TODO:
            - Make this asynchronous for parallel tool execution
            - Add error recovery - if one tool fails, continue with defaults
            - Add tool call optimization (memoization, batching)
        """
        self.logger.info("Running tool-based pipeline")
        
        # Track which steps completed successfully
        steps_completed = []
        
        # Initialize result structure
        tool_results = {
            "status": "running",
            "steps_completed": steps_completed,
            "extracted_skills": None,
            "career_requirements": None,
            "skill_gap": None,
            "roadmap": None,
            "documents": None,
            "error": None,
        }
        
        try:
            user_profile = pipeline_input.get("user_profile")
            cv_text = pipeline_input.get("cv_text", "")
            
            # ================================================================
            # STEP 1: Extract Skills from CV using tool
            # ================================================================
            self.logger.info("STEP 1: Extracting skills from CV")
            
            if cv_text:
                cv_result = self.call_tool("extract_skills", cv_text=cv_text)
                if cv_result.get("success"):
                    tool_results["extracted_skills"] = cv_result
                    steps_completed.append("extract_skills")
                    user_skills = cv_result.get("skills", user_profile.current_skills)
                    self.logger.info(f"✓ Extracted {len(user_skills)} skills from CV")
                else:
                    user_skills = user_profile.current_skills
                    self.logger.warning("Failed to extract skills, using profile skills")
            else:
                user_skills = user_profile.current_skills
                self.logger.info("No CV provided, using profile skills")
            
            # ================================================================
            # STEP 2: Get Career Requirements for target role using tool
            # ================================================================
            self.logger.info("STEP 2: Fetching career requirements")
            
            target_role = pipeline_input.get("target_role", "Backend Engineer")
            requirements_result = self.call_tool(
                "get_career_requirements",
                role=target_role
            )
            
            if requirements_result.get("success"):
                tool_results["career_requirements"] = requirements_result
                steps_completed.append("get_career_requirements")
                required_skills = requirements_result.get("required_skills", [])
                self.logger.info(f"✓ Retrieved requirements for {target_role}")
            else:
                required_skills = []
                self.logger.warning(f"Failed to get requirements for {target_role}")
            
            # ================================================================
            # STEP 3: Compute Skill Gap using tool
            # ================================================================
            self.logger.info("STEP 3: Computing skill gaps")
            
            gap_result = self.call_tool(
                "compute_skill_gap",
                user_skills=user_skills,
                required_skills=required_skills,
            )
            
            if gap_result.get("success"):
                tool_results["skill_gap"] = gap_result
                steps_completed.append("compute_skill_gap")
                missing_skills = gap_result.get("gap_skills", [])
                gap_score = gap_result.get("gap_percentage", 0.0)
                self.logger.info(f"✓ Skill gap computed: {gap_score:.1%} coverage")
            else:
                missing_skills = []
                self.logger.warning("Failed to compute skill gap")
            
            # ================================================================
            # STEP 4: Generate Roadmap using tool
            # ================================================================
            self.logger.info("STEP 4: Generating learning roadmap")
            
            roadmap_result = self.call_tool(
                "generate_roadmap",
                missing_skills=missing_skills,
                target_role=target_role,
                current_experience=user_profile.experience_level,
            )
            
            if roadmap_result.get("success"):
                tool_results["roadmap"] = roadmap_result
                steps_completed.append("generate_roadmap")
                phases = roadmap_result.get("phases", [])
                self.logger.info(f"✓ Generated roadmap with {len(phases)} phases")
            else:
                self.logger.warning("Failed to generate roadmap")
            
            # ================================================================
            # STEP 5: Retrieve Supporting Documents using RAG tool
            # ================================================================
            self.logger.info("STEP 5: Retrieving supporting documents")
            
            docs_result = self.call_tool(
                "retrieve_documents",
                query=f"{target_role} career path and requirements",
                top_k=3,
            )
            
            if docs_result.get("success"):
                tool_results["documents"] = docs_result
                steps_completed.append("retrieve_documents")
                doc_count = docs_result.get("count", 0)
                self.logger.info(f"✓ Retrieved {doc_count} supporting documents")
            else:
                self.logger.warning("Failed to retrieve documents")
            
            # ================================================================
            # Mark pipeline as completed
            # ================================================================
            tool_results["status"] = "completed"
            tool_results["steps_completed"] = steps_completed
            tool_results["user_id"] = user_profile.user_id
            tool_results["target_role"] = target_role
            
            self.logger.info(f"Tool pipeline completed successfully - {len(steps_completed)}/5 steps")
            
        except Exception as e:
            self.logger.error(f"Tool pipeline failed: {str(e)}", exc_info=True)
            tool_results["status"] = "failed"
            tool_results["error"] = str(e)
            tool_results["steps_completed"] = steps_completed
        
        return tool_results

    def list_available_tools(self) -> List[str]:
        """
        List all available tools that agents can call.
        
        Returns:
            List[str]: List of tool names
        
        Example:
            >>> tools = orchestrator.list_available_tools()
            >>> print(tools)
            ["retrieve_documents", "extract_skills", ...]
        """
        return list_tools()
