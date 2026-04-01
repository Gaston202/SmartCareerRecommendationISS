"""
Embedding Service for generating vector embeddings.

Provides a unified interface for generating embeddings using:
- Local embeddings (sentence-transformers) - FREE, no API key needed
- OpenAI embeddings - Requires API key but higher quality
- Fallback mock embeddings - For testing without dependencies

Features:
    - Lazy initialization of embedding models
    - Caching for frequently embedded texts
    - Batch embedding support
    - Error handling and graceful fallback
    - Support for multiple embedding models
"""

from typing import List, Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)


class EmbeddingService:
    """
    Service for generating embeddings from text.
    
    Uses local sentence-transformers models by default (free, no API key required).
    Falls back to OpenAI embeddings if configured, or mock for testing.
    
    Configuration:
        - EMBEDDING_PROVIDER: "local" (default) or "openai"
        - EMBEDDING_MODEL: Model name (default: "all-MiniLM-L6-v2")
    
    Usage:
        >>> embedder = EmbeddingService()
        >>> embedding = embedder.embed("What are Python skills?")
        >>> embeddings = embedder.embed_batch([
        ...     "Python programming",
        ...     "Data science"
        ... ])
    """
    
    def __init__(self, provider: Optional[str] = None, model: Optional[str] = None):
        """
        Initialize the embedding service.
        
        Args:
            provider: Optional override for embedding provider ("local" or "openai")
            model: Optional override for model name
        """
        from ..config import config
        
        self.provider = provider or config.EMBEDDING_PROVIDER
        self.model_name = model or config.EMBEDDING_MODEL
        self.model = None
        self.model_instance = None
        self.logger = logger
        self._embedding_cache: Dict[str, List[float]] = {}
        
        # Try to initialize the model
        self._init_model()
    
    def _init_model(self):
        """Initialize the embedding model."""
        if self.provider == "local":
            self._init_local_model()
        elif self.provider == "openai":
            self._init_openai_model()
        else:
            self.logger.warning(
                f"[Embedding] Unknown provider: {self.provider}, falling back to local"
            )
            self._init_local_model()
    
    def _init_local_model(self):
        """Initialize sentence-transformers local embedding model."""
        try:
            from sentence_transformers import SentenceTransformer
            
            self.logger.info(f"[Embedding] Loading local model: {self.model_name}")
            self.model_instance = SentenceTransformer(self.model_name)
            self.logger.info(f"✓ [Embedding] Local model loaded successfully")
        except ImportError:
            self.logger.error(
                "[Embedding] sentence-transformers not installed. "
                "Install with: pip install sentence-transformers"
            )
            self.model_instance = None
        except Exception as e:
            self.logger.error(f"[Embedding] Failed to load local model: {str(e)}")
            self.model_instance = None
    
    def _init_openai_model(self):
        """Initialize OpenAI embedding model."""
        try:
            import openai
            from ..config import config
            
            if not config.OPENROUTER_API_KEY:
                raise ValueError("OPENROUTER_API_KEY not configured")
            
            self.model_instance = openai.OpenAI(
                api_key=config.OPENROUTER_API_KEY,
                base_url=config.OPENROUTER_BASE_URL,
            )
            self.logger.info("[Embedding] OpenAI embedding model initialized")
        except ImportError:
            self.logger.error(
                "[Embedding] OpenAI library not installed. "
                "Install with: pip install openai"
            )
            self.model_instance = None
        except Exception as e:
            self.logger.error(f"[Embedding] Failed to initialize OpenAI: {str(e)}")
            self.model_instance = None
    
    def embed(self, text: str) -> List[float]:
        """
        Generate embedding for a single text.
        
        Args:
            text: Text to embed
        
        Returns:
            List of floats representing the embedding vector
        
        Example:
            >>> service = EmbeddingService()
            >>> embedding = service.embed("Machine learning engineer")
            >>> len(embedding)
            384
        """
        if not text:
            self.logger.warning("[Embedding] Empty text provided")
            return []
        
        # Check cache
        if text in self._embedding_cache:
            return self._embedding_cache[text]
        
        try:
            if self.provider == "local":
                return self._embed_local(text)
            elif self.provider == "openai":
                return self._embed_openai(text)
            else:
                return self._embed_mock(text)
        except Exception as e:
            self.logger.error(f"[Embedding] Error embedding text: {str(e)}")
            return self._embed_mock(text)
    
    def _embed_local(self, text: str) -> List[float]:
        """Embed using local sentence-transformers model."""
        if not self.model_instance:
            self.logger.debug("[Embedding] Local model not available, using mock")
            return self._embed_mock(text)
        
        try:
            embedding = self.model_instance.encode(text, convert_to_tensor=False)
            # Convert numpy array to list
            embedding_list = embedding.tolist() if hasattr(embedding, 'tolist') else list(embedding)
            
            # Cache for future use
            self._embedding_cache[text] = embedding_list
            
            self.logger.debug(f"[Embedding] Generated embedding for text (dim={len(embedding_list)})")
            return embedding_list
        except Exception as e:
            self.logger.error(f"[Embedding] Local embedding failed: {str(e)}")
            return self._embed_mock(text)
    
    def _embed_openai(self, text: str) -> List[float]:
        """Embed using OpenAI API."""
        if not self.model_instance:
            self.logger.debug("[Embedding] OpenAI client not available, using mock")
            return self._embed_mock(text)
        
        try:
            response = self.model_instance.embeddings.create(
                input=text,
                model="text-embedding-3-small",  # or text-embedding-ada-002
            )
            embedding = response.data[0].embedding
            
            # Cache for future use
            self._embedding_cache[text] = embedding
            
            self.logger.debug(f"[Embedding] Generated OpenAI embedding (dim={len(embedding)})")
            return embedding
        except Exception as e:
            self.logger.error(f"[Embedding] OpenAI embedding failed: {str(e)}")
            return self._embed_mock(text)
    
    def _embed_mock(self, text: str) -> List[float]:
        """Generate mock embedding for testing."""
        import hashlib
        
        # Generate deterministic embedding based on text hash
        hash_obj = hashlib.md5(text.encode())
        hash_int = int(hash_obj.hexdigest(), 16)
        
        # Create 384-dimensional mock embedding (same as all-MiniLM-L6-v2)
        embedding = []
        for i in range(384):
            # Use hash to generate pseudo-random but deterministic values
            seed = (hash_int + i) % 2**32
            value = ((seed * 1103515245 + 12345) % 2**31) / 2**31 - 0.5
            embedding.append(float(value))
        
        # Normalize
        norm = sum(x**2 for x in embedding) ** 0.5
        if norm > 0:
            embedding = [x / norm for x in embedding]
        
        self.logger.debug(f"[Embedding] Generated mock embedding (dim={len(embedding)})")
        return embedding
    
    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings for multiple texts.
        
        Args:
            texts: List of texts to embed
        
        Returns:
            List of embedding vectors
        
        Example:
            >>> service = EmbeddingService()
            >>> embeddings = service.embed_batch([
            ...     "Python developer",
            ...     "Data scientist"
            ... ])
            >>> len(embeddings)
            2
        """
        if not texts:
            return []
        
        try:
            if self.provider == "local":
                return self._embed_batch_local(texts)
            elif self.provider == "openai":
                return self._embed_batch_openai(texts)
            else:
                return [self._embed_mock(text) for text in texts]
        except Exception as e:
            self.logger.error(f"[Embedding] Batch embedding error: {str(e)}")
            return [self._embed_mock(text) for text in texts]
    
    def _embed_batch_local(self, texts: List[str]) -> List[List[float]]:
        """Batch embed using local model."""
        if not self.model_instance:
            return [self._embed_mock(text) for text in texts]
        
        try:
            embeddings = self.model_instance.encode(texts, convert_to_tensor=False)
            # Convert numpy array to list of lists
            result = [emb.tolist() if hasattr(emb, 'tolist') else list(emb) for emb in embeddings]
            
            # Cache results
            for text, embedding in zip(texts, result):
                self._embedding_cache[text] = embedding
            
            self.logger.debug(f"[Embedding] Batch embedded {len(texts)} texts (local)")
            return result
        except Exception as e:
            self.logger.error(f"[Embedding] Local batch embedding failed: {str(e)}")
            return [self._embed_mock(text) for text in texts]
    
    def _embed_batch_openai(self, texts: List[str]) -> List[List[float]]:
        """Batch embed using OpenAI API."""
        if not self.model_instance:
            return [self._embed_mock(text) for text in texts]
        
        try:
            response = self.model_instance.embeddings.create(
                input=texts,
                model="text-embedding-3-small",
            )
            
            # Sort by index to maintain order
            embeddings = sorted(response.data, key=lambda x: x.index)
            result = [emb.embedding for emb in embeddings]
            
            # Cache results
            for text, embedding in zip(texts, result):
                self._embedding_cache[text] = embedding
            
            self.logger.debug(f"[Embedding] Batch embedded {len(texts)} texts (OpenAI)")
            return result
        except Exception as e:
            self.logger.error(f"[Embedding] OpenAI batch embedding failed: {str(e)}")
            return [self._embed_mock(text) for text in texts]
    
    def get_embedding_dimension(self) -> int:
        """
        Get the dimension of embeddings produced by this service.
        
        Returns:
            Dimension of embedding vectors
        """
        if self.provider == "local":
            if self.model_name == "all-MiniLM-L6-v2":
                return 384
            elif self.model_name == "all-mpnet-base-v2":
                return 768
            else:
                return 384  # Default
        elif self.provider == "openai":
            return 1536  # text-embedding-3-small dimension
        else:
            return 384  # Mock dimension
    
    def clear_cache(self):
        """Clear the embedding cache."""
        self._embedding_cache.clear()
        self.logger.debug("[Embedding] Cache cleared")
