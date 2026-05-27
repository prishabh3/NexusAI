from __future__ import annotations

import uuid
from abc import ABC, abstractmethod

from src.domain.entities.insight import Insight, InsightCategory, InsightMemory


class InsightRepository(ABC):
    @abstractmethod
    async def save(self, insight: Insight) -> Insight: ...

    @abstractmethod
    async def find_by_id(self, insight_id: uuid.UUID) -> Insight | None: ...

    @abstractmethod
    async def find_by_dataset_id(
        self,
        dataset_id: uuid.UUID,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Insight]: ...

    @abstractmethod
    async def find_recent(self, limit: int = 50, offset: int = 0) -> list[Insight]: ...

    @abstractmethod
    async def find_by_category(
        self,
        dataset_id: uuid.UUID,
        category: InsightCategory,
    ) -> list[Insight]: ...

    @abstractmethod
    async def update(self, insight: Insight) -> Insight: ...

    @abstractmethod
    async def delete(self, insight_id: uuid.UUID) -> bool: ...

    @abstractmethod
    async def save_memory(self, memory: InsightMemory) -> InsightMemory: ...

    @abstractmethod
    async def semantic_search(
        self,
        embedding: list[float],
        limit: int = 10,
        similarity_threshold: float = 0.75,
    ) -> list[tuple[Insight, float]]: ...

    @abstractmethod
    async def find_similar(
        self,
        insight_id: uuid.UUID,
        limit: int = 5,
    ) -> list[Insight]: ...
