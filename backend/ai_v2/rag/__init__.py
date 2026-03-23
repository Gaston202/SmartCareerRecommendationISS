"""
RAG (Retrieval-Augmented Generation) package for AI v2 module.

Handles embeddings, vector storage, and retrieval of external knowledge.
"""

from .retriever import Retriever
from .embeddings import EmbeddingService
from .vector_store import VectorStore

__all__ = [
    "Retriever",
    "EmbeddingService",
    "VectorStore",
]
