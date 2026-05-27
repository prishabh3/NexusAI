"""SQLAlchemy implementation of AnalysisRepository."""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.entities.analysis import (
    AgentStep,
    Analysis,
    AnalysisResult,
    AnalysisStatus,
    AnalysisType,
    AnomalyRecord,
    ForecastPoint,
    MLResult,
    SQLExecution,
)
from src.domain.repositories.analysis_repository import AnalysisRepository
from src.infrastructure.database.models import AnalysisModel


class SqlAlchemyAnalysisRepository(AnalysisRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def save(self, analysis: Analysis) -> Analysis:
        model = AnalysisModel(
            id=analysis.id,
            dataset_id=analysis.dataset_id,
            analysis_type=analysis.analysis_type,
            status=analysis.status,
            user_query=analysis.user_query,
            configuration=analysis.configuration,
            agent_steps=[s.model_dump(mode="json") for s in analysis.agent_steps],
            result=analysis.result.model_dump(mode="json") if analysis.result else None,
            error_message=analysis.error_message,
            duration_seconds=analysis.duration_seconds,
            prompt_tokens_used=analysis.prompt_tokens_used,
            completion_tokens_used=analysis.completion_tokens_used,
        )
        self._session.add(model)
        await self._session.flush()
        return analysis

    async def find_by_id(self, analysis_id: uuid.UUID) -> Analysis | None:
        result = await self._session.execute(
            select(AnalysisModel).where(AnalysisModel.id == analysis_id)
        )
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def find_by_dataset_id(
        self,
        dataset_id: uuid.UUID,
        limit: int = 20,
        offset: int = 0,
    ) -> list[Analysis]:
        result = await self._session.execute(
            select(AnalysisModel)
            .where(AnalysisModel.dataset_id == dataset_id)
            .order_by(AnalysisModel.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return [self._to_entity(m) for m in result.scalars().all()]

    async def find_by_status(self, status: AnalysisStatus) -> list[Analysis]:
        result = await self._session.execute(
            select(AnalysisModel).where(AnalysisModel.status == status)
        )
        return [self._to_entity(m) for m in result.scalars().all()]

    async def update(self, analysis: Analysis) -> Analysis:
        result = await self._session.execute(
            select(AnalysisModel).where(AnalysisModel.id == analysis.id)
        )
        model = result.scalar_one_or_none()
        if model is None:
            raise ValueError(f"Analysis {analysis.id} not found")
        model.status = analysis.status
        model.agent_steps = [s.model_dump(mode="json") for s in analysis.agent_steps]
        model.result = analysis.result.model_dump(mode="json") if analysis.result else None
        model.error_message = analysis.error_message
        model.duration_seconds = analysis.duration_seconds
        model.prompt_tokens_used = analysis.prompt_tokens_used
        model.completion_tokens_used = analysis.completion_tokens_used
        await self._session.flush()
        return analysis

    async def delete(self, analysis_id: uuid.UUID) -> bool:
        result = await self._session.execute(
            select(AnalysisModel).where(AnalysisModel.id == analysis_id)
        )
        model = result.scalar_one_or_none()
        if model is None:
            return False
        await self._session.delete(model)
        await self._session.flush()
        return True

    async def find_recent(self, limit: int = 10) -> list[Analysis]:
        result = await self._session.execute(
            select(AnalysisModel).order_by(AnalysisModel.created_at.desc()).limit(limit)
        )
        return [self._to_entity(m) for m in result.scalars().all()]

    async def find_by_type(self, dataset_id: uuid.UUID, analysis_type: AnalysisType) -> list[Analysis]:
        result = await self._session.execute(
            select(AnalysisModel)
            .where(
                AnalysisModel.dataset_id == dataset_id,
                AnalysisModel.analysis_type == analysis_type,
            )
            .order_by(AnalysisModel.created_at.desc())
        )
        return [self._to_entity(m) for m in result.scalars().all()]

    @staticmethod
    def _to_entity(model: AnalysisModel) -> Analysis:

        steps = [AgentStep(**s) for s in (model.agent_steps or [])]
        result = None
        if model.result:
            ml_results = []
            for ml in model.result.get("ml_results", []):
                fps = [ForecastPoint(**fp) for fp in ml.get("forecast_points", [])]
                anomalies = [AnomalyRecord(**a) for a in ml.get("anomalies", [])]
                ml_results.append(MLResult(**{**ml, "forecast_points": fps, "anomalies": anomalies}))
            sql_execs = [SQLExecution(**s) for s in model.result.get("sql_executions", [])]
            result = AnalysisResult(
                **{
                    **model.result,
                    "ml_results": ml_results,
                    "sql_executions": sql_execs,
                }
            )

        return Analysis(
            id=model.id,
            dataset_id=model.dataset_id,
            analysis_type=AnalysisType(model.analysis_type),
            status=AnalysisStatus(model.status),
            user_query=model.user_query,
            configuration=model.configuration or {},
            agent_steps=steps,
            result=result,
            error_message=model.error_message,
            duration_seconds=model.duration_seconds,
            prompt_tokens_used=model.prompt_tokens_used or 0,
            completion_tokens_used=model.completion_tokens_used or 0,
            created_at=model.created_at,
        )
