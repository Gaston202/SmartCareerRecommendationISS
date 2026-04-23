import json
from datetime import datetime, timezone
from typing import Any

import requests

from .dedup import sha256_text
from .models import ChunkRecord, ProviderRecord


class SupabaseStore:
    def __init__(self, supabase_url: str, service_role_key: str) -> None:
        self.supabase_url = supabase_url.rstrip("/")
        self.service_role_key = service_role_key
        self.headers = {
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

    def upsert_resource(self, record: ProviderRecord) -> dict[str, Any]:
        now_iso = datetime.now(timezone.utc).isoformat()
        payload = {
            "provider": record.provider,
            "provider_resource_id": record.provider_resource_id,
            "source_type": record.source_type,
            "resource_type": record.resource_type,
            "title": record.title,
            "description": record.description,
            "source_url": record.source_url,
            "language": record.language,
            "level": record.level,
            "free_or_paid": record.free_or_paid,
            "duration_hours": record.duration_hours,
            "certificate": record.certificate,
            "skill_tags": record.skill_tags,
            "target_roles": record.target_roles,
            "metadata": record.metadata,
            "raw_content": record.raw_content,
            "normalized_content": record.normalized_content,
            "source_etag": record.source_etag,
            "source_last_modified": record.source_last_modified,
            "raw_content_sha256": sha256_text(record.raw_content),
            "normalized_content_sha256": sha256_text(record.normalized_content),
            "last_crawled_at": now_iso,
            "last_refreshed_at": now_iso,
            "embedding_status": "pending",
        }

        existing = self._find_existing_resource(record)
        if existing:
            url = f"{self.supabase_url}/rest/v1/resources?id=eq.{existing['id']}"
            response = requests.patch(url, headers=self.headers, data=json.dumps(payload), timeout=30)
            response.raise_for_status()

            fetch_url = f"{self.supabase_url}/rest/v1/resources?id=eq.{existing['id']}&select=*"
            fetch_response = requests.get(fetch_url, headers=self.headers, timeout=30)
            fetch_response.raise_for_status()
            rows = fetch_response.json()
            if not rows:
                raise RuntimeError("Resource update fetch returned no rows")
            return rows[0]

        url = f"{self.supabase_url}/rest/v1/resources"
        response = requests.post(url, headers=self.headers, data=json.dumps(payload), timeout=30)
        response.raise_for_status()
        rows = response.json()
        if not rows:
            raise RuntimeError("Resource insert returned no rows")
        return rows[0]

    def replace_chunks(self, resource_id: str, chunks: list[ChunkRecord]) -> None:
        delete_url = f"{self.supabase_url}/rest/v1/resource_chunks?resource_id=eq.{resource_id}"
        del_resp = requests.delete(delete_url, headers=self.headers, timeout=30)
        del_resp.raise_for_status()

        if not chunks:
            return

        insert_payload = [
            {
                "resource_id": resource_id,
                "chunk_index": c.chunk_index,
                "chunk_text": c.chunk_text,
                "token_count": c.token_count,
                "chunk_sha256": c.chunk_sha256,
                "embedding": c.embedding,
                "embedding_model": c.embedding_model,
                "embedding_created_at": datetime.now(timezone.utc).isoformat() if c.embedding else None,
            }
            for c in chunks
        ]

        insert_url = f"{self.supabase_url}/rest/v1/resource_chunks"
        ins_resp = requests.post(insert_url, headers=self.headers, data=json.dumps(insert_payload), timeout=60)
        ins_resp.raise_for_status()

    def create_ingestion_job(self, provider: str, job_type: str, filters: dict | None = None) -> dict[str, Any]:
        payload = {
            "provider": provider,
            "job_type": job_type,
            "status": "running",
            "filters": filters or {},
            "started_at": datetime.now(timezone.utc).isoformat(),
        }
        url = f"{self.supabase_url}/rest/v1/ingestion_jobs"
        response = requests.post(url, headers=self.headers, data=json.dumps(payload), timeout=30)
        response.raise_for_status()
        rows = response.json()
        return rows[0]

    def finish_ingestion_job(self, job_id: str, status: str, stats: dict | None = None, error_message: str | None = None) -> None:
        payload = {
            "status": status,
            "stats": stats or {},
            "error_message": error_message,
            "finished_at": datetime.now(timezone.utc).isoformat(),
        }
        url = f"{self.supabase_url}/rest/v1/ingestion_jobs?id=eq.{job_id}"
        response = requests.patch(url, headers=self.headers, data=json.dumps(payload), timeout=30)
        response.raise_for_status()

    def _find_existing_resource(self, record: ProviderRecord) -> dict[str, Any] | None:
        if record.provider_resource_id:
            url = (
                f"{self.supabase_url}/rest/v1/resources"
                f"?provider=eq.{record.provider}"
                f"&provider_resource_id=eq.{record.provider_resource_id}"
                f"&select=*"
                f"&limit=1"
            )
            response = requests.get(url, headers=self.headers, timeout=30)
            response.raise_for_status()
            rows = response.json()
            if rows:
                return rows[0]

        normalized_content_sha = sha256_text(record.normalized_content)
        if normalized_content_sha:
            url = (
                f"{self.supabase_url}/rest/v1/resources"
                f"?normalized_content_sha256=eq.{normalized_content_sha}"
                f"&select=*"
                f"&limit=1"
            )
            response = requests.get(url, headers=self.headers, timeout=30)
            response.raise_for_status()
            rows = response.json()
            if rows:
                return rows[0]

        return None
