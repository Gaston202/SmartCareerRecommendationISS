"""
Quick test script for CV Agent with ATS scoring.

Run with: python -m backend.ai_v2.test_cv_agent
"""

from agents.cv_agent import CVAgent
from schemas import AgentType

# Sample CVs for testing
GOOD_CV = """
JOHN SMITH
Email: john@example.com | LinkedIn: linkedin.com/in/johnsmith

PROFESSIONAL SUMMARY
Senior Software Engineer with 5+ years of experience in Python, Java, and cloud technologies.

TECHNICAL SKILLS
• Programming Languages: Python, Java, JavaScript, SQL
• Frameworks: Django, FastAPI, React, Spring Boot
• Databases: PostgreSQL, MongoDB, Redis
• Cloud: AWS, Google Cloud Platform, Azure
• DevOps: Docker, Kubernetes, Jenkins, Git
• Other: Linux, Unix, RESTful APIs, GraphQL

PROFESSIONAL EXPERIENCE

Senior Backend Engineer | Tech Corp (2021 - Present)
• Led development of microservices architecture using Python and FastAPI
• Designed and implemented Redis caching layer reducing response time by 40%
• Managed Kubernetes deployments for 5+ production services
• Mentored junior developers and conducted code reviews

Software Engineer | StartupXYZ (2019 - 2021)
• Built full-stack web applications using Django and React
• Implemented PostgreSQL database optimization queries
• Developed CI/CD pipelines using Docker and Jenkins
• Collaborated with cross-functional teams using Agile/Scrum methodology

Junior Developer | WebAgency (2018 - 2019)
• Developed customer-facing web applications
• Participated in code reviews and testing
• Learned best practices in software development

EDUCATION
Bachelor of Science in Computer Science | State University (2018)
GPA: 3.8/4.0

CERTIFICATIONS
• AWS Certified Solutions Architect - Professional
• Kubernetes Application Developer

PROJECTS
• Open Source Contribution: Django-REST-Framework (100+ commits)
• Personal Project: AI Career Recommendation System (Python, FastAPI, PostgreSQL)
"""

POOR_CV = """
Experience
I worked at different companies doing programming. I know some programming languages like Python and Java. 
I worked with databases and made some web applications.

Education
I went to a college and studied computer science.

Skills
Python, Java, some web development stuff
"""

MEDIUM_CV = """
Alex Johnson
alex.johnson@email.com

SUMMARY
Software Developer with 2 years of experience

SKILLS
Python, JavaScript, SQL, HTML, CSS, Git

EXPERIENCE
Developer at Company A (2022-2024)
- Built web applications
- Fixed bugs
- Worked with team

EDUCATION
Bachelor's in Computer Science (2022)
"""


def test_cv_agent():
    """Test CV Agent with sample CVs."""
    agent = CVAgent()
    
    print("=" * 70)
    print("CV AGENT ATS SCORING TEST")
    print("=" * 70)
    
    test_cases = [
        ("GOOD CV (Senior Engineer)", GOOD_CV),
        ("POOR CV (Minimal)", POOR_CV),
        ("MEDIUM CV (Junior Developer)", MEDIUM_CV),
    ]
    
    for test_name, cv_text in test_cases:
        print(f"\n\n{'=' * 70}")
        print(f"TEST: {test_name}")
        print(f"{'=' * 70}")
        
        result = agent.run({"cv_text": cv_text})
        
        print(f"\n✓ Success: {result.success}")
        
        if result.success:
            data = result.data
            
            # Display basic info
            print(f"\nCV Provided: {data.get('cv_provided')}")
            
            # Display skills found
            skills = data.get("skills_extracted", [])
            print(f"\nSkills Found ({len(skills)}): {', '.join(skills[:10])}")
            if len(skills) > 10:
                print(f"  ... and {len(skills) - 10} more")
            
            # Display ATS Score (main result)
            ats_score = data.get("ats_score", 0)
            print(f"\n{'─' * 50}")
            print(f"ATS SCORE: {ats_score}/100")
            print(f"{'─' * 50}")
            
            # Display breakdown
            breakdown = data.get("ats_breakdown", {})
            print("\nSCORE BREAKDOWN:")
            for component, details in breakdown.items():
                component_name = component.replace("_", " ").title()
                score = details.get("score")
                weight = details.get("weight")
                value = details.get("component_value")
                detail_text = details.get("details", "")
                
                print(f"\n  {component_name}")
                print(f"    Score: {score}/100")
                print(f"    Weight: {weight}%")
                print(f"    Contribution: {value} points")
                print(f"    Details: {detail_text}")
            
            # Display suggestions
            suggestions = data.get("ats_suggestions", [])
            print(f"\n{'─' * 50}")
            print("IMPROVEMENT SUGGESTIONS:")
            for i, suggestion in enumerate(suggestions, 1):
                print(f"  {i}. {suggestion}")
            
        else:
            print(f"\n✗ Error: {result.error}")
    
    print(f"\n\n{'=' * 70}")
    print("TEST COMPLETED")
    print(f"{'=' * 70}\n")


def test_empty_cv():
    """Test with missing CV."""
    agent = CVAgent()
    
    print("\n" + "=" * 70)
    print("TEST: EMPTY/MISSING CV")
    print("=" * 70)
    
    result = agent.run({"cv_text": None})
    
    print(f"✓ Success: {result.success}")
    print(f"CV Provided: {result.data.get('cv_provided')}")
    print("(Should gracefully handle missing CV)")


if __name__ == "__main__":
    test_cv_agent()
    test_empty_cv()
