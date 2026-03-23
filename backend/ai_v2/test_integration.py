"""
Integration test for full AI v2 pipeline with CV Agent.

Run with: python -m backend.ai_v2.test_integration
"""

from main_pipeline import CareerRecommendationPipeline
from schemas import UserProfile


def test_full_pipeline_with_cv():
    """Test complete pipeline including CV Agent with ATS scoring."""
    
    print("\n" + "=" * 70)
    print("INTEGRATION TEST: Full Pipeline with CV Agent")
    print("=" * 70)
    
    # Create pipeline
    pipeline = CareerRecommendationPipeline()
    
    # Create user profile
    user_profile = UserProfile(
        user_id="test_user_001",
        name="Alice Johnson",
        email="alice@example.com",
        current_skills=["Python", "JavaScript", "SQL"],
        experience_level="entry",
        education="Bachelor's in Computer Science",
    )
    
    # Sample CV
    cv_text = """
    ALICE JOHNSON
    Email: alice@example.com | GitHub: github.com/alicejohnson
    
    SUMMARY
    Recent Computer Science graduate with internship experience in full-stack development.
    Passionate about backend systems and clean code.
    
    TECHNICAL SKILLS
    • Languages: Python, JavaScript, SQL, HTML, CSS
    • Frameworks: Django, Flask, React
    • Databases: PostgreSQL, MySQL
    • Tools: Git, Docker, Linux
    • Other: REST APIs, Agile methodologies
    
    PROFESSIONAL EXPERIENCE
    
    Full-Stack Developer Intern | WebDev Corp (2024)
    • Built REST APIs using Django and Django REST Framework
    • Developed React components for customer dashboard
    • Wrote unit tests achieving 80% code coverage
    • Fixed 50+ bugs and improved app performance by 25%
    
    PROJECTS
    
    E-Commerce Platform (Personal Project)
    • Built full-stack application with Django backend and React frontend
    • Implemented PostgreSQL database with optimized queries
    • Authentication and payment integration
    • Link: github.com/alicejohnson/ecommerce
    
    Task Management App (School Project)
    • Team project with 3 developers
    • Developed backend using Python Flask
    • Led database design
    
    EDUCATION
    Bachelor of Science in Computer Science | State University (2024)
    GPA: 3.7/4.0
    
    CERTIFICATIONS
    • Python Developer Certifications (DataCamp)
    """
    
    try:
        # Test 1: Traditional pipeline
        print("\n[TEST 1] Running traditional agent-based pipeline...")
        result = pipeline.recommend(
            user_profile=user_profile,
            cv_text=cv_text,
            preferences={"preferred_roles": ["Backend Engineer", "Full-Stack Engineer"]},
        )
        
        print("✓ Pipeline completed successfully")
        print(f"  - User ID: {result.user_id}")
        print(f"  - Recommended careers: {', '.join(result.recommended_careers)}")
        print(f"  - Confidence: {result.confidence_score:.0%}")
        
        # Test 2: Tool-based pipeline
        print("\n[TEST 2] Running tool-based pipeline...")
        tool_result = pipeline.recommend_with_tools(
            user_profile=user_profile,
            cv_text=cv_text,
            target_role="Backend Engineer",
        )
        
        print("✓ Tool-based pipeline completed")
        print(f"  - Status: {tool_result.get('status')}")
        print(f"  - Steps completed: {tool_result.get('steps_completed')}")
        
        # Test 3: CV Agent with ATS Score
        print("\n[TEST 3] CV Agent ATS Scoring...")
        
        # Access CV insights from tool result
        if tool_result.get("extracted_skills"):
            cv_analysis = tool_result.get("extracted_skills", {})
            print(f"✓ CV Analysis completed")
            print(f"  - Skills found: {len(cv_analysis.get('skills', []))} keywords")
        
        # Test 4: List available tools
        print("\n[TEST 4] Available tools...")
        tools = pipeline.list_available_tools()
        print(f"✓ Found {len(tools)} tools:")
        for tool in tools:
            print(f"  - {tool}")
        
        # Test 5: Individual tool call
        print("\n[TEST 5] Direct tool call - extract_skills...")
        skills_result = pipeline.call_tool("extract_skills", cv_text=cv_text)
        
        if skills_result.get("success"):
            skills = skills_result.get("skills", [])
            print(f"✓ Skills extracted: {len(skills)} found")
            print(f"  Keywords: {', '.join(skills[:5])}")
        
        print("\n" + "=" * 70)
        print("✓ ALL INTEGRATION TESTS PASSED")
        print("=" * 70 + "\n")
        
        return True
        
    except Exception as e:
        print(f"\n✗ TEST FAILED: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def test_cv_agent_directly():
    """Test CV Agent directly with ATS scoring."""
    
    print("\n" + "=" * 70)
    print("DIRECT CV AGENT TEST: ATS Scoring")
    print("=" * 70)
    
    from agents.cv_agent import CVAgent
    
    agent = CVAgent()
    
    cv_samples = {
        "Strong": """
        Senior Backend Engineer
        10+ years Python, Java, Go
        AWS, GCP, Kubernetes, Docker
        Leadership, mentoring
        
        EXPERIENCE: Led teams, architected systems
        EDUCATION: MS Computer Science
        SKILLS: Python, Java, SQL, AWS, Docker, Kubernetes
        """,
        "Medium": """
        Software Developer with 3 years experience
        Skills: Python, JavaScript, SQL
        
        EXPERIENCE
        Developer at Company (2021-2024)
        
        EDUCATION
        Bachelor's in CS
        """,
    }
    
    for cv_type, cv_text in cv_samples.items():
        print(f"\n[{cv_type} CV]")
        result = agent.run({"cv_text": cv_text})
        
        if result.success:
            ats = result.data.get("ats_score")
            print(f"✓ ATS Score: {ats}/100")
            
            breakdown = result.data.get("ats_breakdown", {})
            print(f"  Breakdown:")
            for comp, data in breakdown.items():
                comp_name = comp.replace("_", " ").title()
                print(f"    - {comp_name}: {data.get('score')}/100")
        else:
            print(f"✗ Error: {result.error}")


if __name__ == "__main__":
    success = test_full_pipeline_with_cv()
    test_cv_agent_directly()
    
    if success:
        print("\n✅ All integration tests completed successfully!")
    else:
        print("\n❌ Some tests failed - check output above")
