"""Dataset management endpoints."""

from __future__ import annotations

import logging
import uuid
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, Field

from src.application.use_cases.upload_dataset import UploadDatasetCommand, UploadDatasetUseCase
from src.domain.entities.dataset import Dataset, DatasetSchema, DatasetStatus
from src.domain.repositories.dataset_repository import DatasetRepository
from src.presentation.dependencies import get_dataset_repo, get_upload_use_case

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/datasets", tags=["datasets"])


class DatasetSummaryResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    original_filename: str
    file_format: str
    status: DatasetStatus
    row_count: int | None = None
    column_count: int | None = None
    data_quality_score: float | None = None
    analysis_count: int
    tags: list[str]
    created_at: str
    updated_at: str


class DatasetDetailResponse(DatasetSummaryResponse):
    schema: DatasetSchema | None = None  # type: ignore[assignment]
    metadata: dict[str, Any] = Field(default_factory=dict)


def _to_summary(dataset: Dataset) -> DatasetSummaryResponse:
    row_count = dataset.schema.row_count if dataset.schema else None
    col_count = dataset.schema.column_count if dataset.schema else None
    quality = dataset.schema.data_quality_score if dataset.schema else None
    return DatasetSummaryResponse(
        id=dataset.id,
        name=dataset.name,
        description=dataset.description,
        original_filename=dataset.original_filename,
        file_format=dataset.file_format,
        status=dataset.status,
        row_count=row_count,
        column_count=col_count,
        data_quality_score=quality,
        analysis_count=dataset.analysis_count,
        tags=dataset.tags,
        created_at=dataset.created_at.isoformat(),
        updated_at=dataset.updated_at.isoformat(),
    )


@router.post("", status_code=status.HTTP_201_CREATED, response_model=DatasetDetailResponse)
async def upload_dataset(
    file: UploadFile = File(...),
    name: str = Form(...),
    description: str | None = Form(None),
    tags: str = Form(""),
    use_case: UploadDatasetUseCase = Depends(get_upload_use_case),
    repo: DatasetRepository = Depends(get_dataset_repo),
) -> DatasetDetailResponse:
    if file.content_type not in (
        "text/csv",
        "application/octet-stream",
        "application/json",
        "application/x-parquet",
    ):
        pass  # Accept all; format validated by extension

    content = await file.read()
    tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []

    try:
        result = await use_case.execute(
            UploadDatasetCommand(
                file_content=content,
                original_filename=file.filename or "upload",
                name=name,
                description=description,
                tags=tag_list,
            )
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc

    dataset = await repo.find_by_id(result.dataset_id)
    if dataset is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Dataset lost after creation"
        )

    return DatasetDetailResponse(
        **_to_summary(dataset).model_dump(),
        schema=dataset.schema,
        metadata=dataset.metadata,
    )


@router.get("", response_model=list[DatasetSummaryResponse])
async def list_datasets(
    limit: int = Query(default=50, le=200, ge=1),
    offset: int = Query(default=0, ge=0),
    repo: DatasetRepository = Depends(get_dataset_repo),
) -> list[DatasetSummaryResponse]:
    datasets = await repo.find_all(limit=limit, offset=offset)
    return [_to_summary(d) for d in datasets]


# /search must be registered before /{dataset_id} so FastAPI doesn't try to
# parse the literal string "search" as a UUID path parameter.
@router.get("/search", response_model=list[DatasetSummaryResponse])
async def search_datasets(
    q: str = Query(min_length=2),
    limit: int = Query(default=20, le=50),
    repo: DatasetRepository = Depends(get_dataset_repo),
) -> list[DatasetSummaryResponse]:
    datasets = await repo.search_by_name(q, limit=limit)
    return [_to_summary(d) for d in datasets]


@router.get("/{dataset_id}", response_model=DatasetDetailResponse)
async def get_dataset(
    dataset_id: uuid.UUID,
    repo: DatasetRepository = Depends(get_dataset_repo),
) -> DatasetDetailResponse:
    dataset = await repo.find_by_id(dataset_id)
    if dataset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Dataset {dataset_id} not found"
        )
    return DatasetDetailResponse(
        **_to_summary(dataset).model_dump(),
        schema=dataset.schema,
        metadata=dataset.metadata,
    )


@router.delete("/{dataset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dataset(
    dataset_id: uuid.UUID,
    repo: DatasetRepository = Depends(get_dataset_repo),
) -> None:
    deleted = await repo.delete(dataset_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Dataset {dataset_id} not found"
        )


@router.get("/{dataset_id}/versions")
async def list_versions(
    dataset_id: uuid.UUID,
    repo: DatasetRepository = Depends(get_dataset_repo),
) -> list[dict[str, Any]]:
    dataset = await repo.find_by_id(dataset_id)
    if dataset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    versions = await repo.find_versions(dataset_id)
    return [v.model_dump() for v in versions]
