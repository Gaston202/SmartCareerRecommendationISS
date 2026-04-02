"""
Tool-calling orchestrator for LLM.

Manages the multi-turn interaction between LLM and tools:
1. LLM receives context + available tools
2. LLM decides which tools to call
3. Tools execute and return results
4. Results fed back to LLM
5. LLM generates final response with full context
"""

from typing import Any, Dict, List, Optional
from ..config import config
from ..utils import get_logger
from .definitions import TOOL_DEFINITIONS, get_tool_names
from .executor import ToolExecutor

logger = get_logger(__name__)


class ToolCallingOrchestrator:
    """
    Orchestrates LLM function calling for intelligent career recommendations.
    
    Features:
        - Multi-turn conversation with LLM
        - Tool execution based on LLM decisions
        - Context accumulation across tool calls
        - Fallback to non-tool mode if API limits reached
    """
    
    def __init__(self, llm_client=None, rag_retriever=None):
        """
        Initialize orchestrator.
        
        Args:
            llm_client: OpenAI client instance
            rag_retriever: RAG retriever for knowledge base queries
        """
        self.client = llm_client
        self.tool_executor = ToolExecutor(rag_retriever=rag_retriever)
        self.logger = get_logger(__name__)
        self.max_iterations = 10  # Prevent infinite tool calling loops
    
    def call_with_tools(
        self,
        initial_prompt: str,
        user_context: Dict[str, Any],
        system_prompt: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Execute LLM with tool calling capability.
        
        Args:
            initial_prompt (str): Initial user prompt
            user_context (Dict[str, Any]): Context about the user (profile, skills, etc.)
            system_prompt (Optional[str]): Custom system prompt
            
        Returns:
            Dict: Final LLM response with tool call history
        """
        if not self.client:
            self.logger.warning("[TOOL_CALLING] No OpenAI client available, skipping tool calling")
            return {"success": False, "error": "No LLM client", "mode": "none"}
        
        # Build system prompt
        if not system_prompt:
            system_prompt = self._build_system_prompt()
        
        # Initialize conversation
        messages = [
            {
                "role": "system",
                "content": system_prompt
            },
            {
                "role": "user",
                "content": self._build_user_message(initial_prompt, user_context)
            }
        ]
        
        tool_call_history = []
        iteration = 0
        
        # Tool calling loop
        while iteration < self.max_iterations:
            iteration += 1
            self.logger.debug(f"[TOOL_CALLING] Iteration {iteration}/{self.max_iterations}")
            
            try:
                # Call LLM with tools
                response = self.client.chat.completions.create(
                    model=config.LLM_MODEL,
                    messages=messages,
                    tools=TOOL_DEFINITIONS,
                    tool_choice="auto",
                    temperature=0.7,
                    max_tokens=2000,
                )
                
                # Extract response
                assistant_message = response.choices[0].message
                
                # Add assistant message to conversation
                messages.append({
                    "role": "assistant",
                    "content": assistant_message.content or "",
                    "tool_calls": getattr(assistant_message, "tool_calls", None)
                })
                
                # Check if LLM wants to call tools
                if not hasattr(assistant_message, "tool_calls") or not assistant_message.tool_calls:
                    # LLM finished - no more tool calls
                    self.logger.info(
                        f"[TOOL_CALLING] LLM finished after {iteration} iterations, "
                        f"{len(tool_call_history)} tools called"
                    )
                    return {
                        "success": True,
                        "response": assistant_message.content or "",
                        "tool_calls": tool_call_history,
                        "iterations": iteration,
                        "mode": "tool_calling"
                    }
                
                # Execute tool calls
                tool_results = []
                for tool_call in assistant_message.tool_calls:
                    tool_name = tool_call.function.name
                    tool_input = eval(tool_call.function.arguments) if isinstance(tool_call.function.arguments, str) else tool_call.function.arguments
                    
                    self.logger.debug(f"[TOOL_CALLING] Calling tool: {tool_name}")
                    
                    # Execute tool
                    result = self.tool_executor.execute(tool_name, tool_input)
                    
                    tool_call_history.append({
                        "tool": tool_name,
                        "input": tool_input,
                        "result": result
                    })
                    
                    tool_results.append({
                        "type": "tool",
                        "tool_use_id": tool_call.id,
                        "name": tool_name,
                        "content": str(result["data"]) if result["success"] else f"Error: {result['error']}"
                    })
                
                # Add tool results to conversation
                messages.append({
                    "role": "user",
                    "content": tool_results
                })
                
            except Exception as e:
                self.logger.error(f"[TOOL_CALLING] Error during tool calling: {str(e)}")
                return {
                    "success": False,
                    "error": str(e),
                    "tool_calls": tool_call_history,
                    "iterations": iteration,
                    "mode": "tool_calling_error"
                }
        
        # Max iterations reached
        self.logger.warning(f"[TOOL_CALLING] Max iterations ({self.max_iterations}) reached")
        return {
            "success": False,
            "error": "Max tool calling iterations reached",
            "tool_calls": tool_call_history,
            "iterations": iteration,
            "mode": "tool_calling_timeout"
        }
    
    def _build_system_prompt(self) -> str:
        """Build system prompt for tool-calling mode."""
        return f"""You are an expert career advisor with access to tools for analyzing career transitions.

Available tools:
{self._format_tool_descriptions()}

Your task is to help users find the right career path by:
1. Analyzing their current skills and experience using extract_skills_from_profile
2. Understanding requirements for their target career using get_career_requirements
3. Computing gaps using compute_skill_gap
4. Creating learning plans using generate_learning_roadmap
5. Finding resources using retrieve_career_resources

Use tools intelligently to gather all necessary information, then provide a comprehensive recommendation.
Be concise but thorough in your analysis."""
    
    def _format_tool_descriptions(self) -> str:
        """Format tool descriptions for the system prompt."""
        descriptions = []
        for tool_def in TOOL_DEFINITIONS:
            func = tool_def["function"]
            descriptions.append(f"- {func['name']}: {func['description']}")
        return "\n".join(descriptions)
    
    def _build_user_message(self, prompt: str, context: Dict[str, Any]) -> str:
        """Build user message with context."""
        context_str = "\n".join(
            f"- {k}: {v}" for k, v in context.items()
        )
        return f"""{prompt}

User Context:
{context_str}

Please analyze this career transition and use the available tools to provide detailed recommendations."""
