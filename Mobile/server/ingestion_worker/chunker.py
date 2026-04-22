from .dedup import sha256_text
from .models import ChunkRecord


def chunk_text(text: str, chunk_size: int = 900, overlap: int = 120) -> list[ChunkRecord]:
    clean = " ".join((text or "").split())
    if not clean:
        return []

    chunks: list[ChunkRecord] = []
    start = 0
    idx = 0

    while start < len(clean):
        end = min(len(clean), start + chunk_size)
        chunk = clean[start:end].strip()
        if chunk:
            chunks.append(
                ChunkRecord(
                    chunk_index=idx,
                    chunk_text=chunk,
                    token_count=max(1, len(chunk) // 4),
                    chunk_sha256=sha256_text(chunk) or "",
                )
            )
            idx += 1

        if end >= len(clean):
            break
        start = max(0, end - overlap)

    return chunks
