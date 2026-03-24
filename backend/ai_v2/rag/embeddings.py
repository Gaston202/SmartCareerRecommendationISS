"""
Embeddings service for RAG module.

Handles text embedding generation with OpenAI and caching.
Provides both real embeddings and mock fallback.
"""

from typing import List, Optional
from ..config import config
from ..utils import get_logger

logger = get_logger(__name__)


class EmbeddingService:
    """
    Service for generating text embeddings.
    
    Features:
        - OpenAI embedding API integration
        - Local caching to avoid redundant API calls
        - Batch processing support
        - Mock fallback when API unavailable
    """

    def __init__(self, model: Optional[str] = None, use_mock: bool = False):
        """
        Initialize embedding service.
        
        Args:
            model (Optional[str]): Embedding model to use (default: from config)
            use_mock (bool): Force mock embeddings for testing
        """
        self.model = model or config.EMBEDDING_MODEL
        self.logger = get_logger(__name__)
        self._cache: dict = {}  # Local in-memory cache
        self.client = None
        self.use_mock = use_mock or not config.OPENAI_API_KEY
        
        if not self.use_mock:
            try:
                import openai
                self.client = openai.OpenAI(api_key=config.OPENAI_API_KEY)
                self.logger.info(f"[EMBEDDINGS] Using OpenAI embeddings: {self.model}")
            except ImportError:
                self.logger.warning("[EMBEDDINGS] OpenAI not installed, using mock embeddings")
                self.use_mock = True
            except Exception as e:
                self.logger.error(f"[EMBEDDINGS] Failed to initialize OpenAI: {e}, using mock")
                self.use_mock = True
        else:
            self.logger.warning("[EMBEDDINGS] Using mock embeddings (no API key configured)")

    def embed(self, text: str) -> List[float]:
        """
        Convert text to embedding vector.
        
        Args:
            text (str): Text to embed
        
        Returns:
            List[float]: Embedding vector (1536-dim for text-embedding-3-small)
        """
        if not text:
            return self._mock_embedding()
        
        # Check cache first
        if text in self._cache:
            self.logger.debug(f"[EMBEDDINGS] Cache hit for text: {text[:30]}...")
            return self._cache[text]
        
        # Get embedding
        if self.use_mock:
            embedding = self._mock_embedding(text)
        else:
            embedding = self._call_openai_embedding(text)
        
        # Cache result
        self._cache[text] = embedding
        return embedding

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Convert multiple texts to embeddings efficiently.
        
        Args:
            texts (List[str]): List of texts to embed
        
        Returns:
            List[List[float]]: List of embedding vectors
        """
        self.logger.info(f"[EMBEDDINGS] Batch embedding {len(texts)} texts")
        
        uncached = [t for t in texts if t not in self._cache]
        
        if uncached:
            if self.use_mock:
                new_embeddings = [self._mock_embedding(t) for t in uncached]
            else:
                new_embeddings = self._call_openai_batch(uncached)
            
            # Cache all
            for text, emb in zip(uncached, new_embeddings):
                self._cache[text] = emb
        
        # Return results in original order
        return [self._cache[t] for t in texts]

    def _call_openai_embedding(self, text: str) -> List[float]:
        """
        Call OpenAI embedding API.
        
        Args:
            text (str): Text to embed
            
        Returns:
            List[float]: Embedding vector
        """
        try:
            self.logger.debug(f"[EMBEDDINGS] Calling OpenAI for: {text[:30]}...")
            
            response = self.client.embeddings.create(
                model=self.model,
                input=text,
                dimensions=1536  # text-embedding-3-small default
            )
            
            embedding = response.data[0].embedding
            self.logger.debug(f"[EMBEDDINGS] ✓ Generated embedding ({len(embedding)} dimensions)")
            return embedding
        
        except Exception as e:
            self.logger.error(f"[EMBEDDINGS] OpenAI API error: {e}, falling back to mock")
            return self._mock_embedding(text)

    def _call_openai_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Call OpenAI embedding API for batch of texts.
        
        Args:
            texts (List[str]): List of texts to embed
            
        Returns:
            List[List[float]]: List of embedding vectors
        """
        try:
            self.logger.info(f"[EMBEDDINGS] Batch embedding {len(texts)} texts via OpenAI")
            
            response = self.client.embeddings.create(
                model=self.model,
                input=texts
            )
            
            # Sort by index to match input order
            embeddings = [None] * len(texts)
            for item in response.data:
                embeddings[item.index] = item.embedding
            
            self.logger.info(f"[EMBEDDINGS] ✓ Generated {len(embeddings)} embeddings")
            return embeddings
        
        except Exception as e:
            self.logger.error(f"[EMBEDDINGS] Batch API error: {e}, falling back to mock")
            return [self._mock_embedding(t) for t in texts]

    def _mock_embedding(self, text: str = "") -> List[float]:
        """
        Generate mock embedding (deterministic based on text).
        Used for testing and when API unavailable.
        
        Returns:
            List[float]: Mock 1536-dimensional embedding
        """
        # Create deterministic mock embedding based on text hash
        hash_val = hash(text) if text else 0
        
        # Generate 1536-dimensional vector (same size as real embeddings)
        # Using consistent hash-based values
        embedding = []
        for i in range(1536):
            val = ((hash_val + i) % 1000) / 1000.0 - 0.5
            embedding.append(val)
        
        return embedding
