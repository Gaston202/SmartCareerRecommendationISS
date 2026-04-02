#!/usr/bin/env python3
"""
Comprehensive System Check for Smart Career Recommendation ISS

Tests all critical unknowns to determine system health:
1. LLM connectivity (OpenRouter API key, quota, model availability)
2. Supabase connectivity, pgvector, and document storage
3. RAG semantic search quality
4. EmbeddingService initialization
5. End-to-end pipeline output quality

Run with: python comprehensive-system-check.py
"""

import os
import sys
import json
import requests
import logging
from datetime import datetime
from typing import Dict, Any, List, Tuple

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from ai_v2.config import config
from ai_v2.utils import get_logger
from ai_v2.services.llm import LLMService
from ai_v2.services.embedding import EmbeddingService
from ai_v2.services.supabase_rag import SupabaseRAG
from ai_v2.schemas import UserProfile, CareerRecommendationOutput
from ai_v2.main_pipeline import CareerRecommendationPipeline

# Setup logging
logger = get_logger(__name__)
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Color codes for terminal output
class Color:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'
    BOLD = '\033[1m'


class SystemCheckResult:
    """Container for test results."""
    def __init__(self, test_name: str):
        self.test_name = test_name
        self.passed = False
        self.details = {}
        self.logs = []
        self.errors = []
        self.warnings = []
        self.timestamp = datetime.utcnow().isoformat()
    
    def pass_test(self, message: str = "", **details):
        """Mark test as passed."""
        self.passed = True
        self.details.update(details)
        if message:
            self.logs.append(message)
    
    def fail_test(self, message: str, **details):
        """Mark test as failed."""
        self.passed = False
        self.errors.append(message)
        self.details.update(details)
    
    def warn(self, message: str):
        """Add warning without failing."""
        self.warnings.append(message)
    
    def __str__(self):
        """Pretty print result."""
        status = f"{Color.GREEN}✓ PASS{Color.RESET}" if self.passed else f"{Color.RED}✗ FAIL{Color.RESET}"
        lines = [f"\n{status} {self.test_name}"]
        
        if self.details:
            lines.append(f"  Details: {json.dumps(self.details, indent=2)}")
        
        if self.logs:
            lines.append("  Logs:")
            for log in self.logs:
                lines.append(f"    • {log}")
        
        if self.warnings:
            lines.append(f"  {Color.YELLOW}Warnings:{Color.RESET}")
            for warning in self.warnings:
                lines.append(f"    ⚠ {warning}")
        
        if self.errors:
            lines.append(f"  {Color.RED}Errors:{Color.RESET}")
            for error in self.errors:
                lines.append(f"    ✗ {error}")
        
        return "\n".join(lines)


class ComprehensiveSystemCheck:
    """Orchestrates all system checks."""
    
    def __init__(self):
        self.results: List[SystemCheckResult] = []
        self.start_time = datetime.utcnow()
    
    def run_all_checks(self):
        """Run all checks in sequence."""
        print(f"\n{Color.BOLD}=== Comprehensive System Health Check ==={Color.RESET}")
        print(f"Started: {self.start_time.isoformat()}\n")
        
        # Configuration check
        self.check_configuration()
        
        # Component checks
        self.check_embedding_service()
        self.check_supabase_connectivity()
        self.check_rag_documents()
        self.check_llm_connectivity()
        
        # Integration checks
        self.check_rag_semantic_search()
        self.check_end_to_end_pipeline()
        
        # Summary
        self.print_summary()
    
    def check_configuration(self):
        """Check environment configuration."""
        result = SystemCheckResult("Configuration Validation")
        
        try:
            # Check critical env vars
            required_vars = {
                'SUPABASE_URL': config.SUPABASE_URL if hasattr(config, 'SUPABASE_URL') else None,
                'SUPABASE_KEY': '***' if (hasattr(config, 'SUPABASE_KEY') and config.SUPABASE_KEY) else None,
                'OPENROUTER_API_KEY': '***' if config.OPENROUTER_API_KEY else None,
                'OPENROUTER_BASE_URL': config.OPENROUTER_BASE_URL,
            }
            
            missing = [k for k, v in required_vars.items() if not v]
            
            result.pass_test(
                "Configuration variables present",
                loaded_vars=len(required_vars) - len(missing),
                missing=missing
            )
            
            if missing:
                result.warn(f"Missing optional variables: {', '.join(missing)}")
            
        except Exception as e:
            result.fail_test(f"Configuration check failed: {str(e)}")
        
        self.results.append(result)
    
    def check_embedding_service(self):
        """Test EmbeddingService initialization and inference."""
        result = SystemCheckResult("Embedding Service")
        
        try:
            logger.info("[CHECK] Initializing EmbeddingService...")
            embedding_service = EmbeddingService()
            
            # Test embedding generation
            test_text = "Python programming skills"
            logger.info(f"[CHECK] Generating embedding for: '{test_text}'")
            embedding = embedding_service.embed(test_text)
            
            if embedding and len(embedding) > 0:
                result.pass_test(
                    "EmbeddingService initialized and working",
                    model=embedding_service.model_name,
                    embedding_dimension=len(embedding),
                    provider=embedding_service.provider
                )
            else:
                result.fail_test("EmbeddingService returned empty embedding")
            
        except ImportError as e:
            result.fail_test(
                f"Failed to import EmbeddingService dependencies: {str(e)}",
                error_type="ImportError"
            )
        except Exception as e:
            result.fail_test(
                f"EmbeddingService initialization failed: {str(e)}",
                error_type=type(e).__name__
            )
        
        self.results.append(result)
    
    def check_supabase_connectivity(self):
        """Test Supabase connection and pgvector availability."""
        result = SystemCheckResult("Supabase Connectivity")
        
        try:
            logger.info("[CHECK] Initializing Supabase client...")
            
            # Get credentials
            supabase_url = config.SUPABASE_URL if hasattr(config, 'SUPABASE_URL') else None
            supabase_key = config.SUPABASE_KEY if hasattr(config, 'SUPABASE_KEY') else None
            
            if not supabase_url or not supabase_key:
                result.warn("Supabase credentials not configured - RAG will be unavailable")
                result.details['supabase_configured'] = False
                self.results.append(result)
                return
            
            # Try to create client and test connection
            from supabase import create_client
            client = create_client(supabase_url, supabase_key)
            
            # Test with simple query
            logger.info("[CHECK] Testing Supabase connection...")
            # Try to get a count from documents table using correct PostgREST syntax
            response = client.table("documents").select("id", count="exact").execute()
            result.pass_test(
                "Supabase connected successfully",
                url=supabase_url,
                has_tables=True
            )
            
        except ImportError as e:
            result.warn(f"supabase library not installed: {str(e)}")
            result.details['supabase_installed'] = False
        except Exception as e:
            result.fail_test(
                f"Supabase connection failed: {str(e)}",
                error_type=type(e).__name__
            )
        
        self.results.append(result)
    
    def check_rag_documents(self):
        """Check if RAG documents are indexed in database."""
        result = SystemCheckResult("RAG Document Index")
        
        try:
            logger.info("[CHECK] Checking RAG document index...")
            
            # Initialize RAG
            embedding_service = EmbeddingService()
            rag = SupabaseRAG(embedding_service=embedding_service)
            
            if not rag.client:
                result.warn("RAG client not initialized - checking initialization...")
                self.results.append(result)
                return
            
            # Try to count documents using correct PostgREST syntax
            try:
                response = rag.client.table("documents").select("id", count="exact").execute()
                count = response.count if hasattr(response, 'count') else 0
                
                if count > 0:
                    result.pass_test(
                        f"RAG documents indexed",
                        document_count=count
                    )
                else:
                    result.fail_test(
                        "No documents indexed in RAG",
                        document_count=0,
                        next_step="Run 'python -m backend.ai_v2.scripts.initialize_career_kb'"
                    )
            except Exception as e:
                result.fail_test(
                    f"Failed to query document count: {str(e)}",
                    error_type=type(e).__name__
                )
        
        except Exception as e:
            result.fail_test(
                f"RAG document check failed: {str(e)}",
                error_type=type(e).__name__
            )
        
        self.results.append(result)
    
    def check_llm_connectivity(self):
        """Test LLM API connectivity and key validity."""
        result = SystemCheckResult("LLM Connectivity (OpenRouter)")
        
        try:
            logger.info("[CHECK] Testing LLM connectivity...")
            
            # Check if API key is configured
            if not config.OPENROUTER_API_KEY:
                result.warn("OpenRouter API key not configured - using mock LLM")
                result.details['llm_mode'] = 'FALLBACK_MOCK'
                self.results.append(result)
                return
            
            # Initialize LLM service
            llm = LLMService()
            
            if llm.use_mock:
                result.warn("LLMService is using fallback mock implementation")
                result.details['llm_mode'] = 'FALLBACK_MOCK'
                self.results.append(result)
                return
            
            # Test with minimal API call
            logger.info("[CHECK] Making test API call to OpenRouter...")
            
            try:
                # Tiny test call to verify key and quota
                response = llm.client.chat.completions.create(
                    model=config.LLM_MODEL,
                    messages=[
                        {"role": "user", "content": "Say 'OK' and nothing else"}
                    ],
                    max_tokens=10,  # Minimal tokens
                    temperature=0.1,
                )
                
                if response.choices and len(response.choices) > 0:
                    result.pass_test(
                        "LLM API responding correctly",
                        model=config.LLM_MODEL,
                        status="REAL_LLM",
                        response_received=True
                    )
                else:
                    result.fail_test("LLM returned empty response")
            
            except Exception as api_error:
                # Categorize error
                error_msg = str(api_error)
                if "401" in error_msg or "unauthorized" in error_msg.lower():
                    result.fail_test(
                        "API key invalid or unauthorized",
                        error_type="AUTH_ERROR",
                        hint="Check OPENROUTER_API_KEY"
                    )
                elif "429" in error_msg or "rate limit" in error_msg.lower():
                    result.warn("Rate limit hit - quota may be exhausted")
                    result.fail_test(
                        "Rate limit exceeded",
                        error_type="RATE_LIMIT",
                        hint="May need to check OpenRouter quota"
                    )
                elif "timeout" in error_msg.lower():
                    result.fail_test(
                        "API call timed out",
                        error_type="TIMEOUT",
                        hint="Network or API latency issue"
                    )
                else:
                    result.fail_test(
                        f"API call failed: {error_msg}",
                        error_type=type(api_error).__name__
                    )
        
        except Exception as e:
            result.fail_test(
                f"LLM connectivity check failed: {str(e)}",
                error_type=type(e).__name__
            )
        
        self.results.append(result)
    
    def check_rag_semantic_search(self):
        """Test RAG semantic search quality."""
        result = SystemCheckResult("RAG Semantic Search")
        
        try:
            logger.info("[CHECK] Testing RAG semantic search...")
            
            # Initialize RAG
            embedding_service = EmbeddingService()
            rag = SupabaseRAG(embedding_service=embedding_service)
            
            if not rag.client:
                result.warn("RAG client not available - skipping semantic search test")
                self.results.append(result)
                return
            
            # Test semantic search
            test_queries = [
                "Python backend development",
                "Data science career path",
                "Frontend React skills"
            ]
            
            results_count = 0
            for query in test_queries:
                logger.info(f"[CHECK] Searching: {query}")
                try:
                    search_results = rag.search(
                        query=query,
                        top_k=3,
                        collection="career_knowledge"
                    )
                    if search_results and len(search_results) > 0:
                        results_count += len(search_results)
                except Exception as search_error:
                    logger.warning(f"Search failed for '{query}': {search_error}")
            
            if results_count > 0:
                result.pass_test(
                    "RAG semantic search working",
                    queries_tested=len(test_queries),
                    results_found=results_count
                )
            else:
                result.fail_test(
                    "RAG semantic search returned no results",
                    note="May indicate empty document index - ensure documents table has data with embeddings"
                )
        
        except Exception as e:
            result.fail_test(
                f"RAG semantic search check failed: {str(e)}",
                error_type=type(e).__name__
            )
        
        self.results.append(result)
    
    def check_end_to_end_pipeline(self):
        """Test end-to-end pipeline with sample data."""
        result = SystemCheckResult("End-to-End Pipeline")
        
        try:
            logger.info("[CHECK] Running end-to-end pipeline test...")
            
            # Create sample user profile
            user_profile = UserProfile(
                user_id="test-user-123",
                name="Test User",
                email="test@example.com",
                current_skills=["Python", "JavaScript", "React"],
                experience_level="intermediate",
                education="BS Computer Science"
            )
            
            # Initialize pipeline
            pipeline = CareerRecommendationPipeline()
            
            # Run recommendation
            logger.info("[CHECK] Running pipeline.recommend()")
            output = pipeline.recommend(
                user_profile=user_profile,
                cv_text=None,
                job_market_data=None,
                preferences=None
            )
            
            # Check output
            if not isinstance(output, CareerRecommendationOutput):
                result.fail_test("Pipeline returned unexpected output type")
                self.results.append(result)
                return
            
            # Analyze results
            if not output.success:
                result.fail_test(
                    "Pipeline returned failure status",
                    error=output.error,
                    error_type=output.error_type
                )
                self.results.append(result)
                return
            
            # Check presence of recommendations
            has_careers = len(output.recommended_careers) > 0
            has_gaps = len(output.skill_gaps) > 0
            has_roadmap = len(output.roadmap) > 0
            
            result.pass_test(
                "Pipeline executed successfully",
                status="success",
                recommended_careers=len(output.recommended_careers),
                skill_gaps_analyzed=len(output.skill_gaps),
                roadmap_steps=len(output.roadmap),
                confidence_score=output.confidence_score,
                output_quality={
                    "has_recommendations": has_careers,
                    "has_gap_analysis": has_gaps,
                    "has_roadmap": has_roadmap
                }
            )
            
            # Warn if any section is empty
            if not has_careers:
                result.warn("No career recommendations generated")
            if not has_gaps:
                result.warn("No skill gap analysis generated")
            if not has_roadmap:
                result.warn("No roadmap generated")
        
        except Exception as e:
            result.fail_test(
                f"End-to-end pipeline test failed: {str(e)}",
                error_type=type(e).__name__
            )
        
        self.results.append(result)
    
    def print_summary(self):
        """Print summary of all checks."""
        passed = sum(1 for r in self.results if r.passed)
        total = len(self.results)
        
        print("\n" + "="*80)
        for result in self.results:
            print(result)
        
        print("\n" + "="*80)
        print(f"\n{Color.BOLD}Summary:{Color.RESET}")
        print(f"  Total Checks: {total}")
        print(f"  {Color.GREEN}Passed: {passed}{Color.RESET}")
        print(f"  {Color.RED}Failed: {total - passed}{Color.RESET}")
        
        # Print recommendations
        failed_tests = [r for r in self.results if not r.passed]
        if failed_tests:
            print(f"\n{Color.BOLD}Failures to Address ({len(failed_tests)}):{Color.RESET}")
            for i, result in enumerate(failed_tests, 1):
                print(f"\n{i}. {result.test_name}")
                if result.errors:
                    print(f"   Error: {result.errors[0]}")
                if result.details.get('next_step'):
                    print(f"   Next step: {result.details['next_step']}")
                if result.details.get('hint'):
                    print(f"   Hint: {result.details['hint']}")
        
        # Overall status
        print(f"\n{Color.BOLD}Overall Status:{Color.RESET}")
        if passed == total:
            print(f"{Color.GREEN}✓ All systems operational!{Color.RESET}")
        elif passed >= total * 0.75:
            print(f"{Color.YELLOW}⚠ Most systems working - fix failures above{Color.RESET}")
        else:
            print(f"{Color.RED}✗ Critical failures - see details above{Color.RESET}")
        
        # Save detailed results to JSON
        self.save_results_json()
    
    def save_results_json(self):
        """Save detailed results to JSON file."""
        try:
            results_data = {
                "timestamp": datetime.utcnow().isoformat(),
                "duration_seconds": (datetime.utcnow() - self.start_time).total_seconds(),
                "summary": {
                    "total": len(self.results),
                    "passed": sum(1 for r in self.results if r.passed),
                    "failed": sum(1 for r in self.results if not r.passed),
                },
                "results": [
                    {
                        "test_name": r.test_name,
                        "passed": r.passed,
                        "details": r.details,
                        "logs": r.logs,
                        "warnings": r.warnings,
                        "errors": r.errors,
                    }
                    for r in self.results
                ]
            }
            
            output_file = "system_check_results.json"
            with open(output_file, 'w') as f:
                json.dump(results_data, f, indent=2)
            
            print(f"\n📊 Detailed results saved to: {output_file}")
        
        except Exception as e:
            logger.error(f"Failed to save results JSON: {e}")


def main():
    """Entry point."""
    try:
        checker = ComprehensiveSystemCheck()
        checker.run_all_checks()
    except KeyboardInterrupt:
        print(f"\n{Color.YELLOW}Check interrupted by user{Color.RESET}")
        sys.exit(130)
    except Exception as e:
        print(f"\n{Color.RED}Fatal error: {e}{Color.RESET}")
        logger.exception("Unhandled exception in system check")
        sys.exit(1)


if __name__ == "__main__":
    main()
