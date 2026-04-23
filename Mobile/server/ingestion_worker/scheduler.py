from .models import ProviderRecord
from .providers.internal_curated_provider import InternalCuratedProvider


def get_provider_records(provider: str, filters: dict | None = None) -> list[ProviderRecord]:
    if provider == "internal_curated":
        return list(InternalCuratedProvider().fetch(filters=filters))

    raise ValueError(f"Unknown provider: {provider}")
