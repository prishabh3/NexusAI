from __future__ import annotations

import uuid
from abc import ABC, abstractmethod

from src.domain.entities.dataset import Dataset, DatasetStatus, DatasetVersion


class DatasetRepository(ABC):
    """Abstract repository defining the contract for dataset persistence."""

    @abstractmethod
    async def save(self, dataset: Dataset) -> Dataset: ...

    @abstractmethod
    async def find_by_id(self, dataset_id: uuid.UUID) -> Dataset | None: ...

    @abstractmethod
    async def find_all(self, limit: int = 50, offset: int = 0) -> list[Dataset]: ...

    @abstractmethod
    async def find_by_status(self, status: DatasetStatus) -> list[Dataset]: ...

    @abstractmethod
    async def update(self, dataset: Dataset) -> Dataset: ...

    @abstractmethod
    async def delete(self, dataset_id: uuid.UUID) -> bool: ...

    @abstractmethod
    async def save_version(self, version: DatasetVersion) -> DatasetVersion: ...

    @abstractmethod
    async def find_versions(self, dataset_id: uuid.UUID) -> list[DatasetVersion]: ...

    @abstractmethod
    async def count(self) -> int: ...

    @abstractmethod
    async def search_by_name(self, query: str, limit: int = 20) -> list[Dataset]: ...
