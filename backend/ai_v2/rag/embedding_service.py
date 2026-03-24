"""
Embedding service for RAG with local and OpenAI support.

Generates vector embeddings using:
- sentence-transformers (LOCAL, FREE, no API key needed)
- OpenAI API (requires API key, costs money)

Provides caching and batch processing for efficiency.

Setup:
    pip install sentence-transformers torch

Usage:
    # Default: uses local embeddings
    service = EmbeddingService()
    embedding = service.embed("Python backend engineer")
    
    # Switch to OpenAI (requires OPENAI_API_KEY)
    service = EmbeddingService(provider="openai")
"""

from typing import List, Dict, Optional
import hashlib
import numpy as np
from ..config import config
from ..utils import get_logger

logger = get_logger(__name__)


class EmbeddingService:
    """
    Service for generating text embeddings.
    
    Features:
        - Local embeddings via sentence-transformers (FREE, NO API KEY)
        - OpenAI embedding API integration (requires API key)
        - Automatic fallback if provider unavailable
        - In-memory caching
        - Batch processing support
        - Configurable models
    
    Providers:
        - "local": sentence-transformers (default, free)
        - "openai": OpenAI API (requires OPENAI_API_KEY)
    
    Performance:
        - Local: ~50ms per embedding (after model warmup)
        - OpenAI: ~300-400ms per embedding (includes API latency)
        - Batch: ~1ms per embedding (both providers)
    """
    
    def __init__(self, provider: Optional[str] = None, use_mock: bool = False):
        """
        Initialize embedding service.
        
        Args:
            provider (Optional[str]): "local" or "openai". Defaults to config.EMBEDDING_PROVIDER
            use_mock (bool): Force mock embeddings (for testing)
        """
        self.logger = get_logger(__name__)
        self._cache: Dict[str, List[float]] = {}
        self.provider = provider or config.EMBEDDING_PROVIDER
        self.model_name = config.EMBEDDING_MODEL
        self.model = None
        self.client = None
        self.dimension = None
        self.use_mock = use_mock
        self.provider_ready = False
        
        if not use_mock:
            self._init_provider()
        else:
            self.logger.info("[LOCAL_EMBEDDINGS] Using mock embeddings for testing")
    
    def _init_provider(self) -> None:
        """Initialize the configured embedding provider."""
        if self.provider == "local":
            self._init_local()
        elif self.provider == "openai":
            self._init_openai()
        else:
            self.logger.warning(f"[EMBEDDINGS] Unknown provider: {self.provider}, using mock")
            self.use_mock = True
    
    def _init_local(self) -> None:
        """Initialize local embeddings via sentence-transformers."""
        try:
            from sentence_transformers import SentenceTransformer
            
            self.logger.info(f"[LOCAL_EMBEDDINGS] Loading model: {self.model_name}")
            self.model = SentenceTransformer(self.model_name)
            
            # Get embedding dimension
            test_embedding = self.model.encode("test")
            self.dimension = len(test_embedding)
            
            self.logger.info(
                f"[LOCAL_EMBEDDINGS] Model loaded successfully "
                f"(dimension={self.dimension}, provider=local)"
            )
            self.provider_ready = True
            
        except ImportError:
            self.logger.error(
                "[LOCAL_EMBEDDINGS] sentence-transformers not installed. "
                "Install with: pip install sentence-transformers torch"
            )
            self.use_mock = True
        except Exception as e:
            self.logger.error(f"[LOCAL_EMBEDDINGS] Failed to init local embeddings: {e}")
            self.use_mock = True
    
    def _init_openai(self) -> None:
        """Initialize OpenAI embeddings."""
        if not config.OPENAI_API_KEY:
            self.logger.warning(
                "[EMBEDDINGS] OpenAI provider requested but OPENAI_API_KEY not set. "
                "Falling back to local embeddings."
            )
            self._init_local()
            return
        
        try:
            import openai
            self.client = openai.OpenAI(api_key=config.OPENAI_API_KEY)
            
            # all-MiniLM-L6-v2 → text-embedding-3-small (384 → 1536 dimensions)
            if self.model_name == "all-MiniLM-L6-v2":
                self.model_name = "text-embedding-3-small"  # Closest OpenAI equivalent
            
            self.dimension = 1536  # text-embedding-3-small dimension
            
            self.logger.info(
                f"[EMBEDDINGS] Using OpenAI model: {self.model_name} "
                f"(dimension={self.dimension}, provider=openai)"
            )
            self.provider_ready = True
            
        except ImportError:
            self.logger.warning("[EMBEDDINGS] OpenAI library not installed, using local")
            self._init_local()
        except Exception as e:
            self.logger.warning(f"[EMBEDDINGS] Failed to init OpenAI: {e}, using local")
            self._init_local()
    
    def embed(self, text: str) -> List[float]:
        """
        Generate embedding for single text.
        
        Args:
            text (str): Text to embed (can be empty)
            
        Returns:
            List[float]: Embedding vector
            
        Example:
            >>> service = EmbeddingService()
            >>> emb = service.embed("backend engineer")
            >>> len(emb)
            384
        """
        if not text:
            return self._get_zero_embedding()
        
        # Check cache
        cache_key = self._get_cache_key(text)
        if cache_key in self._cache:
            self.logger.debug(f"[EMBEDDINGS] Cache hit: {text[:30]}...")
            return self._cache[cache_key]
        
        # Generate embedding
        if self.use_mock:
            embedding = self._mock_embedding(text)
        elif self.provider == "openai":
            embedding = self._openai_embed(text)
        else:
            embedding = self._local_embed(text)
        
        # Cache and return
        self._cache[cache_key] = embedding
        return embedding
    
    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings for multiple texts efficiently.
        
        Args:
            texts (List[str]): List of texts to embed
            
        Returns:
            List[List[float]]: List of embedding vectors in same order
            
        Example:
            >>> service = EmbeddingService()
            >>> texts = ["Python", "JavaScript", "Go"]
            >>> embeddings = service.embed_batch(texts)
            >>> len(embeddings)
            3
        """
        if not texts:
            return []
        
        self.logger.info(f"[EMBEDDINGS] Embedding batch of {len(texts)} texts (provider={self.provider})")
        
        # Find uncached texts
        uncached_texts = []
        uncached_indices = []
        
        for i, text in enumerate(texts):
            cache_key = self._get_cache_key(text)
            if cache_key not in self._cache:
                uncached_texts.append(text)
                uncached_indices.append(i)
        
        # Process uncached texts
        if uncached_texts:
            self.logger.debug(f"[EMBEDDINGS] {len(uncached_texts)} uncached, generating...")
            
            if self.use_mock:
                embeddings_list = [self._mock_embedding(t) for t in uncached_texts]
            elif self.provider == "openai":
                embeddings_list = self._openai_embed_batch(uncached_texts)
            else:
                embeddings_list = self._local_embed_batch(uncached_texts)
            
            # Cache results
            for text, embedding in zip(uncached_texts, embeddings_list):
                cache_key = self._get_cache_key(text)
                self._cache[cache_key] = embedding
        
        # Return embeddings in original order
        result = []
        for i, text in enumerate(texts):
            cache_key = self._get_cache_key(text)
            result.append(self._cache[cache_key])
        
        return result
    
    def _local_embed(self, text: str) -> List[float]:
        """Generate embedding using local sentence-transformers model."""
        try:
            embedding = self.model.encode(text)
            return embedding.tolist() if isinstance(embedding, np.ndarray) else embedding
        except Exception as e:
            self.logger.warning(f"[LOCAL_EMBEDDINGS] Encoding error: {e}, using mock")
            return self._mock_embedding(text)
    
    def _local_embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for batch using local model."""
        try:
            embeddings = self.model.encode(texts)
            return [e.tolist() if isinstance(e, np.ndarray) else e for e in embeddings]
        except Exception as e:
            self.logger.warning(f"[LOCAL_EMBEDDINGS] Batch encoding error: {e}, using mock")
            return [self._mock_embedding(t) for t in texts]
    
    def _openai_embed(self, text: str) -> List[float]:
        """Call OpenAI embedding API for single text."""
        try:
            response = self.client.embeddings.create(
                model=self.model_name,
                input=text
            )
            embedding = response.data[0].embedding
            self.logger.debug(f"[EMBEDDINGS] Generated OpenAI embedding (dim={len(embedding)})")
            return embedding
        except Exception as e:
            self.logger.warning(f"[EMBEDDINGS] OpenAI API error: {e}, falling back to mock")
            return self._mock_embedding(text)
    
    def _openai_embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Call OpenAI embedding API for batch of texts."""
        try:
            response = self.client.embeddings.create(
                model=self.model_name,
                input=texts
            )
            
            # Sort by index to match input order
            embeddings = [None] * len(texts)
            for item in response.data:
                embeddings[item.index] = item.embedding
            
            self.logger.debug(f"[EMBEDDINGS] Generated {len(embeddings)} OpenAI embeddings")
            return embeddings
        except Exception as e:
            self.logger.warning(f"[EMBEDDINGS] OpenAI batch error: {e}, using mock")
            return [self._mock_embedding(t) for t in texts]
    
    def _mock_embedding(self, text: str) -> List[float]:
        """
        Generate deterministic mock embedding.
        
        Uses text hash to create consistent vectors for testing.
        Dimension matches the configured provider (384 for local, 1536 for OpenAI).
        
        Args:
            text (str): Text to embed
            
        Returns:
            List[float]: Mock embedding vector
        """
        dimension = self.dimension or 384  # Default to local dimension
        
        # Create deterministic hash
        hash_bytes = hashlib.sha256(text.encode()).digest()
        hash_int = int.from_bytes(hash_bytes, byteorder='big')
        
        # Generate dimension-sized vector
        embedding = []
        for i in range(dimension):
            # Use hash to generate consistent but varied values
            val = ((hash_int + i * 12345) % 10000) / 10000.0 - 0.5
            embedding.append(float(val))
        
        return embedding
    
    def _get_zero_embedding(self) -> List[float]:
        """Get zero embedding with correct dimension."""
        dimension = self.dimension or 384
        return [0.0] * dimension
    
    def _get_cache_key(self, text: str) -> str:
        """Get cache key from text (hash for efficiency)."""
        return hashlib.md5(text.encode()).hexdigest()
    
    def clear_cache(self) -> None:
        """Clear embedding cache."""
        self._cache.clear()
        self.logger.info("[EMBEDDINGS] Cache cleared")
    
    def cache_size(self) -> int:
        """Get number of cached embeddings."""
        return len(self._cache)
    
    def get_dimension(self) -> int:
        """Get embedding dimension."""
        return self.dimension or 384


def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """
    Compute cosine similarity between two vectors.
    
    Args:
        vec1: First vector
        vec2: Second vector
        
    Returns:
        float: Similarity score between -1 and 1 (usually 0 to 1)
    """
    vec1_arr = np.array(vec1)
    vec2_arr = np.array(vec2)
    
    # Compute cosine similarity
    dot_product = np.dot(vec1_arr, vec2_arr)
    norm1 = np.linalg.norm(vec1_arr)
    norm2 = np.linalg.norm(vec2_arr)
    
    if norm1 == 0 or norm2 == 0:
        return 0.0
    
    return float(dot_product / (norm1 * norm2))


def top_k_similar(
    query_embedding: List[float],
    embeddings_dict: Dict[str, List[float]],
    k: int = 5,
    threshold: float = 0.0
) -> List[tuple]:
    """
    Find top-k embeddings most similar to query.
    
    Args:
        query_embedding: Query embedding vector
        embeddings_dict: Dict mapping doc_id → embedding vector
        k: Number of results to return
        threshold: Minimum similarity score
        
    Returns:
        List of (doc_id, similarity_score) tuples, sorted by similarity DESC
    """
    similarities = []
    
    for doc_id, embedding in embeddings_dict.items():
        similarity = cosine_similarity(query_embedding, embedding)
        if similarity >= threshold:
            similarities.append((doc_id, similarity))
    
    # Sort by similarity descending
    similarities.sort(key=lambda x: x[1], reverse=True)
    
    return similarities[:k]
