from .models import ProviderRecord


TRUSTED_SOURCE_TYPES = {
    "course_platform",
    "official_docs",
    "tutorial_blog",
    "youtube_metadata",
    "job_roadmap_article",
    "internal_curated",
}


def normalize_record(record: ProviderRecord) -> ProviderRecord:
    record.title = " ".join((record.title or "").split())
    record.description = " ".join((record.description or "").split())
    record.source_url = record.source_url.strip()

    if record.source_type not in TRUSTED_SOURCE_TYPES:
        raise ValueError(f"Unsupported source_type: {record.source_type}")

    if not record.normalized_content and record.raw_content:
        record.normalized_content = " ".join(record.raw_content.split())

    return record
