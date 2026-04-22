from abc import ABC, abstractmethod
from typing import Iterable

from ..models import ProviderRecord


class BaseProvider(ABC):
    provider_name: str

    @abstractmethod
    def fetch(self, filters: dict | None = None) -> Iterable[ProviderRecord]:
        raise NotImplementedError
