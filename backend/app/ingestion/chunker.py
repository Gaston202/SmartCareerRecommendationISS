from typing import List


def chunk_text(text: str, chunk_tokens: int = 500, overlap_tokens: int = 50) -> List[dict]:
    tokens = (text or "").split()
    if not tokens:
        return []

    chunks = []
    start = 0
    index = 0
    step = max(1, chunk_tokens - overlap_tokens)

    while start < len(tokens):
        piece = tokens[start : start + chunk_tokens]
        chunks.append(
            {
                "chunk_index": index,
                "chunk_text": " ".join(piece),
                "token_count": len(piece),
            }
        )
        index += 1
        start += step

    return chunks
