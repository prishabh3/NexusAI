"""SQLAlchemy + pgvector implementation of InsightRepository."""
from __future__ import annotations

import uuid

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.entities.insight import (
    EvidenceItem,
    Insight,
    InsightCategory,
    InsightMemory,
    InsightSeverity,
)
from src.domain.repositories.insight_repository import InsightRepository
from src.infrastructure.database.models import InsightModel


class SqlAlchemyInsightRepository(InsightRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def save(self, insight: Insight) -> Insight:
        model = InsightModel(
            id=insight.id,
            dataset_id=insight.dataset_id,
            analysis_id=insight.analysis_id,
            title=insight.title,
            body=insight.body,
            category=insight.category,
            severity=insight.severity,
            confidence_score=insight.confidence_score,
            evidence=[e.model_dump() for e in insight.evidence],
            affected_columns=insight.affected_columns,
            tags=insight.tags,
            business_impact=insight.business_impact,
            recommended_actions=insight.recommended_actions,
            embedding=insight.embedding,
            is_verified=insight.is_verified,
            verification_notes=insight.verification_notes,
        )
        self._session.add(model)
        await self._session.flush()
        return insight

    async def find_by_id(self, insight_id: uuid.UUID) -> Insight | None:
        result = await self._session.execute(
            select(InsightModel).where(InsightModel.id == insight_id)
        )
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def find_by_dataset_id(
        self,
        dataset_id: uuid.UUID,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Insight]:
        result = await self._session.execute(
            select(InsightModel)
            .where(InsightModel.dataset_id == dataset_id)
            .order_by(InsightModel.confidence_score.desc())
            .limit(limit)
            .offset(offset)
        )
        return [self._to_entity(m) for m in result.scalars().all()]

    async def find_recent(self, limit: int = 50, offset: int = 0) -> list[Insight]:
        result = await self._session.execute(
            select(InsightModel)
            .order_by(InsightModel.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return [self._to_entity(m) for m in result.scalars().all()]

    async def find_by_category(
        self, dataset_id: uuid.UUID, category: InsightCategory
    ) -> list[Insight]:
        result = await self._session.execute(
            select(InsightModel)
            .where(InsightModel.dataset_id == dataset_id, InsightModel.category == category)
            .order_by(InsightModel.confidence_score.desc())
        )
        return [self._to_entity(m) for m in result.scalars().all()]

    async def update(self, insight: Insight) -> Insight:
        result = await self._session.execute(
            select(InsightModel).where(InsightModel.id == insight.id)
        )
        model = result.scalar_one_or_none()
        if model is None:
            raise ValueError(f"Insight {insight.id} not found")
        model.is_verified = insight.is_verified
        model.verification_notes = insight.verification_notes
        model.body = insight.body
        await self._session.flush()
        return insight

    async def delete(self, insight_id: uuid.UUID) -> bool:
        result = await self._session.execute(
            select(InsightModel).where(InsightModel.id == insight_id)
        )
        model = result.scalar_one_or_none()
        if model is None:
            return False
        await self._session.delete(model)
        await self._session.flush()
        return True

    async def save_memory(self, memory: InsightMemory) -> InsightMemory:
        return memory  # Handled by embedding column on InsightModel

    async def semantic_search(
        self,
        embedding: list[float],
        limit: int = 10,
        similarity_threshold: float = 0.75,
    ) -> list[tuple[Insight, float]]:
        stmt = text("""
            SELECT id, 1 - (embedding <=> :embedding) AS similarity
            FROM insights
            WHERE embedding IS NOT NULL
              AND 1 - (embedding <=> :embedding) >= :threshold
            ORDER BY embedding <=> :embedding
            LIMIT :limit
        """)
        result = await self._session.execute(
            stmt,
            {"embedding": str(embedding), "threshold": similarity_threshold, "limit": limit},
        )
        rows = result.fetchall()
        insights_with_scores = []
        for row in rows:
            insight = await self.find_by_id(row.id)
            if insight:
                insights_with_scores.append((insight, float(row.similarity)))
        return insights_with_scores

    async def find_similar(self, insight_id: uuid.UUID, limit: int = 5) -> list[Insight]:
        source = await self.find_by_id(insight_id)
        if source is None or source.embedding is None:
            return []
        results = await self.semantic_search(source.embedding, limit=limit + 1)
        return [ins for ins, _ in results if ins.id != insight_id][:limit]

    @staticmethod
    def _to_entity(model: InsightModel) -> Insight:
        evidence = [EvidenceItem(**e) for e in (model.evidence or [])]
        return Insight(
            id=model.id,
            dataset_id=model.dataset_id,
            analysis_id=model.analysis_id,
            title=model.title,
            body=model.body,
            category=InsightCategory(model.category),
            severity=InsightSeverity(model.severity),
            confidence_score=model.confidence_score,
            evidence=evidence,
            affected_columns=model.affected_columns or [],
            tags=model.tags or [],
            business_impact=model.business_impact,
            recommended_actions=model.recommended_actions or [],
            embedding=list(model.embedding) if model.embedding is not None else None,
            is_verified=model.is_verified,
            verification_notes=model.verification_notes,
            created_at=model.created_at,
        )
