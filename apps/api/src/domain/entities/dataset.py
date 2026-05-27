from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field, field_validator


class DatasetStatus(StrEnum):
    UPLOADING = "uploading"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"
    ARCHIVED = "archived"


class ColumnType(StrEnum):
    INTEGER = "integer"
    FLOAT = "float"
    STRING = "string"
    BOOLEAN = "boolean"
    DATETIME = "datetime"
    DATE = "date"
    UNKNOWN = "unknown"


class ColumnProfile(BaseModel):
    name: str
    dtype: ColumnType
    null_count: int
    null_pct: float
    unique_count: int
    cardinality: float  # unique_count / total_rows
    sample_values: list[Any] = Field(default_factory=list, max_length=10)
    min_value: float | str | None = None
    max_value: float | str | None = None
    mean_value: float | None = None
    std_value: float | None = None
    skewness: float | None = None
    kurtosis: float | None = None
    quantiles: dict[str, float] = Field(default_factory=dict)
    top_values: list[tuple[Any, int]] = Field(default_factory=list)


class DatasetSchema(BaseModel):
    columns: list[ColumnProfile]
    row_count: int
    column_count: int
    size_bytes: int
    inferred_primary_key: str | None = None
    inferred_time_column: str | None = None
    inferred_target_column: str | None = None
    correlation_matrix: dict[str, dict[str, float]] = Field(default_factory=dict)
    data_quality_score: float = Field(ge=0.0, le=1.0, default=0.0)


class DatasetVersion(BaseModel):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    dataset_id: uuid.UUID
    version_number: int
    file_path: str
    schema_snapshot: DatasetSchema | None = None
    row_count: int
    size_bytes: int
    created_at: datetime = Field(default_factory=datetime.utcnow)
    notes: str | None = None


class Dataset(BaseModel):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    original_filename: str
    file_path: str
    file_format: str  # csv | parquet | json
    status: DatasetStatus = DatasetStatus.UPLOADING
    schema: DatasetSchema | None = None  # type: ignore[assignment]
    current_version: int = 1
    versions: list[DatasetVersion] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    analysis_count: int = 0

    @field_validator("file_format")
    @classmethod
    def validate_format(cls, v: str) -> str:
        allowed = {"csv", "parquet", "json", "jsonl"}
        if v.lower() not in allowed:
            raise ValueError(f"Unsupported format '{v}'. Allowed: {allowed}")
        return v.lower()

    def mark_ready(self, schema: DatasetSchema) -> None:
        self.schema = schema
        self.status = DatasetStatus.READY
        self.updated_at = datetime.utcnow()

    def mark_failed(self) -> None:
        self.status = DatasetStatus.FAILED
        self.updated_at = datetime.utcnow()

    def increment_analysis_count(self) -> None:
        self.analysis_count += 1
        self.updated_at = datetime.utcnow()
