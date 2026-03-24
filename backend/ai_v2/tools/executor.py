"""
Tool executor for LLM function calling.

Implements the actual tool functions that the LLM can call.
Bridges LLM decisions with expert systems and knowledge base.
"""

from typing import Any, Dict, List
from ..utils import get_logger
from ..services.fallback_utils import safe_extract_strings

logger = get_logger(__name__)


class ToolExecutor:
    """
    Executes tools called by LLM during tool-calling mode.
    
    Each tool maps to a retrieval or analysis function that provides
    concrete data to inform the LLM's recommendations.
    """
    
    def __init__(self, rag_retriever=None):
        """
        Initialize tool executor.
        
        Args:
            rag_retriever: Optional RAG retriever for knowledge base queries
        """
        self.retriever = rag_retriever
        self.logger = get_logger(__name__)
    
    def execute(self, tool_name: str, tool_input: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a tool with given input.
        
        Args:
            tool_name (str): Name of the tool to execute
            tool_input (Dict[str, Any]): Input parameters for the tool
            
        Returns:
            Dict: Tool result with success status and data
        """
        tool_method = getattr(self, f"_execute_{tool_name}", None)
        
        if not tool_method:
            return {
                "success": False,
                "error": f"Unknown tool: {tool_name}",
                "data": None
            }
        
        try:
            self.logger.info(f"Executing tool: {tool_name}")
            result = tool_method(tool_input)
            return {
                "success": True,
                "error": None,
                "data": result
            }
        except Exception as e:
            self.logger.error(f"Error executing tool {tool_name}: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "data": None
            }
    
    # ========================================================================
    # Tool Implementations
    # ========================================================================
    
    def _execute_extract_skills_from_profile(self, tool_input: Dict[str, Any]) -> Dict[str, Any]:
        """Extract structured skill data from user profile and CV."""
        user_id = tool_input.get("user_id")
        include_proficiency = tool_input.get("include_proficiency", True)
        
        self.logger.debug(f"Extracting skills for user: {user_id}")
        
        # TODO: In production, query actual user profile from database
        # For now, return mock data
        return {
            "user_id": user_id,
            "skills": [
                {"name": "Python", "proficiency": "expert", "years": 5} if include_proficiency else "Python",
                {"name": "JavaScript", "proficiency": "intermediate", "years": 2} if include_proficiency else "JavaScript",
                {"name": "SQL", "proficiency": "intermediate", "years": 3} if include_proficiency else "SQL",
                {"name": "Docker", "proficiency": "intermediate", "years": 1} if include_proficiency else "Docker",
            ],
            "total_skills": 4,
            "strongest_area": "Backend Development",
            "source": "extracted_from_cv"
        }
    
    def _execute_get_career_requirements(self, tool_input: Dict[str, Any]) -> Dict[str, Any]:
        """Get required skills and competencies for a career role."""
        career_role = tool_input.get("career_role")
        include_salary = tool_input.get("include_salary", False)
        
        self.logger.debug(f"Retrieving requirements for: {career_role}")
        
        # Query RAG if available
        if self.retriever:
            results = self.retriever.retrieve(
                query=f"skills required for {career_role}",
                top_k=3
            )
            if results:
                return {
                    "career_role": career_role,
                    "required_skills": [r.get("content", "") for r in results],
                    "experience_level": "mid",
                    "salary_range": "$120k - $180k" if include_salary else None,
                    "source": "knowledge_base"
                }
        
        # Fallback to mock data
        career_requirements = {
            "Backend Engineer": {
                "skills": ["Python", "SQL", "Docker", "REST APIs", "System Design"],
                "level": "mid",
                "salary": "$120k - $180k"
            },
            "Data Scientist": {
                "skills": ["Python", "Statistics", "SQL", "Machine Learning", "Data Visualization"],
                "level": "mid",
                "salary": "$110k - $170k"
            },
            "DevOps Engineer": {
                "skills": ["Docker", "Kubernetes", "AWS", "CI/CD", "Infrastructure as Code"],
                "level": "mid",
                "salary": "$130k - $190k"
            },
        }
        
        role_data = career_requirements.get(career_role, career_requirements["Backend Engineer"])
        
        return {
            "career_role": career_role,
            "required_skills": role_data["skills"],
            "experience_level": role_data["level"],
            "salary_range": role_data["salary"] if include_salary else None,
            "source": "predefined_requirements"
        }
    
    def _execute_compute_skill_gap(self, tool_input: Dict[str, Any]) -> Dict[str, Any]:
        """Compute skill gaps between current and required skills."""
        current_skills = safe_extract_strings(tool_input.get("current_skills", []))
        required_skills = safe_extract_strings(tool_input.get("required_skills", []))
        include_learning_time = tool_input.get("include_learning_time", True)
        
        self.logger.debug(f"Computing gap: current={len(current_skills)}, required={len(required_skills)}")
        
        # Calculate gaps
        current_lower = [s.lower() for s in current_skills]
        missing_skills = [s for s in required_skills if s.lower() not in current_lower]
        matching_skills = [s for s in current_skills if s.lower() in [r.lower() for r in required_skills]]
        
        # Estimate learning time (mock)
        skill_learning_times = {
            "basic": 1,  # month
            "intermediate": 3,
            "advanced": 6,
        }
        
        gaps_with_time = []
        for skill in missing_skills:
            difficulty = "basic" if len(skill) < 10 else ("intermediate" if len(skill) < 20 else "advanced")
            gaps_with_time.append({
                "skill": skill,
                "difficulty": difficulty,
                "estimated_months": skill_learning_times.get(difficulty, 3)
            })
        
        return {
            "matching_skills": matching_skills,
            "missing_skills": missing_skills,
            "gap_percentage": round((len(missing_skills) / len(required_skills) * 100) if required_skills else 0),
            "match_percentage": round((len(matching_skills) / len(required_skills) * 100) if required_skills else 0),
            "skill_details": gaps_with_time if include_learning_time else missing_skills,
            "total_learning_months": sum(g["estimated_months"] for g in gaps_with_time) if include_learning_time else None,
        }
    
    def _execute_generate_learning_roadmap(self, tool_input: Dict[str, Any]) -> Dict[str, Any]:
        """Generate a structured learning roadmap."""
        target_role = tool_input.get("target_role")
        missing_skills = safe_extract_strings(tool_input.get("missing_skills", []))
        current_level = tool_input.get("current_level", "mid")
        
        self.logger.debug(f"Generating roadmap for {target_role}: {len(missing_skills)} skills to learn")
        
        # Create phased roadmap
        phase_size = (len(missing_skills) + 2) // 3  # Divide into 3 phases
        phases = []
        
        for i in range(0, len(missing_skills), phase_size):
            phase_num = (i // phase_size) + 1
            phase_skills = missing_skills[i:i+phase_size]
            
            phases.append({
                "phase": phase_num,
                "title": ["Foundation", "Intermediate", "Advanced"][min(phase_num-1, 2)],
                "skills": phase_skills,
                "duration_months": 2 + phase_num,
                "milestones": [
                    f"Complete {skill} foundational course" for skill in phase_skills[:2]
                ] + ["Build portfolio project"]
            })
        
        return {
            "target_role": target_role,
            "current_level": current_level,
            "phases": phases,
            "total_months": sum(p["duration_months"] for p in phases),
            "resources_needed": ["Online courses", "Documentation", "Practice projects", "Mentorship"],
            "success_criteria": [
                "Complete all phases",
                "Build 2-3 portfolio projects",
                "Contribute to open source",
                "Interview prep with mock interviews"
            ]
        }
    
    def _execute_retrieve_career_resources(self, tool_input: Dict[str, Any]) -> Dict[str, Any]:
        """Retrieve learning resources from knowledge base."""
        query = tool_input.get("query")
        resource_type = tool_input.get("resource_type", "all")
        limit = tool_input.get("limit", 5)
        
        self.logger.debug(f"Retrieving {resource_type} resources for: {query}")
        
        # Query RAG if available
        if self.retriever:
            results = self.retriever.retrieve(query=query, top_k=limit)
            if results:
                return {
                    "query": query,
                    "resource_type": resource_type,
                    "resources": results,
                    "count": len(results),
                    "source": "knowledge_base"
                }
        
        # Fallback to mock resources
        all_resources = [
            {
                "title": f"Master {query} in 30 Days",
                "type": "course",
                "platform": "Udemy",
                "url": f"https://udemy.com/{query.lower()}",
                "rating": 4.8,
                "duration_hours": 40
            },
            {
                "title": f"Official {query} Documentation",
                "type": "article",
                "platform": "Official Docs",
                "url": f"https://docs.example.com/{query.lower()}",
                "rating": 5.0,
                "duration_hours": None
            },
            {
                "title": f"{query} Tutorial Series",
                "type": "tutorial",
                "platform": "YouTube",
                "url": f"https://youtube.com/results?search_query={query.lower()}",
                "rating": 4.7,
                "duration_hours": 20
            },
            {
                "title": f"Build with {query} - Project Guide",
                "type": "project",
                "platform": "GitHub",
                "url": f"https://github.com/search?q={query.lower()}",
                "rating": 4.6,
                "duration_hours": 15
            },
            {
                "title": f"{query} Community Forum",
                "type": "community",
                "platform": "Stack Overflow",
                "url": f"https://stackoverflow.com/questions/tagged/{query.lower()}",
                "rating": 4.5,
                "duration_hours": None
            },
        ]
        
        # Filter by resource type
        if resource_type != "all":
            resources = [r for r in all_resources if r["type"] == resource_type][:limit]
        else:
            resources = all_resources[:limit]
        
        return {
            "query": query,
            "resource_type": resource_type,
            "resources": resources,
            "count": len(resources),
            "source": "predefined_resources"
        }
