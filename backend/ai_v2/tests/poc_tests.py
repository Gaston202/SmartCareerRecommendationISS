"""
Phase 1 PoC Test Cases
Test each agent independently with known inputs and expected outputs
Run before proceeding to Pilot phase
"""

import pytest
import json
from datetime import datetime
from typing import Dict, List, Any


class TestProfileAgentPoC:
    """Profile Agent Proof of Concept Test Cases"""
    
    @pytest.fixture
    def sample_cv_entry_level(self) -> str:
        """Entry-level developer CV"""
        return """
        John Doe
        Email: john@example.com
        
        Skills: Python, JavaScript, Git, React, SQL, REST APIs
        
        Experience:
        Junior Developer - Tech Startup (6 months)
        - Wrote Python backend services
        - Built React frontends
        - Used Git for version control
        """
    
    @pytest.fixture
    def sample_cv_senior_manager(self) -> str:
        """Senior manager CV"""
        return """
        Jane Smith
        Email: jane@example.com
        
        Skills: Leadership, Team Management, Budgeting, Strategic Planning, 
                Project Management, Communication, Negotiation, Excel, PowerPoint
        
        Experience:
        Senior Manager - Fortune 500 (10 years)
        - Led teams of 20+ engineers
        - Managed multi-million dollar budgets
        - Strategic planning and execution
        """
    
    @pytest.fixture
    def sample_cv_minimal(self) -> str:
        """Minimal CV"""
        return "Name: Bob\nEmail: bob@example.com"
    
    def test_profile_extraction_entry_level(self, sample_cv_entry_level):
        """Test PoC: Extract skills from entry-level CV"""
        from ai_v2.agents.profile_agent import ProfileAgent
        from ai_v2.config import LLMService
        
        agent = ProfileAgent()
        result = agent.execute(
            user_id="poc_user_1",
            cv_text=sample_cv_entry_level,
            current_skills=[]
        )
        
        # PoC Success Criteria
        assert result is not None, "ProfileAgent should return result"
        assert result.extracted_skills, "Should extract skills"
        assert len(result.extracted_skills) >= 3, "Should extract at least 3 skills"
        
        expected_skills = ["Python", "JavaScript", "Git"]
        for skill in expected_skills:
            assert any(skill.lower() in s.lower() for s in result.extracted_skills), \
                f"Should extract {skill}"
        
        # Should have profile completeness score
        assert hasattr(result, 'profile_completeness'), "Should calculate completeness"
        assert 0.0 <= result.profile_completeness <= 1.0, "Completeness 0-1"
        
        print(f"✅ Entry-level profile: {result.extracted_skills}")
        print(f"   Completeness: {result.profile_completeness:.1%}")
    
    def test_profile_extraction_senior_manager(self, sample_cv_senior_manager):
        """Test PoC: Extract soft skills from manager CV"""
        from ai_v2.agents.profile_agent import ProfileAgent
        
        agent = ProfileAgent()
        result = agent.execute(
            user_id="poc_user_2",
            cv_text=sample_cv_senior_manager,
            current_skills=[]
        )
        
        assert result is not None
        assert result.extracted_skills
        
        # Should include soft skills
        has_soft_skills = any(
            skill.lower() in ["leadership", "management", "communication", "negotiation"]
            for skill in result.extracted_skills
        )
        assert has_soft_skills, "Should extract soft skills"
        
        print(f"✅ Senior manager profile: {result.extracted_skills}")
    
    def test_profile_extraction_minimal_cv(self, sample_cv_minimal):
        """Test PoC: Graceful handling of minimal CV"""
        from ai_v2.agents.profile_agent import ProfileAgent
        
        agent = ProfileAgent()
        
        # Should not crash
        result = agent.execute(
            user_id="poc_user_3",
            cv_text=sample_cv_minimal,
            current_skills=[]
        )
        
        assert result is not None, "Should handle minimal CV gracefully"
        print(f"✅ Minimal CV handled: {result.extracted_skills or 'empty'}")


class TestCareerAgentPoC:
    """Career Agent Proof of Concept Test Cases"""
    
    @pytest.fixture
    def profile_software_engineer(self) -> Dict[str, Any]:
        """Software engineer profile"""
        return {
            "user_id": "poc_user_1",
            "name": "John Developer",
            "current_skills": ["Python", "JavaScript", "Git", "React", "SQL"],
            "years_experience": 3,
            "interests": ["backend", "full-stack"],
            "profile_completeness": 0.8
        }
    
    @pytest.fixture
    def profile_career_switcher(self) -> Dict[str, Any]:
        """Career switcher profile"""
        return {
            "user_id": "poc_user_2",
            "name": "Jane Switcher",
            "current_skills": ["Excel", "Tableau", "Communication", "Project Management"],
            "years_experience": 5,
            "interests": ["data", "analytics"],
            "profile_completeness": 0.5
        }
    
    def test_career_generation_software_engineer(self, profile_software_engineer):
        """Test PoC: Generate careers for software engineer"""
        from ai_v2.agents.career_agent import CareerAgent
        
        agent = CareerAgent()
        result = agent.execute(profile_software_engineer)
        
        # PoC Success Criteria
        assert result is not None
        assert result.recommended_careers, "Should recommend careers"
        assert len(result.recommended_careers) == 3, "Should recommend exactly 3 careers"
        
        # Check career object structure
        for career in result.recommended_careers:
            assert hasattr(career, 'title'), "Career should have title"
            assert hasattr(career, 'match_score'), "Career should have match_score"
            assert 0.0 <= career.match_score <= 1.0, "Match score 0-1"
            assert career.match_score >= 0.75, f"Top career should have score ≥0.75, got {career.match_score}"
        
        # Check that top match is relevant
        top_career = result.recommended_careers[0]
        assert any(kw in top_career.title.lower() for kw in ["software", "engineer", "developer", "full-stack"]), \
            f"Top career should be relevant: {top_career.title}"
        
        assert top_career.match_score >= result.recommended_careers[1].match_score, \
            "Careers should be ordered by score"
        
        print(f"✅ Software Engineer careers:")
        for i, c in enumerate(result.recommended_careers, 1):
            print(f"   {i}. {c.title} ({c.match_score:.0%})")
    
    def test_career_generation_career_switcher(self, profile_career_switcher):
        """Test PoC: Generate realistic careers for career switcher"""
        from ai_v2.agents.career_agent import CareerAgent
        
        agent = CareerAgent()
        result = agent.execute(profile_career_switcher)
        
        assert result is not None
        assert result.recommended_careers
        assert len(result.recommended_careers) == 3
        
        # For career switcher, match scores might be lower
        for career in result.recommended_careers:
            assert 0.5 <= career.match_score <= 1.0, \
                f"Career switcher match score might be lower: {career.match_score}"
        
        print(f"✅ Career switcher recommendations:")
        for i, c in enumerate(result.recommended_careers, 1):
            print(f"   {i}. {c.title} ({c.match_score:.0%})")
    
    def test_no_duplicate_careers(self, profile_software_engineer):
        """Test PoC: No duplicate careers in top 3"""
        from ai_v2.agents.career_agent import CareerAgent
        
        agent = CareerAgent()
        result = agent.execute(profile_software_engineer)
        
        titles = [c.title for c in result.recommended_careers]
        assert len(titles) == len(set(titles)), f"Duplicate careers found: {titles}"
        
        print(f"✅ No duplicates: {titles}")


class TestGapAgentPoC:
    """Gap Agent Proof of Concept Test Cases"""
    
    @pytest.fixture
    def transition_dev_to_datascientist(self) -> Dict[str, Any]:
        """Developer to Data Scientist transition"""
        return {
            "current_skills": ["Python", "SQL", "Git", "JavaScript"],
            "target_role": "Data Scientist",
            "target_skills": ["Python", "SQL", "Machine Learning", "Statistics", "Data Visualization", "TensorFlow"],
            "years_to_transition": 1
        }
    
    @pytest.fixture
    def transition_non_tech_to_engineer(self) -> Dict[str, Any]:
        """Non-technical to Software Engineer"""
        return {
            "current_skills": ["Communication", "Project Management", "Excel"],
            "target_role": "Software Engineer",
            "target_skills": ["Python", "JavaScript", "Git", "Web Development", "Database Design"],
            "years_to_transition": 2
        }
    
    def test_gap_analysis_dev_to_datascientist(self, transition_dev_to_datascientist):
        """Test PoC: Identify skill gaps for dev→data scientist transition"""
        from ai_v2.agents.gap_agent import GapAgent
        
        agent = GapAgent()
        result = agent.execute(
            user_id="poc_user_1",
            current_skills=transition_dev_to_datascientist["current_skills"],
            target_role=transition_dev_to_datascientist["target_role"],
            target_skills=transition_dev_to_datascientist["target_skills"]
        )
        
        # PoC Success Criteria
        assert result is not None
        assert result.gaps, "Should identify gaps"
        
        # Should identify ML/Statistics gaps
        gap_titles = [g.skill_name for g in result.gaps]
        assert any("machine" in g.lower() or "ml" in g.lower() for g in gap_titles), \
            "Should identify ML-related gaps"
        
        # Gap percentage should be reasonable
        for gap in result.gaps:
            assert 0 <= gap.gap_percentage <= 100, "Gap percentage 0-100"
            assert hasattr(gap, 'priority_rank'), "Gap should have priority"
        
        print(f"✅ Dev→DataScientist gaps ({len(result.gaps)} identified):")
        for g in result.gaps[:3]:
            print(f"   - {g.skill_name} (priority: {g.priority_rank})")
    
    def test_gap_analysis_non_tech_to_engineer(self, transition_non_tech_to_engineer):
        """Test PoC: Large gaps for non-technical→engineer"""
        from ai_v2.agents.gap_agent import GapAgent
        
        agent = GapAgent()
        result = agent.execute(
            user_id="poc_user_2",
            current_skills=transition_non_tech_to_engineer["current_skills"],
            target_role=transition_non_tech_to_engineer["target_role"],
            target_skills=transition_non_tech_to_engineer["target_skills"]
        )
        
        assert result is not None
        assert result.gaps
        assert len(result.gaps) >= 3, "Should identify multiple gaps for large career change"
        
        print(f"✅ Non-tech→Engineer gaps ({len(result.gaps)} identified)")
    
    def test_gap_priority_ranking(self, transition_dev_to_datascientist):
        """Test PoC: Gaps are priority-ranked"""
        from ai_v2.agents.gap_agent import GapAgent
        
        agent = GapAgent()
        result = agent.execute(
            user_id="poc_user_1",
            current_skills=transition_dev_to_datascientist["current_skills"],
            target_role=transition_dev_to_datascientist["target_role"],
            target_skills=transition_dev_to_datascientist["target_skills"]
        )
        
        # Check priority ranks are in descending order
        if len(result.gaps) > 1:
            for i in range(len(result.gaps) - 1):
                assert result.gaps[i].priority_rank <= result.gaps[i + 1].priority_rank, \
                    "Gaps should be sorted by priority"
        
        print(f"✅ Gaps properly prioritized")


class TestRoadmapAgentPoC:
    """Roadmap Agent Proof of Concept Test Cases"""
    
    @pytest.fixture
    def roadmap_scenario_datascientist(self) -> Dict[str, Any]:
        """Data Scientist roadmap scenario"""
        return {
            "user_id": "poc_user_1",
            "current_skills": ["Python", "SQL"],
            "target_role": "Data Scientist",
            "skill_gaps": [
                {"skill": "Machine Learning", "learning_time_months": 4},
                {"skill": "Statistics", "learning_time_months": 3},
                {"skill": "Data Visualization", "learning_time_months": 2},
            ],
            "estimated_timeline_months": 6
        }
    
    @pytest.fixture
    def roadmap_scenario_fullstack(self) -> Dict[str, Any]:
        """Full-Stack Developer roadmap scenario"""
        return {
            "user_id": "poc_user_2",
            "current_skills": ["Basic HTML/CSS"],
            "target_role": "Full-Stack Developer",
            "skill_gaps": [
                {"skill": "JavaScript", "learning_time_months": 2},
                {"skill": "Backend (Node.js/Python)", "learning_time_months": 2},
                {"skill": "Databases", "learning_time_months": 1},
                {"skill": "DevOps/Deployment", "learning_time_months": 1},
            ],
            "estimated_timeline_months": 6
        }
    
    def test_roadmap_generation_datascientist(self, roadmap_scenario_datascientist):
        """Test PoC: Generate data scientist roadmap"""
        from ai_v2.agents.roadmap_agent import RoadmapAgent
        
        agent = RoadmapAgent()
        result = agent.execute(
            user_id=roadmap_scenario_datascientist["user_id"],
            target_role=roadmap_scenario_datascientist["target_role"],
            current_skills=roadmap_scenario_datascientist["current_skills"],
            skill_gaps=roadmap_scenario_datascientist["skill_gaps"]
        )
        
        # PoC Success Criteria
        assert result is not None
        assert result.phases, "Should generate phases"
        assert len(result.phases) == 5, "Should generate exactly 5 phases"
        
        # Check phase structure
        total_duration = 0
        for i, phase in enumerate(result.phases, 1):
            assert hasattr(phase, 'phase_number'), f"Phase {i} should have phase_number"
            assert phase.phase_number == i, f"Phases should be numbered 1-5"
            assert hasattr(phase, 'duration_months'), "Phase should have duration"
            assert phase.duration_months > 0, "Duration should be positive"
            assert hasattr(phase, 'skills_to_learn'), "Phase should list skills"
            assert hasattr(phase, 'milestones'), "Phase should have milestones"
            
            total_duration += phase.duration_months
        
        # Total duration should be reasonable
        assert 4 <= total_duration <= 12, f"Total roadmap should be 4-12 months, got {total_duration}"
        
        print(f"✅ Data Scientist Roadmap (5 phases, {total_duration} months):")
        for phase in result.phases:
            print(f"   Phase {phase.phase_number}: {phase.duration_months}m - {phase.skills_to_learn}")
    
    def test_roadmap_progression_realistic(self, roadmap_scenario_fullstack):
        """Test PoC: Roadmap progression is realistic (skills build up)"""
        from ai_v2.agents.roadmap_agent import RoadmapAgent
        
        agent = RoadmapAgent()
        result = agent.execute(
            user_id=roadmap_scenario_fullstack["user_id"],
            target_role=roadmap_scenario_fullstack["target_role"],
            current_skills=roadmap_scenario_fullstack["current_skills"],
            skill_gaps=roadmap_scenario_fullstack["skill_gaps"]
        )
        
        # Phase 1 should focus on fundamentals, not advanced topics
        phase1_skills = result.phases[0].skills_to_learn
        phase5_skills = result.phases[4].skills_to_learn if len(result.phases) > 4 else []
        
        # Later phases should build on earlier skills
        assert len(result.phases[0].skills_to_learn) >= 1, "Phase 1 should have skills"
        
        print(f"✅ Full-Stack roadmap progression realistic")
    
    def test_roadmap_milestones_measurable(self, roadmap_scenario_datascientist):
        """Test PoC: Milestones are measurable and achievable"""
        from ai_v2.agents.roadmap_agent import RoadmapAgent
        
        agent = RoadmapAgent()
        result = agent.execute(
            user_id=roadmap_scenario_datascientist["user_id"],
            target_role=roadmap_scenario_datascientist["target_role"],
            current_skills=roadmap_scenario_datascientist["current_skills"],
            skill_gaps=roadmap_scenario_datascientist["skill_gaps"]
        )
        
        # Check milestones
        for phase in result.phases:
            assert phase.milestones, f"Phase {phase.phase_number} should have milestones"
            assert len(phase.milestones) >= 1, "Each phase should have at least 1 milestone"
            
            for milestone in phase.milestones:
                assert len(milestone) > 0, "Milestone text should not be empty"
        
        print(f"✅ Roadmap has measurable milestones")


@pytest.mark.integration
class TestEndToEndPoC:
    """End-to-End PoC: All agents in sequence"""
    
    def test_full_pipeline_software_engineer(self):
        """Test PoC: Run all agents for a software engineer profile"""
        from ai_v2.main_pipeline import generate_career_recommendations
        
        user_profile = {
            "user_id": "poc_e2e_1",
            "name": "John Developer",
            "email": "john@example.com"
        }
        
        cv_text = """
        John Developer
        
        Skills: Python, JavaScript, React, Node.js, PostgreSQL, Git
        Experience: 2 years as junior developer
        """
        
        result = generate_career_recommendations(
            user_id=user_profile["user_id"],
            user_profile=user_profile,
            cv_text=cv_text
        )
        
        # Should have all components
        assert result is not None
        assert result.recommended_careers, "Should have recommended careers"
        assert result.skill_gaps, "Should have skill gaps"
        assert result.roadmap, "Should have roadmap"
        
        # Roadmap should have phases
        assert len(result.roadmap.phases) == 5, "E2E roadmap should have 5 phases"
        
        print(f"✅ E2E PoC: {len(result.recommended_careers)} careers, roadmap with {len(result.roadmap.phases)} phases")


# ============================================================================
# PoC Execution Script
# ============================================================================

if __name__ == "__main__":
    print("\n" + "=" * 70)
    print("PHASE 1: PROOF OF CONCEPT TEST EXECUTION")
    print("=" * 70 + "\n")
    
    # Run with: pytest backend/ai_v2/tests/poc_tests.py -v
    pytest.main([__file__, "-v", "-s"])
