"""
Quick start guide for using the Real RAG system.

This demonstrates how to:
1. Initialize the RAG retriever
2. Perform semantic searches
3. Use RAG in agents
4. Test with both OpenAI and mock embeddings
"""

# ============================================================================
# Example 1: Basic RAG Search
# ============================================================================

def example_basic_search():
    """Perform a basic semantic search."""
    from backend.ai_v2.rag import RAGRetriever
    
    print("[EXAMPLE 1] Basic Semantic Search")
    print("=" * 60)
    
    retriever = RAGRetriever()
    
    # Search for backend engineer information
    results = retriever.search(
        query="backend engineer requirements and skills",
        top_k=3,
        threshold=0.5
    )
    
    print(f"Query: 'backend engineer requirements and skills'")
    print(f"Found {len(results)} documents:\n")
    
    for i, doc in enumerate(results, 1):
        print(f"{i}. {doc['title']}")
        print(f"   Type: {doc['doc_type']}")
        print(f"   Similarity: {doc['similarity']:.4f}")
        print(f"   Content: {doc['content'][:100]}...\n")


# ============================================================================
# Example 2: Career Role Search
# ============================================================================

def example_career_search():
    """Search for a specific career role."""
    from backend.ai_v2.rag import RAGRetriever
    
    print("[EXAMPLE 2] Career Role Search")
    print("=" * 60)
    
    retriever = RAGRetriever()
    
    # Get comprehensive career information
    role_data = retriever.search_by_role(
        role="Backend Engineer",
        include_skills=True,
        include_paths=True,
        include_resources=True,
        top_k=3
    )
    
    print("Career Information:")
    if role_data['career']:
        career = role_data['career'][0]
        print(f"  Role: {career['title']}")
        print(f"  Similarity: {career['similarity']:.4f}")
        print(f"  Content preview: {career['content'][:80]}...\n")
    
    print(f"Required Skills ({len(role_data['skills'])}):")
    for skill in role_data['skills']:
        print(f"  - {skill['title']} ({skill['similarity']:.3f})")
    
    print(f"\nLearning Path ({len(role_data['learning_path'])}):")
    for path in role_data['learning_path']:
        print(f"  - {path['title']}")
    
    print(f"\nResources ({len(role_data['resources'])}):")
    for resource in role_data['resources']:
        print(f"  - {resource['title']}")


# ============================================================================
# Example 3: Skill Search
# ============================================================================

def example_skill_search():
    """Search for skill-related information."""
    from backend.ai_v2.rag import RAGRetriever
    
    print("[EXAMPLE 3] Skill Search")
    print("=" * 60)
    
    retriever = RAGRetriever()
    
    # Get skill information
    skill_data = retriever.search_by_skill(
        skill="Python",
        top_k=3
    )
    
    print("Skill Description:")
    if skill_data['skill_description']:
        skill = skill_data['skill_description'][0]
        print(f"  {skill['title']}")
        print(f"  {skill['content'][:100]}...\n")
    
    print(f"Matching Careers ({len(skill_data['matching_careers'])}):")
    for career in skill_data['matching_careers']:
        print(f"  - {career['title']}")
    
    print(f"\nLearning Resources ({len(skill_data['learning_resources'])}):")
    for resource in skill_data['learning_resources']:
        print(f"  - {resource['title']}")


# ============================================================================
# Example 4: Using RAG Tool
# ============================================================================

def example_rag_tool():
    """Use the retrieve_documents tool."""
    from backend.ai_v2.tools import retrieve_documents
    
    print("[EXAMPLE 4] retrieve_documents() Tool")
    print("=" * 60)
    
    # This now uses REAL RAG with embeddings
    result = retrieve_documents(
        query="transition from junior developer to backend engineer",
        top_k=5
    )
    
    print(f"Query: 'transition from junior developer to backend engineer'")
    print(f"Success: {result['success']}")
    print(f"Documents found: {result['count']}\n")
    
    for i, doc in enumerate(result['documents'], 1):
        print(f"{i}. {doc['title']} ({doc['doc_type']})")
        print(f"   Similarity: {doc['similarity']:.4f}")


# ============================================================================
# Example 5: RAG Statistics
# ============================================================================

def example_rag_stats():
    """Get RAG system statistics."""
    from backend.ai_v2.rag import RAGRetriever
    
    print("[EXAMPLE 5] RAG Statistics")
    print("=" * 60)
    
    retriever = RAGRetriever()
    stats = retriever.get_stats()
    
    print(f"Total documents: {stats['total_documents']}")
    print(f"\nDocuments by type:")
    for doc_type, count in stats['documents_by_type'].items():
        print(f"  - {doc_type}: {count}")
    
    print(f"\nEmbeddings cached: {stats['embeddings_cached']}")
    print(f"Cache size: {stats['embedding_cache_size_mb']:.2f} MB")
    
    # List available careers
    print(f"\nAvailable Careers:")
    careers = retriever.list_careers()
    for career in careers:
        print(f"  - {career['title']} ({career['level']})")
        print(f"    Salary: ${career['salary_min']:,}-${career['salary_max']:,}")
    
    # List available skills
    print(f"\nAvailable Skills:")
    skills = retriever.list_skills()
    for skill in skills:
        difficulty = skill['difficulty']
        weeks = skill['weeks_to_learn']
        print(f"  - {skill['title']} ({difficulty}, {weeks} weeks)")


# ============================================================================
# Example 6: Testing with Mock Embeddings
# ============================================================================

def example_mock_embeddings():
    """Test RAG with mock embeddings (no OpenAI API needed)."""
    from backend.ai_v2.rag import RAGRetriever, EmbeddingService
    
    print("[EXAMPLE 6] Using Mock Embeddings")
    print("=" * 60)
    
    # Force mock embeddings
    mock_embeddings = EmbeddingService(use_mock=True)
    retriever = RAGRetriever(embedding_service=mock_embeddings)
    
    print("Using mock embeddings (no OpenAI API)")
    print("Search performs identical to real embeddings but without API calls\n")
    
    results = retriever.search(
        query="what skills do data scientists need?",
        top_k=3
    )
    
    print(f"Found {len(results)} results (using mock embeddings):")
    for doc in results:
        print(f"  - {doc['title']}: {doc['similarity']:.4f}")


# ============================================================================
# Example 7: Integration with Agents
# ============================================================================

def example_agent_integration():
    """Show how to use RAG in agents."""
    from backend.ai_v2.rag import RAGRetriever
    
    print("[EXAMPLE 7] Integration with Agents")
    print("=" * 60)
    
    class MockCareerAgent:
        def __init__(self):
            self.rag = RAGRetriever()
        
        def run(self, target_role: str, current_skills: list):
            # Get career context from RAG
            career_context = self.rag.search_by_role(
                role=target_role,
                include_skills=True,
                include_paths=True
            )
            
            # Get learning resources for each missing skill
            missing_skills = ["Docker", "System Design"]
            skill_resources = {}
            for skill in missing_skills:
                results = self.rag.search_by_skill(skill, top_k=2)
                skill_resources[skill] = results['learning_resources']
            
            return {
                "career": career_context,
                "skill_resources": skill_resources
            }
    
    agent = MockCareerAgent()
    
    result = agent.run(
        target_role="Backend Engineer",
        current_skills=["Python", "SQL"]
    )
    
    print(f"Career: {result['career']['career'][0]['title']}")
    print(f"Required skills found: {len(result['career']['skills'])}")
    print(f"Learning resources gathered: {len(result['skill_resources'])}")
    
    for skill, resources in result['skill_resources'].items():
        print(f"  {skill}: {len(resources)} resources")


# ============================================================================
# Run All Examples
# ============================================================================

if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("REAL RAG SYSTEM - QUICK EXAMPLES")
    print("=" * 60 + "\n")
    
    try:
        example_basic_search()
        print("\n" + "-" * 60 + "\n")
        
        example_career_search()
        print("\n" + "-" * 60 + "\n")
        
        example_skill_search()
        print("\n" + "-" * 60 + "\n")
        
        example_rag_tool()
        print("\n" + "-" * 60 + "\n")
        
        example_rag_stats()
        print("\n" + "-" * 60 + "\n")
        
        example_mock_embeddings()
        print("\n" + "-" * 60 + "\n")
        
        example_agent_integration()
        print("\n" + "-" * 60 + "\n")
        
        print("✅ All examples completed successfully!")
    
    except Exception as e:
        print(f"❌ Error running examples: {e}")
        import traceback
        traceback.print_exc()
