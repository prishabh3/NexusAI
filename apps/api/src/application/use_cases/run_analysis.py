"""Run analysis use case — dispatches the appropriate agent workflow."""
from __future__ import annotations

import asyncio
import logging
import uuid
from collections.abc import Callable, Coroutine
from dataclasses import dataclass
from typing import Any

import pandas as pd

from src.domain.entities.analysis import Analysis, AnalysisResult, AnalysisType, MLResult
from src.domain.entities.dataset import Dataset, DatasetStatus
from src.domain.repositories.analysis_repository import AnalysisRepository
from src.domain.repositories.dataset_repository import DatasetRepository
from src.infrastructure.ai.agents.coordinator import AnalysisCoordinator
from src.infrastructure.duckdb.engine import DuckDBEngine
from src.infrastructure.events.bus import DomainEvent, EventType, event_bus
from src.infrastructure.ml.anomaly.detector import AnomalyDetector
from src.infrastructure.ml.automl.pipeline import AutoMLPipeline
from src.infrastructure.ml.forecasting.prophet_forecaster import ProphetForecaster

logger = logging.getLogger(__name__)

StepCallback = Callable[[Any], Coroutine[Any, Any, None]]


@dataclass
class RunAnalysisCommand:
    dataset_id: uuid.UUID
    analysis_type: AnalysisType
    user_query: str | None = None
    configuration: dict[str, Any] | None = None


class AnalysisNotFoundError(Exception):
    pass


class DatasetNotReadyError(Exception):
    pass


class RunAnalysisUseCase:
    def __init__(
        self,
        dataset_repo: DatasetRepository,
        analysis_repo: AnalysisRepository,
        duckdb_engine: DuckDBEngine,
    ) -> None:
        self._dataset_repo = dataset_repo
        self._analysis_repo = analysis_repo
        self._engine = duckdb_engine

    async def execute(
        self,
        command: RunAnalysisCommand,
        on_step: StepCallback | None = None,
    ) -> Analysis:
        dataset = await self._dataset_repo.find_by_id(command.dataset_id)
        if dataset is None:
            raise AnalysisNotFoundError(f"Dataset {command.dataset_id} not found")
        if dataset.status != DatasetStatus.READY:
            raise DatasetNotReadyError(
                f"Dataset {command.dataset_id} is not ready (status: {dataset.status})"
            )

        table_name = dataset.metadata.get("duckdb_table", f"ds_{dataset.id.hex[:12]}")

        analysis = Analysis(
            dataset_id=command.dataset_id,
            analysis_type=command.analysis_type,
            user_query=command.user_query,
            configuration=command.configuration or {},
        )
        analysis = await self._analysis_repo.save(analysis)
        analysis.start()
        await self._analysis_repo.update(analysis)

        await event_bus.publish(DomainEvent(
            event_type=EventType.ANALYSIS_STARTED,
            payload={"analysis_id": str(analysis.id), "type": command.analysis_type},
            aggregate_id=analysis.id,
        ))

        try:
            result = await self._dispatch(analysis, dataset, table_name, on_step)
            analysis.complete(result)
            dataset.increment_analysis_count()
            await self._analysis_repo.update(analysis)
            await self._dataset_repo.update(dataset)

            await event_bus.publish(DomainEvent(
                event_type=EventType.ANALYSIS_COMPLETED,
                payload={"analysis_id": str(analysis.id)},
                aggregate_id=analysis.id,
            ))

            return analysis

        except Exception as exc:
            logger.exception("Analysis %s failed: %s", analysis.id, exc)
            analysis.fail(str(exc))
            await self._analysis_repo.update(analysis)
            await event_bus.publish(DomainEvent(
                event_type=EventType.ANALYSIS_FAILED,
                payload={"analysis_id": str(analysis.id), "error": str(exc)},
                aggregate_id=analysis.id,
            ))
            raise

    async def _dispatch(
        self,
        analysis: Analysis,
        dataset: Dataset,
        table_name: str,
        on_step: StepCallback | None,
    ) -> Any:
        coordinator = AnalysisCoordinator(
            engine=self._engine,
            table_name=table_name,
        )

        if analysis.analysis_type in (
            AnalysisType.EDA,
            AnalysisType.CORRELATION,
            AnalysisType.CUSTOM_QUERY,
            AnalysisType.FULL_PIPELINE,
        ):
            return await coordinator.run_analysis(analysis, on_step=on_step)

        if analysis.analysis_type == AnalysisType.ANOMALY_DETECTION:
            return await self._run_anomaly_detection(analysis, table_name)

        if analysis.analysis_type == AnalysisType.FORECASTING:
            return await self._run_forecasting(analysis, dataset, table_name)

        if analysis.analysis_type in (
            AnalysisType.CLASSIFICATION,
            AnalysisType.REGRESSION,
            AnalysisType.CLUSTERING,
        ):
            return await self._run_automl(analysis, dataset, table_name)

        return await coordinator.run_analysis(analysis, on_step=on_step)

    async def _run_anomaly_detection(self, analysis: Analysis, table_name: str) -> AnalysisResult:
        result = await self._engine.execute_query(f"SELECT * FROM {table_name} LIMIT 50000")
        if not result.result_preview:
            return AnalysisResult(
                summary="No data available for anomaly detection.", confidence_score=0.0
            )

        df = pd.DataFrame(result.result_preview)
        detector = AnomalyDetector()
        loop = asyncio.get_event_loop()
        anomalies = await loop.run_in_executor(None, detector.detect, df)

        await event_bus.publish(DomainEvent(
            event_type=EventType.ANOMALY_DETECTED,
            payload={"analysis_id": str(analysis.id), "count": len(anomalies)},
            aggregate_id=analysis.id,
        ))

        ml_result = MLResult(
            model_name="Ensemble(IsolationForest+LOF+DBSCAN)",
            task_type="anomaly_detection",
            metrics={
                "anomaly_count": float(len(anomalies)),
                "anomaly_rate": round(len(anomalies) / len(df), 4),
            },
            anomalies=anomalies,
            natural_language_summary=(
                f"Detected {len(anomalies)} anomalies "
                f"({len(anomalies) / len(df) * 100:.1f}% of {len(df)} rows) "
                "using ensemble detection."
            ),
        )
        return AnalysisResult(
            summary=ml_result.natural_language_summary,
            key_findings=[f"{len(anomalies)} anomalies detected across {len(df)} rows"],
            ml_results=[ml_result],
            confidence_score=0.82,
        )

    async def _run_forecasting(
        self, analysis: Analysis, dataset: Dataset, table_name: str
    ) -> AnalysisResult:
        config = analysis.configuration
        time_col = config.get("time_column") or (
            dataset.schema.inferred_time_column if dataset.schema else None  # type: ignore[union-attr]
        )
        value_col = config.get("value_column") or (
            dataset.schema.inferred_target_column if dataset.schema else None  # type: ignore[union-attr]
        )

        if not time_col or not value_col:
            return AnalysisResult(
                summary="Forecasting requires time_column and value_column in configuration.",
                confidence_score=0.0,
            )

        result = await self._engine.execute_query(
            f"SELECT {time_col}, {value_col} FROM {table_name} ORDER BY {time_col}"
        )
        df = pd.DataFrame(result.result_preview)
        forecaster = ProphetForecaster()
        loop = asyncio.get_event_loop()
        forecast_points = await loop.run_in_executor(
            None, forecaster.fit_predict, df, time_col, value_col
        )

        historical = sum(1 for p in forecast_points if not p.is_forecast)
        future_points = sum(1 for p in forecast_points if p.is_forecast)

        await event_bus.publish(DomainEvent(
            event_type=EventType.FORECAST_COMPUTED,
            payload={"analysis_id": str(analysis.id), "periods": future_points},
            aggregate_id=analysis.id,
        ))

        ml_result = MLResult(
            model_name="Prophet+XGBoost",
            task_type="forecasting",
            metrics={},
            forecast_points=forecast_points,
            natural_language_summary=(
                f"Generated {future_points}-period forecast for '{value_col}' "
                f"based on {historical} historical observations."
            ),
        )
        return AnalysisResult(
            summary=ml_result.natural_language_summary,
            key_findings=[f"Forecasted {future_points} future periods for {value_col}"],
            ml_results=[ml_result],
            confidence_score=0.75,
        )

    async def _run_automl(
        self, analysis: Analysis, dataset: Dataset, table_name: str
    ) -> AnalysisResult:
        config = analysis.configuration
        target_col = config.get("target_column") or (
            dataset.schema.inferred_target_column if dataset.schema else None  # type: ignore[union-attr]
        )
        if not target_col:
            return AnalysisResult(
                summary="AutoML requires target_column in configuration.", confidence_score=0.0
            )

        result = await self._engine.execute_query(f"SELECT * FROM {table_name} LIMIT 100000")
        df = pd.DataFrame(result.result_preview)
        pipeline = AutoMLPipeline()
        loop = asyncio.get_event_loop()
        ml_result = await loop.run_in_executor(None, pipeline.run, df, target_col)

        return AnalysisResult(
            summary=ml_result.natural_language_summary,
            key_findings=[ml_result.natural_language_summary],
            ml_results=[ml_result],
            confidence_score=min(0.95, max(ml_result.metrics.values(), default=0.0)),
        )
