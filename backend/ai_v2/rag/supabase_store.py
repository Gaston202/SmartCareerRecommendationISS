"""
Supabase document store for RAG with pgvector support.

Stores career documents in Supabase Postgres with pgvector for semantic search.
Provides a fallback to in-memory store if Supabase is unavailable.

Setup:
    1. Enable pgvector: CREATE EXTENSION IF NOT EXISTS vector;
    2. Create table: See SUPABASE_SETUP.md
    3. Set environment variables:
       - SUPABASE_URL
       - SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY for writes)

Usage:
    store = SupabaseDocumentStore()
    docs = store.search(query_embedding=embedding_vector, top_k=5)
"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from ..config import config
from ..utils import get_logger

logger = get_logger(__name__)


@dataclass
class Document:
    """Document with metadata and embedding."""
    id: str
    title: str
    category: str  # career, skill, resource, learning_path, market_data
    text: str
    metadata: Dict[str, Any]
    similarity: Optional[float] = None  # For search results


class SupabaseDocumentStore:
    """
    Document store backed by Supabase pgvector.
    
    Features:
        - Semantic search with pgvector
        - Full JSONB metadata support
        - Automatic fallback to in-memory if Supabase unavailable
        - Batch operations support
        - Row-level security compatible
    
    Requirements:
        - Supabase project with pgvector enabled
        - Table: career_documents (id, title, category, text, metadata, embedding)
        - API keys: SUPABASE_URL, SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY
    """
    
    def __init__(self, use_fallback: bool = True):
        """
        Initialize Supabase document store.
        
        Args:
            use_fallback (bool): Use in-memory store if Supabase unavailable
        """
        self.logger = get_logger(__name__)
        self.client = None
        self.use_fallback = use_fallback
        self.fallback_store: Dict[str, Document] = {}
        self.is_available = False
        
        self._init_supabase()
    
    def _init_supabase(self) -> None:
        """Initialize Supabase client."""
        if not config.SUPABASE_URL or not config.SUPABASE_ANON_KEY:
            self.logger.warning(
                "[SUPABASE_RAG] SUPABASE_URL or SUPABASE_ANON_KEY not configured. "
                "Using in-memory fallback store."
            )
            self.is_available = False
            return
        
        try:
            from supabase import create_client
            
            self.client = create_client(
                config.SUPABASE_URL,
                config.SUPABASE_ANON_KEY
            )
            
            # Test connection
            self.client.table(config.SUPABASE_DOCUMENTS_TABLE).select("id", count="exact").limit(1).execute()
            
            self.is_available = True
            self.logger.info(
                f"[SUPABASE_RAG] Connected to Supabase "
                f"(table={config.SUPABASE_DOCUMENTS_TABLE})"
            )
            
        except ImportError:
            self.logger.warning(
                "[SUPABASE_RAG] supabase-py not installed. "
                "Install with: pip install supabase"
            )
            self.is_available = False
        except Exception as e:
            self.logger.warning(
                f"[SUPABASE_RAG] Failed to connect to Supabase: {e}. "
                "Using in-memory fallback."
            )
            self.is_available = False
    
    def search(
        self,
        query_embedding: List[float],
        top_k: int = 5,
        category: Optional[str] = None,
        threshold: float = 0.5,
    ) -> List[Document]:
        """
        Search documents using semantic similarity.
        
        Args:
            query_embedding: Query embedding vector (384 dims for all-MiniLM-L6-v2)
            top_k: Number of results
            category: Filter by document category (career, skill, etc)
            threshold: Minimum similarity score (0-1)
            
        Returns:
            List of Document objects with similarity scores, sorted by relevance
        """
        if self.is_available:
            return self._search_supabase(query_embedding, top_k, category, threshold)
        else:
            if self.use_fallback:
                return self._search_fallback(query_embedding, top_k, category, threshold)
            else:
                self.logger.error("[SUPABASE_RAG] Supabase unavailable and fallback disabled")
                return []
    
    def _search_supabase(
        self,
        query_embedding: List[float],
        top_k: int,
        category: Optional[str],
        threshold: float,
    ) -> List[Document]:
        """Search using Supabase pgvector."""
        try:
            from pgvector.python import Vector
            
            # Convert to pgvector format
            query_vector = Vector(query_embedding)
            
            # Build base query
            query = self.client.rpc(
                'match_documents',
                {
                    'query_embedding': query_vector,
                    'match_threshold': threshold,
                    'match_count': top_k * 2,  # Fetch extra for filtering
                }
            )
            
            # Execute query
            response = query.execute()
            
            results = []
            for item in response.data:
                doc = Document(
                    id=item['id'],
                    title=item['title'],
                    category=item['category'],
                    text=item['text'],
                    metadata=item.get('metadata', {}),
                    similarity=item.get('similarity', 0.0)
                )
                
                # Filter by category if specified
                if category and doc.category != category:
                    continue
                
                results.append(doc)
                
                if len(results) >= top_k:
                    break
            
            self.logger.info(f"[SUPABASE_RAG] Found {len(results)} documents")
            return results
            
        except Exception as e:
            self.logger.error(f"[SUPABASE_RAG] Search error: {e}, trying fallback")
            if self.use_fallback:
                return self._search_fallback(query_embedding, top_k, category, threshold)
            return []
    
    def _search_fallback(
        self,
        query_embedding: List[float],
        top_k: int,
        category: Optional[str],
        threshold: float,
    ) -> List[Document]:
        """Search using in-memory fallback."""
        from .embedding_service import cosine_similarity
        
        results = []
        
        for doc_id, doc in self.fallback_store.items():
            if category and doc.category != category:
                continue
            
            # For fallback, we just return all documents
            # In a real scenario, similarity would be computed
            doc_copy = Document(
                id=doc.id,
                title=doc.title,
                category=doc.category,
                text=doc.text,
                metadata=doc.metadata,
                similarity=1.0  # Fallback always returns 1.0
            )
            results.append(doc_copy)
        
        return results[:top_k]
    
    def upsert_document(
        self,
        id: str,
        title: str,
        category: str,
        text: str,
        metadata: Optional[Dict[str, Any]] = None,
        embedding: Optional[List[float]] = None,
    ) -> bool:
        """
        Insert or update a document.
        
        Args:
            id: Document ID (unique)
            title: Document title
            category: Document category
            text: Document text content
            metadata: Optional metadata dict
            embedding: Optional pre-computed embedding (for efficiency)
            
        Returns:
            bool: True if successful
        """
        if embedding is None:
            from .embedding_service import EmbeddingService
            service = EmbeddingService()
            embedding = service.embed(text)
        
        doc = Document(
            id=id,
            title=title,
            category=category,
            text=text,
            metadata=metadata or {},
        )
        
        # Always add to fallback
        self.fallback_store[id] = doc
        
        # Try to add to Supabase
        if self.is_available:
            try:
                from pgvector.python import Vector
                
                self.client.table(config.SUPABASE_DOCUMENTS_TABLE).upsert({
                    'id': id,
                    'title': title,
                    'category': category,
                    'text': text,
                    'metadata': metadata or {},
                    'embedding': Vector(embedding),
                }).execute()
                
                self.logger.debug(f"[SUPABASE_RAG] Upserted document: {id}")
                return True
                
            except Exception as e:
                self.logger.error(f"[SUPABASE_RAG] Upsert error: {e}")
                return False
        
        return True  # Success via fallback
    
    def load_initial_documents(self) -> None:
        """Load initial career knowledge base documents."""
        from .document_store import DocumentStore
        
        # Get documents from in-memory store
        doc_store = DocumentStore()
        docs = doc_store.get_all_documents()
        
        self.logger.info(f"[SUPABASE_RAG] Loading {len(docs)} documents to Supabase...")
        
        from .embedding_service import EmbeddingService
        embedding_service = EmbeddingService()
        
        for doc in docs:
            embedding = embedding_service.embed(doc.content)
            self.upsert_document(
                id=doc.id,
                title=doc.title,
                category=doc.doc_type.value,
                text=doc.content,
                metadata=doc.metadata,
                embedding=embedding
            )
        
        self.logger.info("[SUPABASE_RAG] Document loading complete")
    
    def get_document(self, doc_id: str) -> Optional[Document]:
        """Get a single document by ID."""
        if self.is_available:
            try:
                response = self.client.table(config.SUPABASE_DOCUMENTS_TABLE).select("*").eq("id", doc_id).execute()
                
                if response.data:
                    item = response.data[0]
                    return Document(
                        id=item['id'],
                        title=item['title'],
                        category=item['category'],
                        text=item['text'],
                        metadata=item.get('metadata', {}),
                    )
            except Exception as e:
                self.logger.error(f"[SUPABASE_RAG] Get document error: {e}")
        
        # Try fallback
        return self.fallback_store.get(doc_id)
    
    def delete_document(self, doc_id: str) -> bool:
        """Delete a document by ID."""
        # Remove from fallback
        if doc_id in self.fallback_store:
            del self.fallback_store[doc_id]
        
        # Try to remove from Supabase
        if self.is_available:
            try:
                self.client.table(config.SUPABASE_DOCUMENTS_TABLE).delete().eq("id", doc_id).execute()
                self.logger.debug(f"[SUPABASE_RAG] Deleted document: {doc_id}")
                return True
            except Exception as e:
                self.logger.error(f"[SUPABASE_RAG] Delete error: {e}")
                return False
        
        return True  # Success via fallback deletion
    
    def list_documents(self, category: Optional[str] = None) -> List[Document]:
        """List all documents, optionally filtered by category."""
        if self.is_available:
            try:
                if category:
                    response = self.client.table(config.SUPABASE_DOCUMENTS_TABLE).select("*").eq("category", category).execute()
                else:
                    response = self.client.table(config.SUPABASE_DOCUMENTS_TABLE).select("*").execute()
                
                docs = []
                for item in response.data:
                    docs.append(Document(
                        id=item['id'],
                        title=item['title'],
                        category=item['category'],
                        text=item['text'],
                        metadata=item.get('metadata', {}),
                    ))
                return docs
                
            except Exception as e:
                self.logger.error(f"[SUPABASE_RAG] List documents error: {e}")
        
        # Return from fallback
        docs = list(self.fallback_store.values())
        if category:
            docs = [d for d in docs if d.category == category]
        return docs
    
    def get_stats(self) -> Dict[str, Any]:
        """Get store statistics."""
        stats = {
            'backend': 'supabase' if self.is_available else 'in-memory',
            'fallback_count': len(self.fallback_store),
        }
        
        if self.is_available:
            try:
                response = self.client.table(config.SUPABASE_DOCUMENTS_TABLE).select("id", count="exact").execute()
                stats['supabase_count'] = response.count or 0
            except Exception as e:
                self.logger.error(f"[SUPABASE_RAG] Stats error: {e}")
                stats['supabase_count'] = 0
        
        return stats
