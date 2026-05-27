"""Upload dataset use case — orchestrates file storage, profiling, and DuckDB registration."""
from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass

import pandas as pd

from src.domain.entities.dataset import Dataset, DatasetSchema, DatasetStatus
from src.domain.repositories.dataset_repository import DatasetRepository
from src.domain.services.dataset_profiler import DatasetProfiler
from src.infrastructure.duckdb.engine import DuckDBEngine
from src.infrastructure.events.bus import DomainEvent, EventType, event_bus
from src.infrastructure.storage.file_handler import FileHandler

logger = logging.getLogger(__name__)


@dataclass
class UploadDatasetCommand:
    file_content: bytes
    original_filename: str
    name: str
    description: str | None = None
    tags: list[str] | None = None


@dataclass
class UploadDatasetResult:
    dataset_id: uuid.UUID
    name: str
    row_count: int
    column_count: int
    data_quality_score: float
    status: str


class UploadDatasetUseCase:
    def __init__(
        self,
        dataset_repository: DatasetRepository,
        file_handler: FileHandler,
        duckdb_engine: DuckDBEngine,
        profiler: DatasetProfiler,
    ) -> None:
        self._repo = dataset_repository
        self._storage = file_handler
        self._engine = duckdb_engine
        self._profiler = profiler

    async def execute(self, command: UploadDatasetCommand) -> UploadDatasetResult:
        if len(command.file_content) > self._storage._base.__class__.__mro__[0].__dict__.get("_limit", 2**30):
            pass  # size checked in handler

        file_path, content_hash = await self._storage.save_upload(
            command.file_content,
            command.original_filename,
        )

        ext = command.original_filename.rsplit(".", 1)[-1].lower()
        dataset = Dataset(
            name=command.name,
            description=command.description,
            original_filename=command.original_filename,
            file_path=file_path,
            file_format=ext,
            status=DatasetStatus.PROCESSING,
            tags=command.tags or [],
        )
        dataset = await self._repo.save(dataset)

        await event_bus.publish(DomainEvent(
            event_type=EventType.DATASET_UPLOADED,
            payload={"dataset_id": str(dataset.id), "file_path": file_path},
            aggregate_id=dataset.id,
        ))

        try:
            schema = await self._profile_dataset(dataset, file_path)
            dataset.mark_ready(schema)
            await self._repo.update(dataset)

            table_name = f"ds_{dataset.id.hex[:12]}"
            await self._engine.register_dataset(table_name, file_path, ext)

            dataset.metadata["duckdb_table"] = table_name
            await self._repo.update(dataset)

            await event_bus.publish(DomainEvent(
                event_type=EventType.DATASET_PROFILED,
                payload={"dataset_id": str(dataset.id), "table": table_name},
                aggregate_id=dataset.id,
            ))

            return UploadDatasetResult(
                dataset_id=dataset.id,
                name=dataset.name,
                row_count=schema.row_count,
                column_count=schema.column_count,
                data_quality_score=schema.data_quality_score,
                status=dataset.status,
            )

        except Exception as exc:
            logger.exception("Dataset profiling failed for %s: %s", dataset.id, exc)
            dataset.mark_failed()
            await self._repo.update(dataset)
            await event_bus.publish(DomainEvent(
                event_type=EventType.DATASET_FAILED,
                payload={"dataset_id": str(dataset.id), "error": str(exc)},
                aggregate_id=dataset.id,
            ))
            raise

    async def _profile_dataset(self, dataset: Dataset, file_path: str) -> DatasetSchema:
        df = self._load_dataframe(file_path, dataset.file_format)
        row_count = len(df)
        size_bytes = self._storage.get_file_size(file_path)

        columns = [
            self._profiler.profile_column(col, df[col].tolist(), row_count)
            for col in df.columns
        ]

        quality_score = self._profiler.compute_data_quality_score(columns, row_count)
        pk = self._profiler.infer_primary_key(columns, row_count)
        time_col = self._profiler.infer_time_column(columns)
        target_col = self._profiler.infer_target_column(columns)

        corr: dict[str, dict[str, float]] = {}
        numeric_cols = df.select_dtypes(include="number").columns.tolist()
        if len(numeric_cols) >= 2:
            corr_matrix = df[numeric_cols].corr()
            corr = {
                col: {
                    other: round(float(corr_matrix.loc[col, other]), 4)
                    for other in numeric_cols if other != col
                }
                for col in numeric_cols
            }

        return DatasetSchema(
            columns=columns,
            row_count=row_count,
            column_count=len(df.columns),
            size_bytes=size_bytes,
            inferred_primary_key=pk,
            inferred_time_column=time_col,
            inferred_target_column=target_col,
            correlation_matrix=corr,
            data_quality_score=quality_score,
        )

    @staticmethod
    def _load_dataframe(file_path: str, file_format: str) -> pd.DataFrame:
        if file_format == "csv":
            return pd.read_csv(file_path, low_memory=False)
        elif file_format == "parquet":
            return pd.read_parquet(file_path)
        elif file_format in ("json", "jsonl"):
            lines = file_format == "jsonl"
            return pd.read_json(file_path, lines=lines)
        raise ValueError(f"Unsupported format: {file_format}")
