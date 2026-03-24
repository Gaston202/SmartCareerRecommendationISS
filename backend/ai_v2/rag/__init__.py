"""
RAG (Retrieval-Augmented Generation) package for AI v2 module.

Provides semantic search using FREE local embeddings and flexible document storage:
- In-memory storage (no external dependencies)
- Supabase pgvector (production-ready semantic search)

Setup:
    pip install sentence-transformers torch
    # For Supabase: pip install supabase

Usage:
    from backend.ai_v2.rag import RAGRetriever, EmbeddingService
    
    # Default: uses in-memory store with local embeddings
    retriever = RAGRetriever()
    results = retriever.search("Python backend engineer")
    
    # With Supabase (set USE_SUPABASE_RAG=true in config)
    retriever = RAGRetriever(use_supabase=True)
    results = retriever.search_by_role("Backend Engineer")
"""

from .document_store import DocumentStore, Document, DocumentType
from .embedding_service import EmbeddingService, cosine_similarity, top_k_similar
from .retriever import RAGRetriever
from .supabase_store import SupabaseDocumentStore

# Alias for backwards compatibility
Retriever = RAGRetriever
VectorStore = SupabaseDocumentStore

__all__ = [
    # Document store (in-memory)
    "DocumentStore",
    "Document",
    "DocumentType",
    # Embeddings (FREE local embeddings)
    "EmbeddingService",
    "cosine_similarity",
    "top_k_similar",
    # Retriever (orchestrator)
    "RAGRetriever",
    "Retriever",  # Alias for backwards compatibility
    # Supabase backend
    "SupabaseDocumentStore",
    "VectorStore",  # Alias for backwards compatibility
]
