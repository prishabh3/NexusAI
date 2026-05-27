from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field


class InsightCategory(StrEnum):
    ANOMALY = "anomaly"
    TREND = "trend"
    CORRELATION = "correlation"
    FORECAST = "forecast"
    RECOMMENDATION = "recommendation"
    DATA_QUALITY = "data_quality"
    BUSINESS = "business"
    STATISTICAL = "statistical"


class InsightSeverity(StrEnum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"
    OPPORTUNITY = "opportunity"


class EvidenceItem(BaseModel):
    type: str  # sql_result | model_output | statistical_test
    description: str
    value: Any
    confidence: float = Field(ge=0.0, le=1.0)
    sql_query: str | None = None


class Insight(BaseModel):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    dataset_id: uuid.UUID
    analysis_id: uuid.UUID | None = None
    title: str = Field(min_length=1, max_length=500)
    body: str
    category: InsightCategory
    severity: InsightSeverity = InsightSeverity.INFO
    confidence_score: float = Field(ge=0.0, le=1.0)
    evidence: list[EvidenceItem] = Field(default_factory=list)
    affected_columns: list[str] = Field(default_factory=list)
    affected_rows: list[int] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    business_impact: str | None = None
    recommended_actions: list[str] = Field(default_factory=list)
    embedding: list[float] | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_verified: bool = False
    verification_notes: str | None = None

    def verify(self, notes: str | None = None) -> None:
        self.is_verified = True
        self.verification_notes = notes


class InsightMemory(BaseModel):
    """Stored insight with embedding for semantic retrieval."""

    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    insight_id: uuid.UUID
    content_hash: str
    embedding: list[float]
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
