from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field


class AnalysisType(StrEnum):
    EDA = "eda"
    ANOMALY_DETECTION = "anomaly_detection"
    FORECASTING = "forecasting"
    CLUSTERING = "clustering"
    CLASSIFICATION = "classification"
    REGRESSION = "regression"
    CORRELATION = "correlation"
    CUSTOM_QUERY = "custom_query"
    FULL_PIPELINE = "full_pipeline"


class AnalysisStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class SQLExecution(BaseModel):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    query: str
    natural_language_intent: str | None = None
    execution_time_ms: float
    row_count: int
    result_preview: list[dict[str, Any]] = Field(default_factory=list)
    execution_plan: str | None = None
    error: str | None = None
    executed_at: datetime = Field(default_factory=datetime.utcnow)


class AgentStep(BaseModel):
    step_number: int
    agent_name: str
    action: str
    tool_name: str | None = None
    tool_input: dict[str, Any] = Field(default_factory=dict)
    tool_output: str | None = None
    reasoning: str
    sql_executions: list[SQLExecution] = Field(default_factory=list)
    duration_ms: float = 0.0
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class AnomalyRecord(BaseModel):
    row_index: int
    anomaly_score: float
    algorithm: str
    affected_columns: list[str]
    explanation: str
    severity: str  # low | medium | high | critical


class ForecastPoint(BaseModel):
    timestamp: datetime
    value: float
    lower_bound: float
    upper_bound: float
    is_forecast: bool = False


class MLResult(BaseModel):
    model_name: str
    task_type: str
    metrics: dict[str, float]
    feature_importance: dict[str, float] = Field(default_factory=dict)
    shap_values: dict[str, list[float]] = Field(default_factory=dict)
    confusion_matrix: list[list[int]] | None = None
    forecast_points: list[ForecastPoint] = Field(default_factory=list)
    anomalies: list[AnomalyRecord] = Field(default_factory=list)
    natural_language_summary: str = ""


class AnalysisResult(BaseModel):
    summary: str
    key_findings: list[str] = Field(default_factory=list)
    sql_executions: list[SQLExecution] = Field(default_factory=list)
    ml_results: list[MLResult] = Field(default_factory=list)
    visualizations: list[dict[str, Any]] = Field(default_factory=list)
    data_quality_notes: list[str] = Field(default_factory=list)
    confidence_score: float = Field(ge=0.0, le=1.0, default=0.0)
    evidence_references: list[str] = Field(default_factory=list)


class Analysis(BaseModel):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    dataset_id: uuid.UUID
    analysis_type: AnalysisType
    status: AnalysisStatus = AnalysisStatus.QUEUED
    user_query: str | None = None
    configuration: dict[str, Any] = Field(default_factory=dict)
    agent_steps: list[AgentStep] = Field(default_factory=list)
    result: AnalysisResult | None = None
    error_message: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    duration_seconds: float | None = None
    prompt_tokens_used: int = 0
    completion_tokens_used: int = 0

    def start(self) -> None:
        self.status = AnalysisStatus.RUNNING
        self.started_at = datetime.utcnow()

    def complete(self, result: AnalysisResult) -> None:
        self.status = AnalysisStatus.COMPLETED
        self.result = result
        self.completed_at = datetime.utcnow()
        if self.started_at:
            self.duration_seconds = (self.completed_at - self.started_at).total_seconds()

    def fail(self, error: str) -> None:
        self.status = AnalysisStatus.FAILED
        self.error_message = error
        self.completed_at = datetime.utcnow()

    def add_agent_step(self, step: AgentStep) -> None:
        self.agent_steps.append(step)
