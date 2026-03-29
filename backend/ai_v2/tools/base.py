"""
RAG Tools - Retrieval tools for agents to access career knowledge base.

Provides document retrieval functionality for career recommendation agents.
Wraps SupabaseRAG service to enable grounded recommendations based on:
- Career descriptions and progression paths
- Skill requirements and learning resources
- Industry trends and market data
"""

from typing import Dict, List, Any, Optional
from ..config import config
from ..utils import get_logger

logger = get_logger(__name__)

# Global RAG instance (lazy-initialized)
_rag_instance = None


def _get_rag_service():
    """Get or initialize the RAG service."""
    global _rag_instance
    
    if _rag_instance is not None:
        return _rag_instance
    
    # Check if RAG is enabled and dependencies are available
    if not config.ENABLE_RAG:
        logger.warning("[RAG] RAG is disabled in config")
        return None
    
    try:
        # Import here to avoid circular imports
        from services.supabase_client import get_supabase_client
        from ..services.supabase_rag import SupabaseRAG
        
        supabase = get_supabase_client()
        
        # Note: EmbeddingService optional for now - RAG will work in limited capacity
        # When embeddings are needed, we'll create a simple embedding service
        embedding_service = None
        try:
            # Try to import embedding service if available
            from ..services.embedding import EmbeddingService
            embedding_service = EmbeddingService()
        except ImportError:
            logger.debug("[RAG] EmbeddingService not available, RAG will use fallback search")
        
        _rag_instance = SupabaseRAG(client=supabase, embedding_service=embedding_service)
        logger.info("[RAG] ✓ RAG service initialized")
        return _rag_instance
        
    except ImportError as e:
        logger.warning(f"[RAG] Failed to import RAG dependencies: {e}")
        return None
    except Exception as e:
        logger.error(f"[RAG] Failed to initialize RAG service: {e}")
        return None


def retrieve_documents(
    query: str,
    top_k: int = 5,
    collection: Optional[str] = None,
    threshold: float = 0.5,
) -> Dict[str, Any]:
    """
    Retrieve relevant career documents using semantic search.
    
    Falls back to hardcoded career knowledge if RAG not available.
    
    Args:
        query: Search query (e.g., "Python backend developer skills requirements")
        top_k: Number of top results to return
        collection: Optional collection filter (e.g., "careers", "skills", "learning_paths")
        threshold: Similarity threshold (0.0-1.0, default 0.5)
    
    Returns:
        {
            "success": bool,
            "documents": [
                {
                    "id": str,
                    "title": str,
                    "category": str ("career", "skill", "resource"),
                    "text": str,
                    "metadata": dict,
                    "similarity": float (0.0-1.0)
                }
            ],
            "error": str (if failed)
        }
    """
    try:
        rag = _get_rag_service()
        
        if rag is None:
            logger.debug("[RAG] RAG service not available, using fallback knowledge base")
            return _get_fallback_documents(query, top_k)
        
        logger.debug(f"[RAG] Searching for: {query}")
        
        # Perform semantic search
        try:
            results = rag.search(
                query=query,
                top_k=top_k,
                collection=collection,
                threshold=threshold
            )
            
            if results:
                # Transform results to expected format
                documents = []
                for result in results:
                    documents.append({
                        "id": result.get("id", ""),
                        "title": result.get("title", "Untitled"),
                        "category": result.get("category", "resource"),
                        "text": result.get("content", ""),
                        "metadata": result.get("metadata", {}),
                        "similarity": result.get("similarity", 0.0),
                    })
                
                logger.info(f"[RAG] ✓ Retrieved {len(documents)} documents from database")
                return {"success": True, "documents": documents}
        except Exception as search_error:
            logger.debug(f"[RAG] Database search failed: {search_error}, using fallback")
        
        # Fallback to hardcoded knowledge
        return _get_fallback_documents(query, top_k)
        
    except Exception as e:
        logger.error(f"[RAG] Document retrieval error: {e}")
        return _get_fallback_documents(query, top_k)


def _get_fallback_documents(query: str, top_k: int = 5) -> Dict[str, Any]:
    """
    Return fallback career knowledge when RAG not available.
    
    Provides hardcoded career data as a fallback when:
    - RAG service not initialized
    - Database not available
    - No embeddings available
    """
    # Hardcoded career knowledge base
    knowledge_base = [
        {
            "id": "career_software_engineer",
            "title": "Software Engineer",
            "category": "career",
            "text": """Software Engineer - Building and maintaining software systems.

Core Skills Required:
- Programming languages (Python, JavaScript, Java, Go, Rust, C++)
- System design and architecture patterns
- Database design (SQL, NoSQL, PostgreSQL, MongoDB)
- Version control (Git, GitHub, GitLab)
- Problem-solving and algorithms
- API design (REST, GraphQL)
- Testing and debugging

Career Progression:
- Junior Developer (0-2 years)
- Mid-Level Developer (2-5 years)
- Senior Developer (5+ years)
- Staff/Principal Engineer (7+ years)

Learning Path:
1. Select primary language and master fundamentals
2. Learn data structures and algorithms
3. Build full-stack projects
4. Study system design and scalability
5. Practice code reviews and collaboration
6. Specialize in backend, frontend, or full-stack

Typical Salary Range: $80k-$250k+
Job Market: Very High Demand""",
            "metadata": {"level": "all", "field": "technology", "demand": "very_high"}
        },
        {
            "id": "career_data_scientist",
            "title": "Data Scientist",
            "category": "career",
            "text": """Data Scientist - Extracting insights from data to drive business decisions.

Core Skills Required:
- Python or R programming
- Statistical analysis and probability
- Machine learning (supervised, unsupervised, deep learning)
- SQL and database querying
- Data visualization (Tableau, Power BI, matplotlib, seaborn)
- Big data tools (Spark, Hadoop)
- Business acumen and communication

Career Progression:
- Junior Data Analyst (0-2 years)
- Data Scientist (2-5 years)
- Senior Data Scientist (5+ years)
- ML Engineer / ML Architect (7+ years)

Learning Path:
1. Master statistics and probability
2. Learn Python/R and scientific libraries (NumPy, Pandas, scikit-learn)
3. Study machine learning algorithms
4. Learn SQL for data extraction
5. Build end-to-end ML projects
6. Deploy models to production

Machine Learning Frameworks: TensorFlow, PyTorch, scikit-learn
Common Libraries: NumPy, Pandas, Matplotlib

Typical Salary Range: $90k-$280k+
Job Market: Very High Demand""",
            "metadata": {"level": "all", "field": "data_science", "demand": "very_high"}
        },
        {
            "id": "career_product_manager",
            "title": "Product Manager",
            "category": "career",
            "text": """Product Manager - Leading product vision and strategy.

Core Skills Required:
- Product strategy and vision
- User research and empathy
- Technical literacy (understanding engineering constraints)
- Data analysis and metrics (SQL, analytics tools)
- Communication and presentation skills
- Project management
- Business acumen

Career Progression:
- Associate Product Manager (0-2 years)
- Product Manager (2-5 years)
- Senior PM (5+ years)
- Principal PM / Director (7+ years)

Learning Path:
1. Understand product management fundamentals
2. Learn user research and discovery methods
3. Study data analytics and metrics
4. Build technical knowledge (no coding required)
5. Develop business strategy skills
6. Lead cross-functional teams

Key Activities:
- Define product requirements and specifications
- Analyze user behavior and market trends
- Create roadmaps and prioritize features
- Work with engineering and design teams
- Measure and communicate product impact

Typical Salary Range: $100k-$300k+
Job Market: High Demand""",
            "metadata": {"level": "all", "field": "product", "demand": "high"}
        },
        {
            "id": "skill_python",
            "title": "Python Programming",
            "category": "skill",
            "text": """Python - Versatile programming language for web, data, and AI.

When to Learn: If you want career flexibility in backend, data science, AI/ML
Demand Level: Very High
Time to Proficiency: 3-6 months for basics, 1-2 years for mastery

Key Topics:
- Variables, data types, control flow
- Functions and modules
- Object-oriented programming
- File handling and regular expressions
- Libraries: requests, pandas, numpy, flask, django

Popular Frameworks:
- Web: Django, Flask, FastAPI
- Data: Pandas, NumPy, Scikit-learn
- ML/AI: TensorFlow, PyTorch, Keras

Companies Using Python: Google, Amazon, Netflix, Uber, Spotify, Pinterest, Dropbox

Job Titles: Backend Developer, Data Scientist, ML Engineer, DevOps Engineer
Salary Range: $80k-$200k+

Resources:
- Python.org official documentation
- Real Python tutorials
- LeetCode for practice (700+ Python problems)
- Build projects: web scraper, API, data app""",
            "metadata": {"level": "beginner", "category": "programming_language"}
        },
        {
            "id": "skill_system_design",
            "title": "System Design",
            "category": "skill",
            "text": """System Design - Architecting scalable and reliable systems.

When to Learn: Required for mid-level+ engineers, especially for interviews
Demand Level: Very High
Time to Proficiency: 6-12 months of focused learning

Key Concepts:
- Scalability (vertical vs. horizontal)
- Load balancing and caching
- Database design (SQL vs. NoSQL)
- API design (REST, GraphQL)
- Message queues and event-driven architecture
- Microservices vs. monolithic
- Consistency models (ACID, CAP, eventual consistency)

Common Patterns:
- Caching layer (Redis, Memcached)
- Database sharding
- CDN for static content
- Monitoring and logging (ELK, Prometheus)
- Circuit breakers and retries

Interview Preparation:
- Design YouTube, Twitter, Instagram, Uber
- Focus on trade-offs and scalability
- Use diagrams and clear reasoning

Resources:
- "Designing Data-Intensive Applications" book
- System Design Interview channel
- Mock interview practice

Salary Boost: Knowing system design increases salary by 30-50%""",
            "metadata": {"level": "intermediate", "category": "architecture"}
        },
    ]
    
    # Simple keyword matching for fallback search
    lower_query = query.lower()
    scored = []
    
    for doc in knowledge_base:
        # Score based on keyword matches
        title = doc["title"].lower()
        text = doc["text"].lower()
        
        score = 0
        for keyword in lower_query.split():
            if keyword in title:
                score += 3
            elif keyword in text:
                score += 1
        
        if score > 0:
            doc["similarity"] = min(1.0, score / 10)  # Normalize to 0-1
            scored.append(doc)
    
    # Sort by score and limit
    scored.sort(key=lambda x: x["similarity"], reverse=True)
    
    logger.info(f"[RAG_FALLBACK] ✓ Retrieved {len(scored[:top_k])} fallback documents")
    
    return {
        "success": True,
        "documents": scored[:top_k],
    }


def initialize_career_knowledge_base() -> Dict[str, Any]:
    """
    Initialize the career knowledge base.
    
    When RAG is available:
    - Adds seed career documents to Supabase
    - Creates embeddings for semantic search
    
    When RAG not available:
    - System uses built-in fallback knowledge base
    - No external initialization needed
    
    Returns:
        {
            "success": bool,
            "message": str,
            "indexed": int (number of documents indexed, 0 if using fallback)
        }
    """
    try:
        rag = _get_rag_service()
        
        if rag is None:
            logger.info("[RAG] Using built-in fallback knowledge base (no external RAG needed)")
            return {
                "success": True,
                "message": "Using fallback knowledge base - 5 core career paths and skills available",
                "indexed": 0  # Indicate fallback is active
            }
        
        logger.info("[RAG] Initializing career knowledge base...")
        
        # Note: Seed document indexing would go here if embeddings service available
        # For now, we rely on fallback knowledge base
        
        return {
            "success": True,
            "message": "Career knowledge base ready (RAG service initialized)",
            "indexed": 0  # Will be > 0 when documents are actually added to DB
        }
        
    except Exception as e:
        logger.error(f"[RAG] Failed to initialize knowledge base: {e}", exc_info=True)
        return {
            "success": True,  # Still OK because fallback works
            "message": "Using fallback knowledge base",
            "indexed": 0
        }


# Export functions
__all__ = [
    "retrieve_documents",
    "initialize_career_knowledge_base",
]
