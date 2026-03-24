"""
Supabase RAG integration for knowledge base retrieval.

Stores and retrieves documents with embeddings using Supabase pgvector.
Enables grounded recommendations based on real career data and resources.
"""

from typing import Any, Dict, List, Optional
import json
from ..config import config
from ..utils import get_logger

logger = get_logger(__name__)


class SupabaseRAG:
    """
    RAG system using Supabase pgvector for vector storage.
    
    Features:
        - Store embeddings with documents in Supabase
        - Semantic search using pgvector
        - Metadata filtering
        - Document management (upsert, delete, search)
    
    Prerequisites:
        - Supabase project with pgvector extension
        - Environment variables: SUPABASE_URL, SUPABASE_KEY
        - Tables: documents, embeddings (created by migration)
    """
    
    def __init__(self, client=None, embedding_service=None):
        """
        Initialize Supabase RAG.
        
        Args:
            client: Supabase client instance
            embedding_service: Service for generating embeddings
        """
        self.client = client
        self.embedding_service = embedding_service
        self.logger = get_logger(__name__)
        
        # Lazy initialization of Supabase client
        if not self.client:
            self._init_supabase_client()
    
    def _init_supabase_client(self):
        """Initialize Supabase client from environment."""
        try:
            from supabase import create_client
            
            supabase_url = config.SUPABASE_URL if hasattr(config, 'SUPABASE_URL') else None
            supabase_key = config.SUPABASE_KEY if hasattr(config, 'SUPABASE_KEY') else None
            
            if not supabase_url or not supabase_key:
                self.logger.warning(
                    "[RAG] SUPABASE_URL or SUPABASE_KEY not configured. "
                    "RAG will operate in mock mode."
                )
                return
            
            self.client = create_client(supabase_url, supabase_key)
            self.logger.info("[RAG] Supabase client initialized")
        except ImportError:
            self.logger.warning("[RAG] supabase library not installed. Install with: pip install supabase")
        except Exception as e:
            self.logger.error(f"[RAG] Failed to initialize Supabase client: {str(e)}")
    
    def index_documents(
        self,
        documents: List[Dict[str, Any]],
        collection: str = "career_resources"
    ) -> Dict[str, Any]:
        """
        Index documents with embeddings in Supabase.
        
        Args:
            documents (List[Dict]): Documents to index
                - Required fields: id, content
                - Optional: title, type, metadata
            collection (str): Collection/category name
            
        Returns:
            Dict: Indexing result
        """
        if not self.client or not self.embedding_service:
            self.logger.warning("[RAG] Cannot index: missing Supabase client or embedding service")
            return {"success": False, "error": "Not configured"}
        
        self.logger.info(f"[RAG] Indexing {len(documents)} documents to collection: {collection}")
        
        indexed = 0
        errors = []
        
        for doc in documents:
            try:
                doc_id = doc.get("id")
                content = doc.get("content")
                
                if not doc_id or not content:
                    errors.append(f"Document missing id or content: {doc.get('id')}")
                    continue
                
                # Generate embedding
                embedding = self.embedding_service.embed(content)
                
                # Prepare document record
                record = {
                    "id": doc_id,
                    "collection": collection,
                    "title": doc.get("title", "Untitled"),
                    "content": content,
                    "content_type": doc.get("type", "resource"),
                    "metadata": json.dumps(doc.get("metadata", {})),
                    "embedding": embedding,
                }
                
                # Upsert to Supabase
                # NOTE: Requires documents table with pgvector column
                try:
                    self.client.table("documents").upsert(record).execute()
                    indexed += 1
                except Exception as e:
                    errors.append(f"Failed to upsert {doc_id}: {str(e)}")
            
            except Exception as e:
                errors.append(f"Error indexing document: {str(e)}")
        
        result = {
            "success": len(errors) == 0,
            "indexed": indexed,
            "total": len(documents),
            "errors": errors if errors else None
        }
        
        self.logger.info(f"[RAG] Indexing complete: {indexed}/{len(documents)} documents indexed")
        return result
    
    def search(
        self,
        query: str,
        top_k: int = 5,
        collection: Optional[str] = None,
        threshold: float = 0.5,
    ) -> List[Dict[str, Any]]:
        """
        Semantic search using pgvector.
        
        Args:
            query (str): Search query
            top_k (int): Number of results to return
            collection (Optional[str]): Filter by collection
            threshold (float): Similarity threshold (0-1)
            
        Returns:
            List[Dict]: Search results with content and similarity scores
        """
        if not self.client or not self.embedding_service:
            self.logger.debug("[RAG] Returning mock results (not configured)")
            return self._mock_search(query, top_k)
        
        try:
            self.logger.debug(f"[RAG] Searching for: {query}")
            
            # Generate query embedding
            query_embedding = self.embedding_service.embed(query)
            
            # Search using pgvector similarity
            # This depends on your Supabase SQL function/RPC
            # Example RPC call:
            try:
                results = self.client.rpc(
                    "search_documents",
                    {
                        "query_embedding": query_embedding,
                        "match_threshold": threshold,
                        "match_count": top_k,
                        "collection_filter": collection,
                    }
                ).execute()
                
                self.logger.info(f"[RAG] Found {len(results.data)} results")
                return results.data or []
            except Exception as e:
                self.logger.warning(f"[RAG] RPC search failed, trying direct query: {str(e)}")
                # Fallback: direct query (less efficient but doesn't require RPC)
                query_data = self.client.table("documents").select("*").execute()
                
                if not query_data.data:
                    return []
                
                # Score results by approximate similarity
                scored = []
                for doc in query_data.data:
                    doc_embedding = doc.get("embedding", [])
                    similarity = self._cosine_similarity(query_embedding, doc_embedding)
                    
                    if similarity >= threshold:
                        scored.append({
                            **doc,
                            "similarity": similarity
                        })
                
                # Sort by similarity and limit
                scored.sort(key=lambda x: x["similarity"], reverse=True)
                return scored[:top_k]
        
        except Exception as e:
            self.logger.error(f"[RAG] Search error: {str(e)}")
            return self._mock_search(query, top_k)
    
    def add_career_documents(self) -> Dict[str, Any]:
        """
        Add sample career and resource documents to knowledge base.
        
        This initializes the RAG with real career data.
        """
        sample_docs = [
            {
                "id": "backend-eng-req",
                "title": "Backend Engineer Requirements",
                "type": "career",
                "content": (
                    "Backend Engineer Role Requirements: "
                    "Proficiency in Python, Java, or Go. Experience with SQL and NoSQL databases. "
                    "RESTful API design and microservices architecture. Docker and Kubernetes. "
                    "CI/CD pipelines and version control. System design and scalability concepts. "
                    "5+ years experience preferred, 2+ years minimum."
                ),
                "metadata": {"role": "Backend Engineer", "level": "mid"}
            },
            {
                "id": "data-scientist-req",
                "title": "Data Scientist Requirements",
                "type": "career",
                "content": (
                    "Data Scientist Role Requirements: "
                    "Strong Python and SQL skills. Statistics and probability knowledge. "
                    "Machine learning frameworks: scikit-learn, TensorFlow, PyTorch. "
                    "Data visualization tools: Matplotlib, Tableau. "
                    "Experience with big data tools: Spark, Hadoop. "
                    "3+ years experience with real-world ML projects."
                ),
                "metadata": {"role": "Data Scientist", "level": "mid"}
            },
            {
                "id": "devops-req",
                "title": "DevOps Engineer Requirements",
                "type": "career",
                "content": (
                    "DevOps Engineer Role Requirements: "
                    "Expert-level Docker and Kubernetes. AWS or GCP or Azure. "
                    "Infrastructure as Code: Terraform, CloudFormation. "
                    "CI/CD tools: Jenkins, GitLab CI, GitHub Actions. "
                    "Monitoring and logging: Prometheus, ELK, Datadog. "
                    "Linux system administration and networking basics. "
                    "4+ years infrastructure or DevOps experience."
                ),
                "metadata": {"role": "DevOps Engineer", "level": "mid"}
            },
            {
                "id": "python-learning",
                "title": "Python Learning Path",
                "type": "resource",
                "content": (
                    "Python Learning Path: Start with fundamentals - variables, data types, control flow. "
                    "Progress to functions, modules, and OOP. Study algorithms and data structures. "
                    "Advanced: decorators, generators, async programming. "
                    "Recommended resources: Python.org docs, RealPython, CodeAcademy courses. "
                    "12-16 weeks to intermediate proficiency."
                ),
                "metadata": {"skill": "Python", "duration_weeks": 16}
            },
            {
                "id": "sql-learning",
                "title": "SQL Database Mastery",
                "type": "resource",
                "content": (
                    "SQL Learning: Foundation in SELECT, INSERT, UPDATE, DELETE. "
                    "Joins, aggregations, and subqueries. "
                    "Indexes, performance optimization, and query planning. "
                    "Transactions and ACID properties. "
                    "NoSQL basics: MongoDB, Redis. "
                    "8-12 weeks to working proficiency."
                ),
                "metadata": {"skill": "SQL", "duration_weeks": 12}
            },
        ]
        
        self.logger.info("[RAG] Loading sample career documents")
        return self.index_documents(sample_docs, collection="career_resources")
    
    def _mock_search(self, query: str, top_k: int) -> List[Dict[str, Any]]:
        """Return mock search results (fallback when not configured)."""
        return [
            {
                "id": f"mock-result-{i}",
                "content": f"Mock search result for '{query}' - Result {i+1}: This is a simulated result. In production, real documents would be retrieved from the knowledge base.",
                "similarity": 0.8 - (i * 0.1),
                "source": "mock"
            }
            for i in range(min(top_k, 3))
        ]
    
    @staticmethod
    def _cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
        """Calculate cosine similarity between two vectors."""
        if not vec1 or not vec2:
            return 0.0
        
        dot_product = sum(a * b for a, b in zip(vec1, vec2))
        mag1 = sum(a * a for a in vec1) ** 0.5
        mag2 = sum(b * b for b in vec2) ** 0.5
        
        if mag1 == 0 or mag2 == 0:
            return 0.0
        
        return dot_product / (mag1 * mag2)
