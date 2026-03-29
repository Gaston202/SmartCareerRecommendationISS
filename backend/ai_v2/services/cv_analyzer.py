"""
CV Analysis Service with Evidence Extraction.

Analyzes CV text to extract:
- Skills (technical and soft)
- Projects with descriptions
- Educational background
- Work experience
- Improvements with specific examples from CV text
- Inferred interests based on CV content
"""

from typing import Optional, List, Dict, Any
import re
from ..utils import get_logger
from ..services import LLMService
from ..schemas.quiz_schemas import (
    CVAnalysisResponse,
    CVImprovement,
    UserProfileSchema,
)

logger = get_logger(__name__)


class CVAnalyzer:
    """Analyzes CV text to extract evidence and generate improvements."""

    # Common technical skills to look for
    TECHNICAL_SKILLS = {
        "languages": ["python", "java", "javascript", "typescript", "c++", "c#", "go", "rust", 
                      "php", "swift", "kotlin", "r", "matlab", "scala", "ruby", "perl"],
        "web": ["react", "angular", "vue", "node.js", "express", "django", "flask", "fastapi",
                "asp.net", "wordpress", "html", "css", "sass", "webpack"],
        "databases": ["sql", "postgresql", "mysql", "mongodb", "redis", "elasticsearch",
                      "cassandra", "oracle", "dynamodb", "firebase"],
        "cloud": ["aws", "azure", "gcp", "heroku", "docker", "kubernetes", "terraform",
                  "jenkins", "github", "gitlab", "bitbucket"],
        "data": ["pandas", "numpy", "scikit-learn", "tensorflow", "pytorch", "spark",
                 "tableau", "power bi", "excel", "stata", "sql"],
        "tools": ["git", "github", "gitlab", "jira", "confluence", "slack", "figma", "sketch"],
    }

    def __init__(self):
        """Initialize the CV analyzer."""
        self.llm = LLMService()

    def analyze(
        self,
        cv_text: str,
        current_profile: Optional[UserProfileSchema] = None,
    ) -> CVAnalysisResponse:
        """
        Analyze CV and extract evidence.
        
        Args:
            cv_text: Full CV text
            current_profile: Current profile from quiz (optional, for context)
        
        Returns:
            CVAnalysisResponse with extracted information and improvements
        """
        try:
            logger.info("Starting CV analysis")
            
            # Extract sections
            sections = self._extract_sections(cv_text)
            
            # Extract skills
            extracted_skills = self._extract_skills(cv_text)
            
            # Extract projects
            projects = self._extract_projects(cv_text, sections.get("projects", ""))
            
            # Extract experience
            experience = self._extract_experience(cv_text, sections.get("experience", ""))
            
            # Extract education
            education = self._extract_education(cv_text, sections.get("education", ""))
            
            # Generate improvements with LLM
            improvements = self._generate_improvements(cv_text, sections)
            
            # Infer profile attributes from CV
            profile_updates = self._infer_profile(
                cv_text, extracted_skills, projects, experience, education
            )
            
            # Determine strengths from CV
            strengths = self._identify_strengths(
                extracted_skills, projects, experience, education
            )
            
            # Create summary
            summary = self._create_summary(
                extracted_skills, projects, experience, strengths
            )
            
            return CVAnalysisResponse(
                success=True,
                data={
                    "summary": summary,
                    "strengths": strengths,
                    "improvements": [imp.model_dump() for imp in improvements],
                    "extracted_evidence": {
                        "skills": extracted_skills,
                        "projects": [p.get("title", "") for p in projects],
                        "experience": [e.get("title", "") for e in experience],
                        "education": [e.get("degree", "") for e in education],
                    },
                    "profile_updates": profile_updates,
                }
            )
            
        except Exception as e:
            logger.error(f"CV analysis failed: {e}", exc_info=True)
            return CVAnalysisResponse(
                success=False,
                error=f"CV analysis failed: {str(e)}"
            )

    def _extract_sections(self, cv_text: str) -> Dict[str, str]:
        """Extract major sections from CV."""
        sections = {}
        
        # Common section headers
        section_patterns = {
            "experience": r"(?:experience|work history|professional experience)(.*?)(?=\n(?:education|projects|skills|certification|volunteer|contact|$))",
            "education": r"(?:education|academic)(.*?)(?=\n(?:experience|projects|skills|certification|volunteer|contact|$))",
            "projects": r"(?:projects?|portfolio)(.*?)(?=\n(?:experience|education|skills|certification|volunteer|contact|$))",
            "skills": r"(?:skills?|technologies?|technical skills)(.*?)(?=\n(?:experience|education|projects|certification|volunteer|contact|$))",
            "certifications": r"(?:certification|certifications?|licenses?)(.*?)(?=\n(?:experience|education|projects|skills|volunteer|contact|$))",
        }
        
        for section_name, pattern in section_patterns.items():
            match = re.search(pattern, cv_text, re.IGNORECASE | re.DOTALL)
            if match:
                sections[section_name] = match.group(1).strip()
        
        return sections

    def _extract_skills(self, cv_text: str) -> List[str]:
        """Extract technical and soft skills from CV."""
        skills = []
        cv_lower = cv_text.lower()
        
        # Check for technical skills
        for category, skill_list in self.TECHNICAL_SKILLS.items():
            for skill in skill_list:
                if skill in cv_lower and skill not in skills:
                    skills.append(skill.title())
        
        # Extract from skills section if present
        skills_section_match = re.search(
            r"(?:^|\n)(?:skills?|technologies?)[\s:\-]*\n(.*?)(?=\n(?:[A-Z]|$))",
            cv_text,
            re.IGNORECASE | re.MULTILINE | re.DOTALL
        )
        
        if skills_section_match:
            skills_text = skills_section_match.group(1)
            # Split by common delimiters
            extracted = re.split(r'[,\n•·]\s*', skills_text)
            for skill in extracted:
                skill = skill.strip()
                if skill and len(skill) > 1 and skill not in skills:
                    skills.append(skill)
        
        return list(set(skills))[:20]  # Return top 20, deduplicated

    def _extract_projects(self, cv_text: str, projects_section: str) -> List[Dict[str, str]]:
        """Extract project descriptions from CV."""
        projects = []
        
        # If we have a projects section, parse it
        if projects_section:
            # Split by common bullet points or line breaks
            project_lines = re.split(r'\n\s*[-•*]\s*|\n(?=[A-Z])', projects_section)
            
            for line in project_lines:
                line = line.strip()
                if line and len(line) > 10:
                    projects.append({
                        "title": line.split('\n')[0][:100],  # First 100 chars as title
                        "description": line,
                    })
        
        # Also extract from experience section (often contains project descriptions)
        experience_section = re.search(
            r"(?:experience|work history)(.*?)(?=\n(?:education|projects|skills|$))",
            cv_text,
            re.IGNORECASE | re.DOTALL
        )
        
        if experience_section:
            lines = experience_section.group(1).split('\n')
            current_project = None
            for line in lines:
                line = line.strip()
                # Look for bullet points or descriptions
                if line.startswith(('-', '•', '*')) or (current_project and line):
                    if not any(project["title"] == line for project in projects):
                        projects.append({
                            "title": line[:100],
                            "description": line,
                        })
        
        return projects[:10]  # Return top 10 projects

    def _extract_experience(self, cv_text: str, experience_section: str) -> List[Dict[str, str]]:
        """Extract work experience from CV."""
        experiences = []
        
        if experience_section:
            # Split by date patterns or role titles
            lines = experience_section.split('\n')
            for i, line in enumerate(lines):
                line = line.strip()
                # Look for role titles (usually followed by dates or company)
                if line and len(line) > 5 and not line.startswith('-'):
                    if re.search(r'\d{4}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec', 
                                line, re.IGNORECASE):
                        experiences.append({
                            "title": line[:150],
                            "description": '\n'.join(lines[max(0, i-1):min(len(lines), i+3)])
                        })
        
        return experiences[:5]  # Top 5 experiences

    def _extract_education(self, cv_text: str, education_section: str) -> List[Dict[str, str]]:
        """Extract education from CV."""
        education = []
        
        if education_section:
            # Look for degrees
            degree_patterns = [
                r"(?:bachelor|b\.?s\.?|b\.?a\.?)",
                r"(?:master|m\.?s\.?|m\.?a\.?|m\.?b\.?a\.?)",
                r"(?:phd|ph\.?d\.?)",
                r"(?:associate|diploma|certificate)",
            ]
            
            lines = education_section.split('\n')
            for line in lines:
                line = line.strip()
                for pattern in degree_patterns:
                    if re.search(pattern, line, re.IGNORECASE):
                        # Extract degree and field
                        match = re.search(
                            rf"({pattern}[^,\n]*(?:in|of)?\s*([^,\n\d]*))",
                            line,
                            re.IGNORECASE
                        )
                        if match:
                            education.append({
                                "degree": match.group(1).strip(),
                                "field": match.group(2).strip() if match.lastindex >= 2 else "",
                                "full": line,
                            })
                        break
        
        return education[:5]

    def _generate_improvements(
        self,
        cv_text: str,
        sections: Dict[str, str]
    ) -> List[CVImprovement]:
        """Generate specific improvement suggestions using LLM."""
        improvements = []
        
        try:
            # Check for common issues
            
            # Issue 1: Vague project descriptions
            project_section = sections.get("projects", "")
            if project_section:
                vague_projects = re.findall(
                    r'(?:developed|built|created|worked on)\s+([^\.!?\n]{20,100})',
                    project_section,
                    re.IGNORECASE
                )
                
                if vague_projects:
                    for project in vague_projects[:2]:  # Top 2 vague projects
                        improvements.append(CVImprovement(
                            issue="Project description lacks specificity and impact",
                            evidence_from_cv=f"'{project}' - project mentioned without clear scope or results",
                            why_it_matters="Recruiters need to understand project scope, technologies used, and measurable outcomes",
                            improved_example=f"Developed {project} using [specific technologies] that [achieved specific result]. [Add metrics if possible, e.g., 'used by X users' or 'reduced time by Y%']",
                            section="projects"
                        ))
            
            # Issue 2: Missing metrics in experience
            experience_section = sections.get("experience", "")
            if experience_section and not re.search(r'\d+%|increased|reduced|grew|saved', 
                                                   experience_section, re.IGNORECASE):
                improvements.append(CVImprovement(
                    issue="Experience descriptions lack quantifiable achievements",
                    evidence_from_cv="Experience section describes responsibilities but not measurable results",
                    why_it_matters="Quantified results demonstrate impact and value delivered",
                    improved_example="Instead of 'Responsible for X', write 'Implemented X solution that increased efficiency by 40%' or 'Delivered 15+ features impacting 10k+ users'",
                    section="experience"
                ))
            
            # Issue 3: Weak action verbs
            if experience_section or project_section:
                weak_verbs = ["responsible for", "involved in", "helped", "assisted", "participated in"]
                content = f"{experience_section} {project_section}".lower()
                found_weak = [v for v in weak_verbs if v in content]
                
                if found_weak:
                    improvements.append(CVImprovement(
                        issue=f"Using weak action verbs like '{found_weak[0]}'",
                        evidence_from_cv=f"Found phrase '{found_weak[0]}' in CV content",
                        why_it_matters="Strong action verbs (Led, Built, Achieved, Delivered) show initiative and impact",
                        improved_example=f"Replace '{found_weak[0]}' with stronger verbs: Led, Built, Architected, Delivered, Scaled, Optimized, Achieved",
                        section="all"
                    ))
            
            # Issue 4: Technical skills not demonstrated
            skills_section = sections.get("skills", "")
            experience_section = sections.get("experience", "")
            
            # Extract skills mentioned
            mentioned_skills = re.findall(r'\b([\w\+\.#]+)\b', skills_section, re.IGNORECASE)
            demonstrated = experience_section.lower()
            
            undocumented = []
            for skill in mentioned_skills[:5]:  # Check top 5 skills
                if skill.lower() not in demonstrated:
                    undocumented.append(skill)
            
            if undocumented:
                improvements.append(CVImprovement(
                    issue=f"Listed skills not demonstrated with examples",
                    evidence_from_cv=f"Skills section lists {undocumented[0]} but no project or experience shows usage",
                    why_it_matters="Recruiters want to see proof that you can actually use the skills you claim",
                    improved_example=f"Add a project or experience bullet showing {undocumented[0]} in action, e.g., 'Built [project] using {undocumented[0]}'",
                    section="skills"
                ))
            
        except Exception as e:
            logger.warning(f"Error generating improvements: {e}")
        
        return improvements

    def _infer_profile(
        self,
        cv_text: str,
        skills: List[str],
        projects: List[Dict[str, str]],
        experience: List[Dict[str, str]],
        education: List[Dict[str, str]],
    ) -> Dict[str, Any]:
        """Infer profile attributes from CV evidence."""
        profile_updates = {
            "interests": [],
            "skills": skills,
            "strengths": [],
            "work_preferences": [],
        }
        
        # Infer interests from project types and experience
        project_text = ' '.join([p.get("description", "") for p in projects])
        experience_text = ' '.join([e.get("description", "") for e in experience])
        combined = f"{project_text} {experience_text}".lower()
        
        # Interest inference
        if any(term in combined for term in ["web", "frontend", "ui", "interface"]):
            profile_updates["interests"].append("web development")
            profile_updates["interests"].append("user experience")
        
        if any(term in combined for term in ["backend", "api", "server", "database"]):
            profile_updates["interests"].append("backend development")
            profile_updates["interests"].append("system design")
        
        if any(term in combined for term in ["data", "machine learning", "ai", "analytics"]):
            profile_updates["interests"].append("data science")
            profile_updates["interests"].append("analytics")
        
        if any(term in combined for term in ["healthcare", "medical", "hospital", "patient"]):
            profile_updates["interests"].append("healthcare technology")
        
        if any(term in combined for term in ["devops", "cloud", "infrastructure", "deploy"]):
            profile_updates["interests"].append("infrastructure")
            profile_updates["interests"].append("DevOps")
        
        # Work preference inference
        if "team" in combined or "collaborate" in combined:
            profile_updates["work_preferences"].append("collaborative")
        
        if "led" in combined or "managed" in combined:
            profile_updates["work_preferences"].append("leadership")
        
        if "independent" in combined or "autonomous" in combined:
            profile_updates["work_preferences"].append("autonomous")
        
        return profile_updates

    def _identify_strengths(
        self,
        skills: List[str],
        projects: List[Dict[str, str]],
        experience: List[Dict[str, str]],
        education: List[Dict[str, str]],
    ) -> List[str]:
        """Identify strengths based on CV evidence."""
        strengths = []
        
        # Skills-based strengths
        if len(skills) > 5:
            strengths.append("technical versatility")
        
        if any(skill in [s.lower() for s in skills] for skill in 
               ["python", "java", "javascript", "c++", "go", "rust"]):
            strengths.append("software development")
        
        if any(skill in [s.lower() for s in skills] for skill in 
               ["react", "vue", "angular", "html", "css"]):
            strengths.append("web development")
        
        # Project-based strengths
        if len(projects) > 3:
            strengths.append("project implementation")
            strengths.append("initiative")
        
        # Experience-based strengths
        if len(experience) > 0:
            strengths.append("professional experience")
        
        # Education-based strengths
        if any("advanced" in e.get("degree", "").lower() for e in education):
            strengths.append("advanced learning")
        
        return list(set(strengths))

    def _create_summary(
        self,
        skills: List[str],
        projects: List[Dict[str, str]],
        experience: List[Dict[str, str]],
        strengths: List[str],
    ) -> str:
        """Create a summary of CV analysis."""
        parts = []
        
        if skills:
            parts.append(f"Strong technical foundation with {len(skills)} skills including {', '.join(skills[:3])}")
        
        if projects:
            parts.append(f"Demonstrated {len(projects)} projects showcasing practical implementation")
        
        if experience:
            parts.append(f"{len(experience)} years/roles of professional experience")
        
        if strengths:
            parts.append(f"Key strengths: {', '.join(strengths[:3])}")
        
        return ". ".join(parts) if parts else "CV with technical background"
