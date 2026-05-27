"""Analysis execution and retrieval endpoints."""

from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from src.application.use_cases.run_analysis import RunAnalysisCommand, RunAnalysisUseCase
from src.domain.entities.analysis import Analysis, AnalysisResult, AnalysisStatus, AnalysisType
from src.domain.repositories.analysis_repository import AnalysisRepository
from src.presentation.dependencies import get_analysis_repo, get_run_analysis_use_case

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/analyses", tags=["analyses"])


class RunAnalysisRequest(BaseModel):
    dataset_id: uuid.UUID
    analysis_type: AnalysisType
    user_query: str | None = None
    configuration: dict = {}


class AnalysisSummaryResponse(BaseModel):
    id: uuid.UUID
    dataset_id: uuid.UUID
    analysis_type: AnalysisType
    status: AnalysisStatus
    user_query: str | None
    duration_seconds: float | None
    step_count: int
    created_at: str
    completed_at: str | None


class AnalysisDetailResponse(AnalysisSummaryResponse):
    agent_steps: list[dict]
    result: AnalysisResult | None
    error_message: str | None


def _to_summary(analysis: Analysis) -> AnalysisSummaryResponse:
    return AnalysisSummaryResponse(
        id=analysis.id,
        dataset_id=analysis.dataset_id,
        analysis_type=analysis.analysis_type,
        status=analysis.status,
        user_query=analysis.user_query,
        duration_seconds=analysis.duration_seconds,
        step_count=len(analysis.agent_steps),
        created_at=analysis.created_at.isoformat(),
        completed_at=analysis.completed_at.isoformat() if analysis.completed_at else None,
    )


@router.post("", status_code=status.HTTP_202_ACCEPTED, response_model=AnalysisSummaryResponse)
async def run_analysis(
    request: RunAnalysisRequest,
    use_case: RunAnalysisUseCase = Depends(get_run_analysis_use_case),
) -> AnalysisSummaryResponse:
    try:
        analysis = await use_case.execute(
            RunAnalysisCommand(
                dataset_id=request.dataset_id,
                analysis_type=request.analysis_type,
                user_query=request.user_query,
                configuration=request.configuration,
            )
        )
        return _to_summary(analysis)
    except Exception as exc:
        logger.exception("Analysis execution failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        ) from exc


@router.get("/recent", response_model=list[AnalysisSummaryResponse])
async def list_recent_analyses(
    limit: int = Query(default=10, le=50),
    repo: AnalysisRepository = Depends(get_analysis_repo),
) -> list[AnalysisSummaryResponse]:
    analyses = await repo.find_recent(limit=limit)
    return [_to_summary(a) for a in analyses]


@router.get("/dataset/{dataset_id}", response_model=list[AnalysisSummaryResponse])
async def list_analyses_for_dataset(
    dataset_id: uuid.UUID,
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0, ge=0),
    repo: AnalysisRepository = Depends(get_analysis_repo),
) -> list[AnalysisSummaryResponse]:
    analyses = await repo.find_by_dataset_id(dataset_id, limit=limit, offset=offset)
    return [_to_summary(a) for a in analyses]


@router.get("/{analysis_id}", response_model=AnalysisDetailResponse)
async def get_analysis(
    analysis_id: uuid.UUID,
    repo: AnalysisRepository = Depends(get_analysis_repo),
) -> AnalysisDetailResponse:
    analysis = await repo.find_by_id(analysis_id)
    if analysis is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Analysis {analysis_id} not found"
        )
    return AnalysisDetailResponse(
        **_to_summary(analysis).model_dump(),
        agent_steps=[step.model_dump() for step in analysis.agent_steps],
        result=analysis.result,
        error_message=analysis.error_message,
    )
