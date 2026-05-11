"""
Lazy synchronous Supabase client accessors.

Prefer app.core.database.DatabaseService (async) for all new code.
This module exists only for legacy callers; clients are created on first use
so a missing env var does not crash the process at import time.
"""
from __future__ import annotations
from typing import Optional
from supabase import create_client, Client
from app.core.config import settings

_supabase: Optional[Client] = None
_supabase_service_role: Optional[Client] = None


def _get_anon() -> Client:
    global _supabase
    if _supabase is None:
        if not settings.supabase_url or not settings.supabase_anon_key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_ANON_KEY must be set")
        _supabase = create_client(settings.supabase_url, settings.supabase_anon_key)
    return _supabase


def _get_service_role() -> Client:
    global _supabase_service_role
    if _supabase_service_role is None:
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        _supabase_service_role = create_client(settings.supabase_url, settings.supabase_service_role_key)
    return _supabase_service_role


class _LazyClient:
    """Proxy that defers client creation until first attribute access."""
    def __init__(self, factory):
        object.__setattr__(self, "_factory", factory)
        object.__setattr__(self, "_client", None)

    def _resolve(self) -> Client:
        if object.__getattribute__(self, "_client") is None:
            object.__setattr__(self, "_client", object.__getattribute__(self, "_factory")())
        return object.__getattribute__(self, "_client")

    def __getattr__(self, name):
        return getattr(self._resolve(), name)


supabase: Client = _LazyClient(_get_anon)  # type: ignore[assignment]
supabase_service_role: Client = _LazyClient(_get_service_role)  # type: ignore[assignment]