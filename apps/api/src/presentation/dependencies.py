"""FastAPI dependency injection wiring."""
from __future__ import annotations

from functools import lru_cache

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.application.use_cases.run_analysis import RunAnalysisUseCase
from src.application.use_cases.upload_dataset import UploadDatasetUseCase
from src.domain.repositories.analysis_repository import AnalysisRepository
from src.domain.repositories.dataset_repository import DatasetRepository
from src.domain.repositories.insight_repository import InsightRepository
from src.domain.services.dataset_profiler import DatasetProfiler
from src.infrastructure.database.base import get_session
from src.infrastructure.database.repositories.analysis_repo import SqlAlchemyAnalysisRepository
from src.infrastructure.database.repositories.dataset_repo import SqlAlchemyDatasetRepository
from src.infrastructure.database.repositories.insight_repo import SqlAlchemyInsightRepository
from src.infrastructure.duckdb.engine import DuckDBEngine
from src.infrastructure.storage.file_handler import FileHandler


@lru_cache(maxsize=1)
def get_duckdb_engine() -> DuckDBEngine:
    return DuckDBEngine()


@lru_cache(maxsize=1)
def get_file_handler() -> FileHandler:
    return FileHandler()


@lru_cache(maxsize=1)
def get_profiler() -> DatasetProfiler:
    return DatasetProfiler()


async def get_dataset_repo(session: AsyncSession = Depends(get_session)) -> DatasetRepository:
    return SqlAlchemyDatasetRepository(session)


async def get_analysis_repo(session: AsyncSession = Depends(get_session)) -> AnalysisRepository:
    return SqlAlchemyAnalysisRepository(session)


async def get_insight_repo(session: AsyncSession = Depends(get_session)) -> InsightRepository:
    return SqlAlchemyInsightRepository(session)


async def get_upload_use_case(
    repo: DatasetRepository = Depends(get_dataset_repo),
    engine: DuckDBEngine = Depends(get_duckdb_engine),
    storage: FileHandler = Depends(get_file_handler),
    profiler: DatasetProfiler = Depends(get_profiler),
) -> UploadDatasetUseCase:
    return UploadDatasetUseCase(
        dataset_repository=repo,
        file_handler=storage,
        duckdb_engine=engine,
        profiler=profiler,
    )


async def get_run_analysis_use_case(
    dataset_repo: DatasetRepository = Depends(get_dataset_repo),
    analysis_repo: AnalysisRepository = Depends(get_analysis_repo),
    engine: DuckDBEngine = Depends(get_duckdb_engine),
) -> RunAnalysisUseCase:
    return RunAnalysisUseCase(
        dataset_repo=dataset_repo,
        analysis_repo=analysis_repo,
        duckdb_engine=engine,
    )


