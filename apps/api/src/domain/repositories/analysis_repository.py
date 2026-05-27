from __future__ import annotations

import uuid
from abc import ABC, abstractmethod

from src.domain.entities.analysis import Analysis, AnalysisStatus, AnalysisType


class AnalysisRepository(ABC):
    @abstractmethod
    async def save(self, analysis: Analysis) -> Analysis:
        ...

    @abstractmethod
    async def find_by_id(self, analysis_id: uuid.UUID) -> Analysis | None:
        ...

    @abstractmethod
    async def find_by_dataset_id(
        self,
        dataset_id: uuid.UUID,
        limit: int = 20,
        offset: int = 0,
    ) -> list[Analysis]:
        ...

    @abstractmethod
    async def find_by_status(self, status: AnalysisStatus) -> list[Analysis]:
        ...

    @abstractmethod
    async def update(self, analysis: Analysis) -> Analysis:
        ...

    @abstractmethod
    async def delete(self, analysis_id: uuid.UUID) -> bool:
        ...

    @abstractmethod
    async def find_recent(self, limit: int = 10) -> list[Analysis]:
        ...

    @abstractmethod
    async def find_by_type(
        self,
        dataset_id: uuid.UUID,
        analysis_type: AnalysisType,
    ) -> list[Analysis]:
        ...
