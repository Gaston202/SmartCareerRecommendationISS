from dataclasses import dataclass
from typing import Iterable

from .chunker import chunk_text
from .config import settings
from .embedder import Embedder
from .models import ProviderRecord
from .normalizer import normalize_record
from .supabase_store import SupabaseStore


@dataclass
class PipelineStats:
    fetched: int = 0
    normalized: int = 0
    stored: int = 0
    chunks_written: int = 0
    failed: int = 0


class IngestionPipeline:
    def __init__(self, store: SupabaseStore, embedder: Embedder) -> None:
        self.store = store
        self.embedder = embedder

    def run_provider(self, provider_name: str, records: Iterable[ProviderRecord], job_type: str) -> PipelineStats:
        stats = PipelineStats()
        job = self.store.create_ingestion_job(provider_name, job_type)

        try:
            for record in records:
                stats.fetched += 1
                try:
                    normalized = normalize_record(record)
                    stats.normalized += 1

                    db_resource = self.store.upsert_resource(normalized)
                    chunks = chunk_text(
                        normalized.normalized_content or normalized.raw_content or "",
                        chunk_size=settings.default_chunk_size,
                        overlap=settings.default_chunk_overlap,
                    )

                    embeddings = self.embedder.embed_texts([c.chunk_text for c in chunks])
                    for c, emb in zip(chunks, embeddings):
                        c.embedding = emb
                        c.embedding_model = settings.embedding_model if emb else None

                    self.store.replace_chunks(db_resource["id"], chunks)

                    stats.stored += 1
                    stats.chunks_written += len(chunks)
                except Exception as exc:
                    print(f"Ingestion failed for provider record {record.provider_resource_id or record.source_url}: {exc}")
                    stats.failed += 1

            self.store.finish_ingestion_job(
                job_id=job["id"],
                status="completed",
                stats=stats.__dict__,
            )
        except Exception as exc:
            self.store.finish_ingestion_job(
                job_id=job["id"],
                status="failed",
                stats=stats.__dict__,
                error_message=str(exc),
            )
            raise

        return stats
