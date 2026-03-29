"""
Supabase Client for Database Operations.

Provides connection to Supabase for:
- Quiz sessions and responses
- User profiles
- CV analysis results
- Career matching results
"""

import os
from typing import Optional
from supabase import create_client, Client
from ai_v2.utils import get_logger

logger = get_logger(__name__)

# Global Supabase client
_supabase_client: Optional[Client] = None


def get_supabase_client() -> Client:
    """Get or initialize Supabase client."""
    global _supabase_client
    
    if _supabase_client is not None:
        return _supabase_client
    
    # Get credentials from environment
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_ANON_KEY")
    
    if not supabase_url or not supabase_key:
        logger.warning("Supabase credentials not found in environment")
        raise ValueError("Missing SUPABASE_URL or SUPABASE_ANON_KEY")
    
    # Initialize client
    _supabase_client = create_client(supabase_url, supabase_key)
    logger.info("Supabase client initialized")
    
    return _supabase_client


def close_supabase_client() -> None:
    """Close Supabase connection."""
    global _supabase_client
    _supabase_client = None
    logger.info("Supabase client closed")
