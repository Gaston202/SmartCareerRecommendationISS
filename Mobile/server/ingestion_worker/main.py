import argparse

from .config import settings
from .embedder import Embedder
from .pipeline import IngestionPipeline
from .scheduler import get_provider_records
from .supabase_store import SupabaseStore


def run(provider: str, mode: str, filters: dict | None = None) -> None:
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")

    store = SupabaseStore(settings.supabase_url, settings.supabase_service_role_key)
    embedder = Embedder(
        settings.embedding_api_key,
        settings.embedding_model,
        settings.embedding_base_url,
    )
    pipeline = IngestionPipeline(store, embedder)

    records = get_provider_records(provider, filters=filters)
    stats = pipeline.run_provider(provider, records, job_type=mode)
    print("Ingestion completed:", stats)


def main() -> None:
    parser = argparse.ArgumentParser(description="MyPath trusted-source ingestion worker")
    parser.add_argument("--provider", required=True, help="Provider key, e.g. internal_curated")
    parser.add_argument(
        "--mode",
        default="monthly_refresh",
        choices=["monthly_refresh", "on_demand_refresh", "backfill"],
    )
    args = parser.parse_args()

    run(provider=args.provider, mode=args.mode)


if __name__ == "__main__":
    main()
