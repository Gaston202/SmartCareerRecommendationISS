from supabase import AsyncClient, create_async_client
from postgrest.base_request_builder import APIResponse, SingleAPIResponse
from app.core.config import settings


def _attach_error_compat(model_cls):
    # Legacy app code expects `.error` on postgrest responses.
    if not hasattr(model_cls, "error"):
        model_cls.error = property(lambda self: None)


_attach_error_compat(APIResponse)
_attach_error_compat(SingleAPIResponse)


class DatabaseService:
    """
    Database service wrapper for Supabase clients.
    Equivalent to NestJS DatabaseService.
    """

    def __init__(self, supabase: AsyncClient, supabase_anon: AsyncClient):
        self.supabase = supabase
        self.supabase_anon = supabase_anon

    @classmethod
    async def create(cls) -> "DatabaseService":
        url = settings.supabase_url
        service_key = settings.supabase_service_role_key
        anon_key = settings.supabase_anon_key

        looks_like_placeholder = lambda v: (
            not v
            or "your_supabase_" in v
            or "your_supabase_service_role_key" in v
            or "your_supabase_anon_key" in v
        )

        if not url or not service_key or looks_like_placeholder(url) or looks_like_placeholder(service_key):
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")

        if anon_key and looks_like_placeholder(anon_key):
            raise ValueError("SUPABASE_ANON_KEY is configured with a placeholder value")

        from supabase.lib.client_options import AsyncClientOptions as ClientOptions
        options = ClientOptions(
            auto_refresh_token=False,
            persist_session=False,
            postgrest_client_timeout=60,
        )
        supabase = await create_async_client(
            url, 
            service_key, 
            options=options
        )

        options_anon = ClientOptions(
            auto_refresh_token=False,
            persist_session=False,
            postgrest_client_timeout=60,
        )
        supabase_anon = await create_async_client(
            url, 
            anon_key or service_key, 
            options=options_anon
        )

        return cls(supabase=supabase, supabase_anon=supabase_anon)

    def get_client(self) -> AsyncClient:
        """Get the service role client."""
        return self.supabase

    def get_anon_client(self) -> AsyncClient:
        """Get the anon client."""
        return self.supabase_anon

    def __repr__(self) -> str:
        return "DatabaseService(supabase=<client>, supabase_anon=<client>)"