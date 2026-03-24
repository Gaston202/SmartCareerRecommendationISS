"""
NEXT 3 IMPLEMENTATION STEPS - Quick Start Guide
================================================

This document outlines the three priority tasks to complete next.


STEP 1: INTEGRATE EXPLANATION AGENT INTO ORCHESTRATOR
======================================================

Time: 30 minutes
Difficulty: Easy
File: backend/ai_v2/orchestrator.py

WHY: Users need to understand WHY each career was recommended

WHAT TO DO:

1. Import the ExplanationAgent:
   ```python
   from .agents import ExplanationAgent
   ```

2. Add field in PipelineOrchestrator.__init__():
   ```python
   self.explanation_agent = ExplanationAgent()
   ```

3. Add Stage 6 after roadmap (around line 200):
   ```python
   # Stage 6: Career Explanation (explain why careers match)
   if config.ENABLE_EXPLANATION_AGENT:
       self.logger.info("Stage 6: Running Explanation Agent")
       
       # Get first (best) career recommendation for explanation
       career_data = self.agent_outputs["career"].data or {}
       career_recs = career_data.get("recommended_careers", [])
       primary_career = career_recs[0] if career_recs else None
       
       if primary_career:
           explain_input = self._prepare_agent_input(
               pipeline_input,
               self.agent_outputs,
           )
           explain_input["career_recommendation"] = primary_career
           explain_input["user_skills"] = all_skills  # From career agent
           explain_input["required_skills"] = required_skills  # From career data
           
           explanation_output = self._run_agent(
               self.explanation_agent,
               explain_input,
           )
           self.agent_outputs["explanation"] = explanation_output
           self.logger.info("  → Career explanation generated")
   ```

4. In _aggregate_results(), add explanation to final output:
   ```python
   # Extract explanation from explanation agent
   explanation_data = self.agent_outputs.get(
       "explanation",
       AgentOutput(agent_type=AgentType.EXPLANATION, success=False, data={})
   ).data or {}
   
   # Add to output (after roadmap_steps)
   output.explanation = explanation_data
   ```

5. Add to config.py:
   ```python
   ENABLE_EXPLANATION_AGENT = os.getenv("ENABLE_EXPLANATION_AGENT", "True").lower() == "true"
   ```

VERIFY:
- Run pipeline
- Check for Stage 6 log output
- Verify explanation appears in output
- No errors in orchestrator


STEP 2: IMPLEMENT OPENAI TOOL CALLING FOR EXPLANATION
======================================================

Time: 2-3 hours
Difficulty: Medium
File: backend/ai_v2/agents/explanation_agent.py

WHY: Better explanations using actual tool calls (skill analysis, requirements, gaps)

WHAT TO DO:

1. Replace _call_llm_with_tools() implementation:
   ```python
   def _call_llm_with_tools(self, prompt: str, available_tools: List[str]) -> Dict[str, Any]:
       """Call LLM with tool calling."""
       try:
           # Build tool definitions
           tools = self._build_tool_definitions(available_tools)
           
           # Call OpenAI with tools
           response = self.llm.client.chat.completions.create(
               model=config.LLM_MODEL,
               messages=[
                   {
                       "role": "system",
                       "content": "You are a career advisor. Use available tools to analyze skills..."
                   },
                   {"role": "user", "content": prompt}
               ],
               tools=tools,
               tool_choice="auto",
               max_tokens=2000,
           )
           
           # Process tool calls
           message = response.choices[0].message
           if message.tool_calls:
               return self._execute_tool_calls(message.tool_calls)
           else:
               return {
                   "success": True,
                   "explanation": message.content
               }
       except Exception as e:
           self.logger.error(f"Tool calling failed: {e}")
           return None
   ```

2. Add _build_tool_definitions():
   ```python
   def _build_tool_definitions(self, available_tools: List[str]) -> List[Dict]:
       """Build tool definitions for OpenAI."""
       tools = []
       
       if "extract_skills" in available_tools:
           tools.append({
               "type": "function",
               "function": {
                   "name": "extract_skills",
                   "description": "Extract and analyze user's actual skills with proficiency levels",
                   "parameters": {
                       "type": "object",
                       "properties": {
                           "user_id": {"type": "string"},
                           "include_proficiency": {"type": "boolean"}
                       },
                       "required": ["user_id"]
                   }
               }
           })
       
       # Add other tools similarly...
       return tools
   ```

3. Add _execute_tool_calls():
   ```python
   def _execute_tool_calls(self, tool_calls: List) -> Dict[str, Any]:
       """Execute tool calls and collect results."""
       tool_results = {}
       
       for tool_call in tool_calls:
           tool_name = tool_call.function.name
           tool_args = json.loads(tool_call.function.arguments)
           
           if tool_name == "extract_skills":
               tool_results[tool_name] = self._tool_extract_skills(tool_args)
           elif tool_name == "get_career_requirements":
               tool_results[tool_name] = self._tool_get_career_requirements(tool_args)
           # ... handle other tools
       
       return {
           "success": True,
           "tool_results": tool_results
       }
   ```

4. Add individual tool handlers:
   ```python
   def _tool_extract_skills(self, args: Dict) -> Dict:
       """Tool: Extract user skills from profile."""
       # Return structured skill data
       return {"skills": [...], "proficiencies": {...}}
   
   def _tool_get_career_requirements(self, args: Dict) -> Dict:
       """Tool: Get requirements for a specific career."""
       # Query requirements, salary, market demand
       return {"requirements": [...], "salary": "...", "demand": "..."}
   ```

VERIFY:
- Run explanation agent with tool calling enabled
- Check that OpenAI tool calls are executed
- Verify tool results are used in explanation
- Explanations are more detailed/accurate


STEP 3: ADD RETRY LOGIC WITH EXPONENTIAL BACKOFF
=================================================

Time: 1-2 hours
Difficulty: Easy-Medium
File: backend/ai_v2/services/llm.py

WHY: Handle rate limits gracefully by retrying instead of failing

WHAT TO DO:

1. Add retry configuration to config.py:
   ```python
   LLM_MAX_RETRIES = int(os.getenv("LLM_MAX_RETRIES", "3"))
   LLM_RETRY_BACKOFF = float(os.getenv("LLM_RETRY_BACKOFF", "2.0"))  # Exponential base
   ```

2. Replace _safe_api_call() with retry logic:
   ```python
   def _safe_api_call(self, api_call_func, max_retries: int = None):
       """Execute API call with retry logic."""
       if max_retries is None:
           max_retries = config.LLM_MAX_RETRIES
       
       for attempt in range(max_retries):
           try:
               return api_call_func()
           except Exception as e:
               llm_error = categorize_llm_error(e)
               
               # Only retry on transient errors
               if llm_error.error_type in [
                   LLMErrorType.RATE_LIMIT,
                   LLMErrorType.TIMEOUT,
                   LLMErrorType.NETWORK_ERROR,
               ]:
                   if attempt < max_retries - 1:
                       wait_time = config.LLM_RETRY_BACKOFF ** attempt
                       self.logger.warning(
                           f"[RETRY] {llm_error.error_type.value} - "
                           f"Retrying in {wait_time}s (attempt {attempt + 1}/{max_retries})"
                       )
                       time.sleep(wait_time)
                       continue
               
               # Don't retry on quota/auth errors, log and fallback
               self._log_error(llm_error)
               self.use_mock = True
               return None
       
       return None
   ```

3. Add _log_error() helper:
   ```python
   def _log_error(self, llm_error: LLMError):
       """Log categorized LLM error."""
       if llm_error.error_type == LLMErrorType.QUOTA_EXCEEDED:
           self.logger.error(f"[FALLBACK_MOCK] API QUOTA EXCEEDED - {llm_error}")
       elif llm_error.error_type == LLMErrorType.RATE_LIMIT:
           self.logger.warning(f"[FALLBACK_MOCK] Rate limited - {llm_error}")
       # ... etc
   ```

4. Add imports:
   ```python
   import time
   ```

VERIFY:
- Run with rate-limited account
- Should see "[RETRY]" messages
- Should wait and retry
- Eventually falls back to mock after max retries
- Check logs show retry pattern


COMPLETION CHECKLIST
====================

After all 3 steps:

□ Pipeline has 6 stages (including explanation)
□ Explanation agent runs after roadmap
□ OpenAI tool calling produces rich explanations
□ Retry logic handles rate limits
□ Tests pass
□ Logs show clear pipeline status
□ No breaking changes from refactor

Expected total time: 3-4 hours of development


TESTING GUIDE
=============

Test Step 1 (Orchestrator Integration):
  python -m backend.ai_v2.main_pipeline
  # Should see: "Stage 6: Running Explanation Agent"

Test Step 2 (Tool Calling):
  # With tool calling enabled:
  # Should see tool execution logs
  # Explanation should reference tool outputs

Test Step 3 (Retry Logic):
  # Simulate rate limit:
  # Should see "[RETRY]" messages
  # Should eventually fallback

Full pipeline test:
  python -m backend.ai_v2.test_integration
  # All 6 stages should complete
  # No errors
  # Explanation should be present


GIT WORKFLOW
============

Suggested commit messages:

  git add backend/ai_v2/orchestrator.py backend/ai_v2/config.py
  git commit -m "feat: integrate explanation agent into pipeline (stage 6)"

  git add backend/ai_v2/agents/explanation_agent.py
  git commit -m "feat: implement openai tool calling for explanations"

  git add backend/ai_v2/services/llm.py backend/ai_v2/config.py
  git commit -m "feat: add retry logic with exponential backoff for rate limits"


QUESTIONS?
==========

Refer to:
- REFACTOR_COMPLETE.md - Detailed background
- backend/ai_v2/agents/explanation_agent.py - Comments in hooks
- backend/ai_v2/services/llm.py - Updated LLM patterns
- backend/ai_v2/utils/fallback_utils.py - Utility reference
"""
