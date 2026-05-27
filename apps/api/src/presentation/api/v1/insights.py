"""Insight retrieval and semantic search endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from src.domain.entities.insight import Insight, InsightCategory, InsightSeverity
from src.domain.repositories.insight_repository import InsightRepository
from src.presentation.dependencies import get_insight_repo

router = APIRouter(prefix="/insights", tags=["insights"])


class InsightResponse(BaseModel):
    id: uuid.UUID
    dataset_id: uuid.UUID
    analysis_id: uuid.UUID | None
    title: str
    body: str
    category: InsightCategory
    severity: InsightSeverity
    confidence_score: float
    affected_columns: list[str]
    tags: list[str]
    business_impact: str | None
    recommended_actions: list[str]
    is_verified: bool
    created_at: str


def _to_response(insight: Insight) -> InsightResponse:
    return InsightResponse(
        id=insight.id,
        dataset_id=insight.dataset_id,
        analysis_id=insight.analysis_id,
        title=insight.title,
        body=insight.body,
        category=insight.category,
        severity=insight.severity,
        confidence_score=insight.confidence_score,
        affected_columns=insight.affected_columns,
        tags=insight.tags,
        business_impact=insight.business_impact,
        recommended_actions=insight.recommended_actions,
        is_verified=insight.is_verified,
        created_at=insight.created_at.isoformat(),
    )


@router.get("", response_model=list[InsightResponse])
async def list_all_insights(
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    repo: InsightRepository = Depends(get_insight_repo),
) -> list[InsightResponse]:
    insights = await repo.find_recent(limit=limit, offset=offset)
    return [_to_response(i) for i in insights]


@router.get("/dataset/{dataset_id}", response_model=list[InsightResponse])
async def list_insights(
    dataset_id: uuid.UUID,
    category: InsightCategory | None = Query(default=None),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    repo: InsightRepository = Depends(get_insight_repo),
) -> list[InsightResponse]:
    if category:
        insights = await repo.find_by_category(dataset_id, category)
        return [_to_response(i) for i in insights[offset : offset + limit]]
    insights = await repo.find_by_dataset_id(dataset_id, limit=limit, offset=offset)
    return [_to_response(i) for i in insights]


@router.get("/{insight_id}", response_model=InsightResponse)
async def get_insight(
    insight_id: uuid.UUID,
    repo: InsightRepository = Depends(get_insight_repo),
) -> InsightResponse:
    insight = await repo.find_by_id(insight_id)
    if insight is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Insight not found")
    return _to_response(insight)


@router.post("/{insight_id}/verify", response_model=InsightResponse)
async def verify_insight(
    insight_id: uuid.UUID,
    notes: str | None = None,
    repo: InsightRepository = Depends(get_insight_repo),
) -> InsightResponse:
    insight = await repo.find_by_id(insight_id)
    if insight is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Insight not found")
    insight.verify(notes=notes)
    updated = await repo.update(insight)
    return _to_response(updated)


@router.get("/{insight_id}/similar", response_model=list[InsightResponse])
async def get_similar_insights(
    insight_id: uuid.UUID,
    limit: int = Query(default=5, le=20),
    repo: InsightRepository = Depends(get_insight_repo),
) -> list[InsightResponse]:
    similar = await repo.find_similar(insight_id, limit=limit)
    return [_to_response(i) for i in similar]
