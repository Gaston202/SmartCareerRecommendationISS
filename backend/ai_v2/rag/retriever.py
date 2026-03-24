"""
Retriever for RAG system.

Orchestrates semantic search using local embeddings + document store.
Supports both in-memory and Supabase pgvector backends.

Usage:
    from rag.retriever import RAGRetriever
    
    # Default: uses in-memory store with local embeddings
    retriever = RAGRetriever()
    results = retriever.search("Python backend engineer skills")
    
    # With Supabase: set USE_SUPABASE_RAG=true in config
    retriever = RAGRetriever(use_supabase=True)
    results = retriever.search("Data scientist requirements")
"""

from typing import List, Dict, Any, Optional
from ..config import config
from ..utils import get_logger
from .embedding_service import EmbeddingService, cosine_similarity
from .document_store import DocumentStore, Document, DocumentType

logger = get_logger(__name__)


class RAGRetriever:
    """
    Semantic search engine for career knowledge base.
    
    Features:
        - FREE local embeddings (sentence-transformers)
        - Supports in-memory and Supabase pgvector backends
        - Semantic search using cosine similarity
        - Metadata filtering (document type, tags)
        - Top-k retrieval with threshold filtering
        - Smart query expansion for roles and skills
    
    Design:
        - Document store (in-memory or Supabase)
        - Embeddings cached locally
        - Automatic fallback if backend unavailable
    """
    
    def __init__(
        self,
        embedding_service: Optional[EmbeddingService] = None,
        use_supabase: Optional[bool] = None,
    ):
        """
        Initialize retriever.
        
        Args:
            embedding_service: Optional custom embedding service (for testing)
            use_supabase: Use Supabase backend. Defaults to config.USE_SUPABASE_RAG
        """
        self.logger = get_logger(__name__)
        self.embedding_service = embedding_service or EmbeddingService()
        self.embeddings_cache: Dict[str, List[float]] = {}
        
        # Determine which store to use
        use_supabase = use_supabase or config.USE_SUPABASE_RAG
        
        if use_supabase:
            self._init_supabase_store()
        else:
            self._init_memory_store()
    
    def _init_memory_store(self) -> None:
        """Initialize in-memory document store."""
        self.logger.info("[RAG] Using in-memory document store")
        self.doc_store = DocumentStore()
        self.use_supabase = False
        self._index_documents()
    
    def _init_supabase_store(self) -> None:
        """Initialize Supabase-backed document store."""
        try:
            from .supabase_store import SupabaseDocumentStore
            
            self.logger.info("[RAG] Initializing Supabase document store...")
            self.supabase_store = SupabaseDocumentStore(use_fallback=True)
            self.use_supabase = True
            
            if not self.supabase_store.is_available:
                self.logger.warning("[RAG] Supabase unavailable, falling back to in-memory")
                self._init_memory_store()
            else:
                self.logger.info("[RAG] Supabase store initialized successfully")
        
        except Exception as e:
            self.logger.error(f"[RAG] Failed to init Supabase store: {e}, using in-memory")
            self._init_memory_store()
    
    def _index_documents(self) -> None:
        """Generate and cache embeddings for all documents (in-memory store only)."""
        if self.use_supabase:
            return  # Supabase handles indexing
        
        self.logger.info("[LOCAL_EMBEDDINGS] Indexing documents...")
        
        docs = self.doc_store.get_all_documents()
        texts = [doc.content for doc in docs]
        
        # Generate embeddings in batch
        embeddings_list = self.embedding_service.embed_batch(texts)
        
        # Cache embeddings
        for doc, embedding in zip(docs, embeddings_list):
            self.embeddings_cache[doc.id] = embedding
        
        self.logger.info(f"[LOCAL_EMBEDDINGS] Indexed {len(docs)} documents with embeddings")
    
    def search(
        self,
        query: str,
        top_k: int = 5,
        doc_type: Optional[str] = None,
        threshold: float = 0.4,
    ) -> List[Dict[str, Any]]:
        """
        Semantic search for documents.
        
        Args:
            query (str): Search query (e.g., "Python backend engineer")
            top_k (int): Number of results to return (default: 5)
            doc_type (Optional[str]): Filter by type: "career", "skill", "resource", etc.
            threshold (float): Minimum similarity score (0-1), default: 0.4 (lowered from 0.5 for better recall)
            
        Returns:
            List of documents with similarity scores, ranked by relevance
            
        Example:
            >>> retriever = RAGRetriever()
            >>> results = retriever.search("Python backend engineer", top_k=3)
            >>> for doc in results:
            ...     print(f"{doc['title']} ({doc['similarity']})")
        """
        self.logger.debug(f"[RAG] Search: {query} (top_k={top_k}, type={doc_type})")
        
        if self.use_supabase:
            return self._search_supabase(query, top_k, doc_type, threshold)
        else:
            return self._search_memory(query, top_k, doc_type, threshold)
    
    def _search_memory(
        self,
        query: str,
        top_k: int,
        doc_type: Optional[str],
        threshold: float,
    ) -> List[Dict[str, Any]]:
        """Search using in-memory document store."""
        # Get query embedding
        query_embedding = self.embedding_service.embed(query)
        
        # Get candidate documents
        if doc_type:
            doc_enum = DocumentType(doc_type)
            candidates = self.doc_store.search_by_type(doc_enum)
        else:
            candidates = self.doc_store.get_all_documents()
        
        self.logger.debug(f"[RAG] {len(candidates)} candidates after filters")
        
        # Score candidates
        results = []
        for doc in candidates:
            embedding = self.embeddings_cache.get(doc.id)
            if embedding is None:
                continue
            
            similarity = cosine_similarity(query_embedding, embedding)
            if similarity >= threshold:
                results.append({
                    "id": doc.id,
                    "title": doc.title,
                    "text": doc.content,
                    "category": doc.doc_type.value,
                    "metadata": doc.metadata,
                    "tags": doc.tags,
                    "similarity": round(similarity, 4),
                })
        
        # Sort by similarity descending
        results.sort(key=lambda x: x["similarity"], reverse=True)
        final_results = results[:top_k]
        
        self.logger.info(f"[RAG] Found {len(final_results)} results")
        return final_results
    
    def _search_supabase(
        self,
        query: str,
        top_k: int,
        doc_type: Optional[str],
        threshold: float,
    ) -> List[Dict[str, Any]]:
        """Search using Supabase pgvector backend."""
        try:
            # Get query embedding
            query_embedding = self.embedding_service.embed(query)
            
            # Search Supabase
            docs = self.supabase_store.search(
                query_embedding=query_embedding,
                top_k=top_k,
                category=doc_type,
                threshold=threshold,
            )
            
            # Convert to result format
            results = [
                {
                    "id": doc.id,
                    "title": doc.title,
                    "text": doc.text,
                    "category": doc.category,
                    "metadata": doc.metadata,
                    "tags": doc.metadata.get("tags", []),
                    "similarity": doc.similarity or 0.0,
                }
                for doc in docs
            ]
            
            self.logger.info(f"[RAG] Found {len(results)} results from Supabase")
            return results
            
        except Exception as e:
            self.logger.error(f"[RAG] Supabase search error: {e}, falling back to memory")
            return self._search_memory(query, top_k, doc_type, threshold)
    
    def search_by_role(
        self,
        role: str,
        include_skills: bool = True,
        include_paths: bool = True,
        include_resources: bool = True,
        top_k: int = 3,
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Specialized search for career role information.
        
        Args:
            role (str): Career role name (e.g., "Backend Engineer")
            include_skills (bool): Include required skills
            include_paths (bool): Include learning paths
            include_resources (bool): Include resources
            top_k (int): Results per category
            
        Returns:
            Dict grouping results by type:
            {
                "career": [...],
                "skills": [...],
                "learning_path": [...],
                "resources": [...]
            }
        """
        self.logger.debug(f"[RAG] Career search for: {role}")
        
        results = {
            "career": [],
            "skills": [],
            "learning_path": [],
            "resources": [],
        }
        
        # Get career info
        career_results = self.search(
            query=role,
            doc_type="career",
            top_k=1,
            threshold=0.3  # Lower threshold for career matching
        )
        results["career"] = career_results
        
        if not career_results:
            self.logger.warning(f"[RAG] No career info found for: {role}")
            return results
        
        # Get required skills
        if include_skills:
            skills_query = f"skills for {role}"
            skills_results = self.search(
                query=skills_query,
                doc_type="skill",
                top_k=top_k,
                threshold=0.35  # Lowered from 0.5 for better recall
            )
            results["skills"] = skills_results
        
        # Get learning paths
        if include_paths:
            path_query = f"become {role}"
            path_results = self.search(
                query=path_query,
                doc_type="learning_path",
                top_k=1,
                threshold=0.35  # Lowered from 0.4
            )
            results["learning_path"] = path_results
        
        # Get resources
        if include_resources:
            resources_query = f"learn for {role}"
            resource_results = self.search(
                query=resources_query,
                doc_type="resource",
                top_k=top_k,
                threshold=0.35  # Lowered from 0.4
            )
            results["resources"] = resource_results
        
        return results
    
    def search_by_skill(
        self,
        skill: str,
        top_k: int = 3,
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Specialized search for skill information.
        
        Args:
            skill (str): Skill name (e.g., "Python", "Docker")
            top_k (int): Results per category
            
        Returns:
            Dict with skill info and related content
        """
        self.logger.debug(f"[RAG] Skill search for: {skill}")
        
        results = {
            "skill_description": [],
            "matching_careers": [],
            "learning_resources": [],
        }
        
        # Get skill description
        skill_results = self.search(
            query=skill,
            doc_type="skill",
            top_k=1,
            threshold=0.4  # Lowered from 0.5
        )
        results["skill_description"] = skill_results
        
        # Get careers that need this skill
        career_query = f"roles requiring {skill}"
        career_results = self.search(
            query=career_query,
            doc_type="career",
            top_k=top_k,
            threshold=0.35  # Lowered from 0.4
        )
        results["matching_careers"] = career_results
        
        # Get learning resources
        resource_query = f"learn {skill}"
        resource_results = self.search(
            query=resource_query,
            doc_type="resource",
            top_k=top_k,
            threshold=0.35  # Lowered from 0.4
        )
        results["learning_resources"] = resource_results
        
        return results
    
    def get_stats(self) -> Dict[str, Any]:
        """Get retriever statistics."""
        if self.use_supabase:
            return self.supabase_store.get_stats()
        
        # In-memory stats
        doc_counts = {}
        for doc_type in DocumentType:
            count = len(self.doc_store.search_by_type(doc_type))
            doc_counts[doc_type.value] = count
        
        return {
            "backend": "in-memory",
            "total_documents": self.doc_store.count(),
            "documents_by_type": doc_counts,
            "embeddings_cached": len(self.embeddings_cache),
            "embedding_cache_size_mb": round(
                sum(len(emb) * 4 / 1024 / 1024 for emb in self.embeddings_cache.values()),
                2
            ),
        }
    
    def list_careers(self) -> List[Dict[str, Any]]:
        """Get all available careers in knowledge base."""
        if self.use_supabase:
            docs = self.supabase_store.list_documents(category="career")
        else:
            docs = self.doc_store.search_by_type(DocumentType.CAREER)
        
        return [
            {
                "id": doc.id,
                "title": doc.title,
                "level": doc.metadata.get("level"),
                "salary_min": doc.metadata.get("salary_min"),
                "salary_max": doc.metadata.get("salary_max"),
            }
            for doc in docs
        ]
    
    def list_skills(self) -> List[Dict[str, Any]]:
        """Get all available skills in knowledge base."""
        if self.use_supabase:
            docs = self.supabase_store.list_documents(category="skill")
        else:
            docs = self.doc_store.search_by_type(DocumentType.SKILL)
        
        return [
            {
                "id": doc.id,
                "title": doc.title,
                "difficulty": doc.metadata.get("difficulty"),
                "weeks_to_learn": doc.metadata.get("weeks_to_learn"),
            }
            for doc in docs
        ]
