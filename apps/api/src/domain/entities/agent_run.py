from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field


class AgentType(StrEnum):
    COORDINATOR = "coordinator"
    EDA = "eda"
    SQL = "sql"
    FORECAST = "forecast"
    ANOMALY = "anomaly"
    INSIGHT = "insight"
    VISUALIZATION = "visualization"


class ToolCallRecord(BaseModel):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    tool_name: str
    tool_input: dict[str, Any]
    tool_output: str
    duration_ms: float
    success: bool
    error: str | None = None
    called_at: datetime = Field(default_factory=datetime.utcnow)


class AgentRunStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    TIMEOUT = "timeout"


class AgentRun(BaseModel):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    analysis_id: uuid.UUID
    agent_type: AgentType
    status: AgentRunStatus = AgentRunStatus.PENDING
    system_prompt: str
    initial_message: str
    tool_calls: list[ToolCallRecord] = Field(default_factory=list)
    messages: list[dict[str, Any]] = Field(default_factory=list)
    final_output: str | None = None
    iteration_count: int = 0
    max_iterations: int = 15
    model_name: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    def add_tool_call(self, record: ToolCallRecord) -> None:
        self.tool_calls.append(record)
        self.iteration_count += 1

    def add_message(self, role: str, content: str) -> None:
        self.messages.append(
            {"role": role, "content": content, "timestamp": datetime.utcnow().isoformat()}
        )

    @property
    def has_exceeded_limit(self) -> bool:
        return self.iteration_count >= self.max_iterations
