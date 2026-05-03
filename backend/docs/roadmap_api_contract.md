# Roadmap RAG API Contract

## Plan Endpoint

`POST /api/v1/roadmap/plan`

Request:

```json
{
  "user_skills": ["python", "html"],
  "target_role": "backend_developer",
  "max_steps": 8
}
```

Response shape is stable for frontend/mobile integration:

- `success`: boolean request outcome.
- `mode`: roadmap engine version. Current value: `stored_kb_v1`.
- `target_role`: requested role key.
- `career_id`: optional legacy career identifier. Can be `null`.
- `confidence`: aggregate score from `0.0` to `1.0`.
- `weak_evidence`: true when the plan contains low-confidence evidence.
- `message`: optional human-readable warning. Can be `null`.
- `steps`: ordered roadmap steps.
- `diagnostics`: optional debug/coverage metadata.
- `metadata`: optional request and evidence summary metadata.

Step fields:

- `skill_name`: canonical skill for the step.
- `why_it_matters`: short explanation for the target role.
- `difficulty`: `beginner`, `intermediate`, or `advanced`.
- `estimated_duration_hours`: estimated effort.
- `prerequisites`: list of prerequisite skills. Can be empty.
- `resource_id`: selected primary resource id. Can be `null` when no evidence is available.
- `resource_title`: selected primary resource title. Can be `null`.
- `resource_type`: `article`, `docs`, `tutorial`, `course`, `video`, or another provider value.
- `free_or_paid`: usually `free` or `paid`. Can be `null`.
- `language`: ISO-like language code when known. Can be `null`.
- `level`: resource level when known. Can be `null`.
- `provider`: source provider, for example `web`, `internal_curated`, or `career_seed_library`.
- `source_url`: primary source URL. Can be `null`.
- `confidence_score`: step evidence score from `0.0` to `1.0`.
- `order_index`: zero-based step order.
- `primary_resource`: selected resource object. Can be `null`.
- `backup_resources`: fallback resource objects. Can be empty or `null`.
- `evidence_reasons`: short evidence explanation strings. Can be empty or `null`.

Primary and backup resource object fields:

- `resource_id`: resource id. Can be `null` for web fallback resources.
- `title`: resource title. Can be `null`.
- `provider`: source provider. Can be `null`.
- `source_url`: clickable URL. Can be `null`.
- `score`: internal ranking/evidence score from `0.0` to `1.0`. Do not display as a user-facing match score.
- `why_selected`: diagnostic evidence string. Can be `null`.
- `display_badges`: short user-facing labels such as `Official`, `Free`, `Video`, `Docs`, `Certification`, `Beginner friendly`, or `Highly relevant`. Can be `null`.
- `recommendation_reason`: one-sentence user-facing reason for the selection. Can be `null`.

## Ingestion Status Endpoint

`GET /api/v1/ingest/status/{job_id}`

Response:

```json
{
  "success": true,
  "data": {
    "id": "job-uuid",
    "provider": "web",
    "job_type": "on_demand_refresh",
    "status": "completed",
    "outcome": "completed",
    "stats": {
      "stored_count": 1,
      "skipped_count": 0
    },
    "filters": {
      "skill_tags": ["redis"],
      "target_roles": ["backend_developer"]
    },
    "error_message": null,
    "started_at": "2026-04-30T17:54:49.44377+00:00",
    "finished_at": "2026-04-30T18:01:55.408195+00:00",
    "created_at": "2026-04-30T17:54:49.030064+00:00",
    "updated_at": "2026-04-30T18:01:55.408195+00:00",
    "queue_state": null,
    "stored_resource": {
      "resource_id": "resource-uuid",
      "title": "Redis Python Client Guide",
      "url": "https://redis.io/docs/latest/develop/clients/redis-py/",
      "provider": "web",
      "resource_type": "article"
    }
  }
}
```

`outcome` values:

- `pending`
- `running`
- `completed`
- `partial_success`
- `no_changes`
- `failed`
- `unknown`

## Integration Notes

- Treat nullable resource fields as normal. A low-evidence step may not have a usable source.
- Prefer `steps[].primary_resource` for display cards, falling back to top-level step resource fields.
- Keep `confidence_score`, resource `score`, and `confidence` internal unless building an admin/debug view. For users, prefer `display_badges` and `recommendation_reason`.
- Poll `/api/v1/ingest/status/{job_id}` after `/api/v1/roadmap/refresh-provider`.
- Use `data.stored_resource` after terminal successful ingestion to update the refreshed step in place. It can be `null` when no URL was attached to the job or no resource row can be matched.
- After ingestion completes, rerun `/api/v1/roadmap/plan`; cache invalidation runs automatically on successful ingestion.
