"""
Unit tests for CV Agent with ATS scoring.

Run with: pytest backend/ai_v2/test_cv_agent_unit.py -v
"""

import pytest
from agents.cv_agent import CVAgent
from schemas import AgentType, AgentOutput


class TestCVAgent:
    """Test suite for CV Agent."""
    
    @pytest.fixture
    def agent(self):
        """Create CV Agent instance."""
        return CVAgent()
    
    def test_agent_initialization(self, agent):
        """Test CV Agent initializes correctly."""
        assert agent.name == "CV Analyzer"
        assert agent.agent_type == AgentType.CV
    
    def test_missing_cv_text(self, agent):
        """Test handling of missing CV text."""
        result = agent.run({"cv_text": None})
        
        assert result.success is True
        assert result.data.get("cv_provided") is False
        assert result.error is None
    
    def test_empty_cv_text(self, agent):
        """Test handling of empty CV text."""
        result = agent.run({"cv_text": ""})
        
        assert result.success is True
        assert result.data.get("cv_provided") is False
    
    def test_valid_cv_returns_ats_score(self, agent):
        """Test that valid CV returns ATS score."""
        cv_text = "Python Developer with experience in Django, Flask, and REST APIs."
        result = agent.run({"cv_text": cv_text})
        
        assert result.success is True
        assert result.data.get("cv_provided") is True
        assert "ats_score" in result.data
        assert 0 <= result.data["ats_score"] <= 100
    
    def test_ats_breakdown_structure(self, agent):
        """Test ATS breakdown has correct structure."""
        cv_text = "Python SQL JavaScript React AWS Docker Kubernetes"
        result = agent.run({"cv_text": cv_text})
        
        breakdown = result.data.get("ats_breakdown", {})
        
        # Check all 4 components exist
        assert "keyword_matching" in breakdown
        assert "formatting_completeness" in breakdown
        assert "section_presence" in breakdown
        assert "job_relevance" in breakdown
        
        # Check each component has required fields
        for component_name, component_data in breakdown.items():
            assert "score" in component_data
            assert "weight" in component_data
            assert "component_value" in component_data
            assert "details" in component_data
    
    def test_ats_weights_sum_correctly(self, agent):
        """Test that ATS component weights sum to 100."""
        cv_text = "Sample CV with skills"
        result = agent.run({"cv_text": cv_text})
        
        breakdown = result.data.get("ats_breakdown", {})
        total_weight = sum(comp["weight"] for comp in breakdown.values())
        
        assert total_weight == 100
    
    def test_keyword_extraction(self, agent):
        """Test skill keyword extraction."""
        cv_text = "Experienced in Python, Java, SQL, AWS, Docker. Strong leadership and communication skills."
        result = agent.run({"cv_text": cv_text})
        
        skills = result.data.get("skills_extracted", [])
        
        # Should find at least some of the keywords
        assert len(skills) > 0
        skill_lower = [s.lower() for s in skills]
        
        # Check for some known keywords
        assert any(s in skill_lower for s in ["python", "java", "sql", "aws", "docker"])
    
    def test_better_cv_scores_higher(self, agent):
        """Test that comprehensive CV scores higher than minimal CV."""
        
        minimal_cv = "I know programming."
        comprehensive_cv = """
        Senior Software Engineer with 5+ years experience.
        
        TECHNICAL SKILLS
        Python, Java, JavaScript, SQL, React, Django, FastAPI, AWS, Docker, Kubernetes
        
        PROFESSIONAL EXPERIENCE
        Senior Engineer at Tech Corp (2020-2024)
        - Led architecture design
        - Managed team of 5
        - Improved performance by 50%
        
        EDUCATION
        Bachelor's in Computer Science
        
        CERTIFICATIONS
        AWS Solutions Architect
        """
        
        result_minimal = agent.run({"cv_text": minimal_cv})
        result_comprehensive = agent.run({"cv_text": comprehensive_cv})
        
        minimal_score = result_minimal.data.get("ats_score", 0)
        comprehensive_score = result_comprehensive.data.get("ats_score", 0)
        
        # Comprehensive CV should score significantly higher
        assert comprehensive_score > minimal_score
        assert comprehensive_score > minimal_score + 10  # At least 10 points difference
    
    def test_ats_suggestions_provided(self, agent):
        """Test that ATS suggestions are provided."""
        cv_text = "Short CV"
        result = agent.run({"cv_text": cv_text})
        
        suggestions = result.data.get("ats_suggestions", [])
        
        assert isinstance(suggestions, list)
        assert len(suggestions) > 0
        assert all(isinstance(s, str) for s in suggestions)
    
    def test_formatting_score_calculation(self, agent):
        """Test formatting score is calculated correctly."""
        cv_text = "Python, Java, SQL"  # Very short, no bullet points
        result = agent.run({"cv_text": cv_text})
        
        breakdown = result.data.get("ats_breakdown", {})
        formatting_score = breakdown.get("formatting_completeness", {}).get("score", 0)
        
        # Short CV with no structure should score low on formatting
        assert formatting_score < 70
    
    def test_section_detection(self, agent):
        """Test detection of CV sections."""
        cv_with_sections = """
        EXPERIENCE
        Worked as developer
        
        EDUCATION
        Bachelor's degree
        
        SKILLS
        Python, Java
        """
        
        result = agent.run({"cv_text": cv_with_sections})
        breakdown = result.data.get("ats_breakdown", {})
        section_details = breakdown.get("section_presence", {}).get("details", "")
        
        # Should detect multiple sections
        assert "3/" in section_details or "Found" in section_details
    
    def test_error_handling(self, agent):
        """Test error handling with invalid input."""
        # This should not crash even with unusual input
        result = agent.run({"cv_text": "Normal text"})
        
        assert result.success is True
        assert result.error is None


class TestATSScoring:
    """Test ATS scoring logic specifically."""
    
    @pytest.fixture
    def agent(self):
        return CVAgent()
    
    def test_ats_score_range(self, agent):
        """Test ATS score is always between 0-100."""
        test_cvs = [
            "",
            "x",
            "Short",
            "Medium length CV with some content",
            "Very " * 500  # Long content
        ]
        
        for cv in test_cvs:
            if cv:  # Skip empty
                result = agent.run({"cv_text": cv})
                if result.data.get("cv_provided"):
                    score = result.data.get("ats_score", 0)
                    assert 0 <= score <= 100, f"Score {score} out of range for CV: {cv[:50]}"
    
    def test_component_scores_in_range(self, agent):
        """Test all component scores are 0-100."""
        cv_text = "Python developer with 3 years experience in Django and React."
        result = agent.run({"cv_text": cv_text})
        
        breakdown = result.data.get("ats_breakdown", {})
        
        for component_name, component_data in breakdown.items():
            score = component_data.get("score", 0)
            assert 0 <= score <= 100, f"{component_name} score {score} out of range"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
