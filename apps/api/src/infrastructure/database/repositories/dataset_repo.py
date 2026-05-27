"""SQLAlchemy implementation of DatasetRepository."""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.entities.dataset import (
    Dataset,
    DatasetSchema,
    DatasetStatus,
    DatasetVersion,
)
from src.domain.repositories.dataset_repository import DatasetRepository
from src.infrastructure.database.models import DatasetModel, DatasetVersionModel


class SqlAlchemyDatasetRepository(DatasetRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def save(self, dataset: Dataset) -> Dataset:
        model = DatasetModel(
            id=dataset.id,
            name=dataset.name,
            description=dataset.description,
            original_filename=dataset.original_filename,
            file_path=dataset.file_path,
            file_format=dataset.file_format,
            status=dataset.status,
            schema_data=dataset.schema.model_dump() if dataset.schema else None,
            current_version=dataset.current_version,
            tags=dataset.tags,
            metadata_=dataset.metadata,
            analysis_count=dataset.analysis_count,
        )
        self._session.add(model)
        await self._session.flush()
        return dataset

    async def find_by_id(self, dataset_id: uuid.UUID) -> Dataset | None:
        result = await self._session.execute(
            select(DatasetModel).where(DatasetModel.id == dataset_id)
        )
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def find_all(self, limit: int = 50, offset: int = 0) -> list[Dataset]:
        result = await self._session.execute(
            select(DatasetModel).order_by(DatasetModel.created_at.desc()).limit(limit).offset(offset)
        )
        return [self._to_entity(m) for m in result.scalars().all()]

    async def find_by_status(self, status: DatasetStatus) -> list[Dataset]:
        result = await self._session.execute(
            select(DatasetModel).where(DatasetModel.status == status).order_by(DatasetModel.created_at.desc())
        )
        return [self._to_entity(m) for m in result.scalars().all()]

    async def update(self, dataset: Dataset) -> Dataset:
        result = await self._session.execute(
            select(DatasetModel).where(DatasetModel.id == dataset.id)
        )
        model = result.scalar_one_or_none()
        if model is None:
            raise ValueError(f"Dataset {dataset.id} not found for update")
        model.name = dataset.name
        model.description = dataset.description
        model.status = dataset.status
        model.schema_data = dataset.schema.model_dump() if dataset.schema else None
        model.current_version = dataset.current_version
        model.tags = dataset.tags
        model.metadata_ = dataset.metadata
        model.analysis_count = dataset.analysis_count
        await self._session.flush()
        return dataset

    async def delete(self, dataset_id: uuid.UUID) -> bool:
        result = await self._session.execute(
            select(DatasetModel).where(DatasetModel.id == dataset_id)
        )
        model = result.scalar_one_or_none()
        if model is None:
            return False
        await self._session.delete(model)
        await self._session.flush()
        return True

    async def save_version(self, version: DatasetVersion) -> DatasetVersion:
        model = DatasetVersionModel(
            id=version.id,
            dataset_id=version.dataset_id,
            version_number=version.version_number,
            file_path=version.file_path,
            schema_snapshot=version.schema_snapshot.model_dump() if version.schema_snapshot else None,
            row_count=version.row_count,
            size_bytes=version.size_bytes,
            notes=version.notes,
        )
        self._session.add(model)
        await self._session.flush()
        return version

    async def find_versions(self, dataset_id: uuid.UUID) -> list[DatasetVersion]:
        result = await self._session.execute(
            select(DatasetVersionModel)
            .where(DatasetVersionModel.dataset_id == dataset_id)
            .order_by(DatasetVersionModel.version_number.desc())
        )
        return [self._version_to_entity(m) for m in result.scalars().all()]

    async def count(self) -> int:
        from sqlalchemy import func
        result = await self._session.execute(select(func.count()).select_from(DatasetModel))
        return result.scalar_one()

    async def search_by_name(self, query: str, limit: int = 20) -> list[Dataset]:
        result = await self._session.execute(
            select(DatasetModel)
            .where(DatasetModel.name.ilike(f"%{query}%"))
            .limit(limit)
        )
        return [self._to_entity(m) for m in result.scalars().all()]

    @staticmethod
    def _to_entity(model: DatasetModel) -> Dataset:
        schema = DatasetSchema(**model.schema_data) if model.schema_data else None
        return Dataset(
            id=model.id,
            name=model.name,
            description=model.description,
            original_filename=model.original_filename,
            file_path=model.file_path,
            file_format=model.file_format,
            status=DatasetStatus(model.status),
            schema=schema,
            current_version=model.current_version,
            tags=model.tags or [],
            metadata=model.metadata_ or {},
            analysis_count=model.analysis_count,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    @staticmethod
    def _version_to_entity(model: DatasetVersionModel) -> DatasetVersion:
        snapshot = DatasetSchema(**model.schema_snapshot) if model.schema_snapshot else None
        return DatasetVersion(
            id=model.id,
            dataset_id=model.dataset_id,
            version_number=model.version_number,
            file_path=model.file_path,
            schema_snapshot=snapshot,
            row_count=model.row_count,
            size_bytes=model.size_bytes,
            notes=model.notes,
            created_at=model.created_at,
        )
