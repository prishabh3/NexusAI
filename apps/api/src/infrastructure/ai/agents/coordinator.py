"""Coordinator agent — orchestrates the multi-agent analytical workflow."""
from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from typing import Any, AsyncGenerator

import httpx

from src.domain.entities.agent_run import AgentRun, AgentRunStatus, AgentType, ToolCallRecord
from src.domain.entities.analysis import AgentStep, Analysis, AnalysisResult, SQLExecution
from src.infrastructure.ai.prompts.system_prompts import (
    COORDINATOR_SYSTEM_PROMPT,
    EDA_SYSTEM_PROMPT,
    SQL_SYSTEM_PROMPT,
)
from src.infrastructure.ai.tools.sql_tool import SampleDataTool, SchemaInspectTool, SQLGenerationTool
from src.infrastructure.config import settings
from src.infrastructure.duckdb.engine import DuckDBEngine

logger = logging.getLogger(__name__)


class OllamaClient:
    """Async Ollama client with streaming and tool call support."""

    def __init__(self, base_url: str, model: str) -> None:
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._client = httpx.AsyncClient(timeout=httpx.Timeout(300.0))

    async def chat(
        self,
        messages: list[dict[str, str]],
        tools: list[dict[str, Any]] | None = None,
        temperature: float = 0.1,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "model": self._model,
            "messages": messages,
            "stream": False,
            "options": {"temperature": temperature, "num_ctx": 8192},
        }
        if tools:
            payload["tools"] = tools

        response = await self._client.post(f"{self._base_url}/api/chat", json=payload)
        response.raise_for_status()
        return response.json()

    async def stream_chat(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.1,
    ) -> AsyncGenerator[str, None]:
        payload = {
            "model": self._model,
            "messages": messages,
            "stream": True,
            "options": {"temperature": temperature, "num_ctx": 8192},
        }
        async with self._client.stream("POST", f"{self._base_url}/api/chat", json=payload) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if line:
                    chunk = json.loads(line)
                    if content := chunk.get("message", {}).get("content", ""):
                        yield content

    async def close(self) -> None:
        await self._client.aclose()


class AnalysisCoordinator:
    """
    Multi-agent coordinator that orchestrates EDA, SQL, Forecast, Anomaly,
    Insight, and Visualization sub-agents.

    Each agent runs in a deterministic state machine:
      PENDING → RUNNING → tool calls → COMPLETED / FAILED
    """

    MAX_ITERATIONS = settings.agent_max_iterations

    def __init__(
        self,
        engine: DuckDBEngine,
        table_name: str,
        model: str = settings.ollama_default_model,
    ) -> None:
        self._engine = engine
        self._table_name = table_name
        self._ollama = OllamaClient(settings.ollama_base_url, model)
        self._tools = self._build_tools()
        self._step_counter = 0

    def _build_tools(self) -> dict[str, Any]:
        schema_tool = SchemaInspectTool(self._engine, self._table_name)
        sql_tool = SQLGenerationTool(self._engine, self._table_name)
        sample_tool = SampleDataTool(self._engine, self._table_name)
        return {
            schema_tool.name: schema_tool,
            sql_tool.name: sql_tool,
            sample_tool.name: sample_tool,
        }

    def _tool_definitions(self) -> list[dict[str, Any]]:
        return [
            {
                "type": "function",
                "function": {
                    "name": "inspect_schema",
                    "description": SchemaInspectTool.description,
                    "parameters": {"type": "object", "properties": {}, "required": []},
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "execute_sql",
                    "description": SQLGenerationTool.description,
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {"type": "string", "description": "DuckDB SQL query to execute"},
                            "intent": {"type": "string", "description": "Natural language description of what this query investigates"},
                        },
                        "required": ["query"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "sample_data",
                    "description": SampleDataTool.description,
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "n": {"type": "integer", "description": "Number of sample rows (default 20)"},
                        },
                        "required": [],
                    },
                },
            },
        ]

    async def _dispatch_tool(self, tool_name: str, tool_input: dict[str, Any]) -> str:
        tool = self._tools.get(tool_name)
        if not tool:
            return f"Error: unknown tool '{tool_name}'"
        try:
            result = await tool.run(**tool_input)
            return json.dumps(result, default=str, indent=2)
        except Exception as exc:
            logger.warning("Tool '%s' failed: %s", tool_name, exc)
            return json.dumps({"error": str(exc)})

    async def run_analysis(
        self,
        analysis: Analysis,
        on_step: Any | None = None,
    ) -> AnalysisResult:
        system_msg = COORDINATOR_SYSTEM_PROMPT.format(table_name=self._table_name)
        user_query = analysis.user_query or "Perform comprehensive exploratory data analysis on this dataset."

        messages: list[dict[str, Any]] = [
            {"role": "system", "content": system_msg},
            {"role": "user", "content": user_query},
        ]

        sql_executions: list[SQLExecution] = []
        agent_steps: list[AgentStep] = []
        iterations = 0

        while iterations < self.MAX_ITERATIONS:
            iterations += 1
            t_start = time.perf_counter()

            try:
                response = await self._ollama.chat(
                    messages=messages,
                    tools=self._tool_definitions(),
                    temperature=0.1,
                )
            except httpx.HTTPError as exc:
                logger.error("Ollama request failed: %s", exc)
                break

            message = response.get("message", {})
            content = message.get("content", "")
            tool_calls = message.get("tool_calls", [])

            messages.append({"role": "assistant", "content": content or ""})
            duration_ms = (time.perf_counter() - t_start) * 1000

            step_sql: list[SQLExecution] = []

            if tool_calls:
                for call in tool_calls:
                    fn = call.get("function", {})
                    tool_name = fn.get("name", "")
                    raw_args = fn.get("arguments", {})
                    tool_input = raw_args if isinstance(raw_args, dict) else json.loads(raw_args)

                    t_tool = time.perf_counter()
                    tool_output = await self._dispatch_tool(tool_name, tool_input)
                    tool_duration = (time.perf_counter() - t_tool) * 1000

                    messages.append({
                        "role": "tool",
                        "content": tool_output,
                        "name": tool_name,
                    })

                    if tool_name == "execute_sql":
                        output_data = json.loads(tool_output)
                        sql_exec = SQLExecution(
                            query=tool_input.get("query", ""),
                            natural_language_intent=tool_input.get("intent"),
                            execution_time_ms=output_data.get("execution_time_ms", 0),
                            row_count=output_data.get("row_count", 0),
                            result_preview=output_data.get("results", []),
                            error=output_data.get("error"),
                        )
                        sql_executions.append(sql_exec)
                        step_sql.append(sql_exec)

                    step = AgentStep(
                        step_number=self._step_counter,
                        agent_name="coordinator",
                        action="tool_call",
                        tool_name=tool_name,
                        tool_input=tool_input,
                        tool_output=tool_output[:2000],
                        reasoning=content,
                        sql_executions=step_sql,
                        duration_ms=round(duration_ms, 2),
                    )
                    self._step_counter += 1
                    agent_steps.append(step)
                    analysis.add_agent_step(step)

                    if on_step:
                        await on_step(step)
            else:
                # No more tool calls — agent has reached a conclusion
                logger.info("Agent completed analysis after %d iterations", iterations)
                break

            if response.get("done_reason") == "stop":
                break

        final_text = self._extract_final_response(messages)
        key_findings = self._extract_key_findings(final_text)
        confidence = self._estimate_confidence(sql_executions, iterations)

        return AnalysisResult(
            summary=final_text,
            key_findings=key_findings,
            sql_executions=sql_executions,
            confidence_score=confidence,
            evidence_references=[f"SQL query #{i+1}" for i in range(len(sql_executions))],
        )

    @staticmethod
    def _extract_final_response(messages: list[dict[str, Any]]) -> str:
        for msg in reversed(messages):
            if msg.get("role") == "assistant" and msg.get("content"):
                return msg["content"]
        return "Analysis complete."

    @staticmethod
    def _extract_key_findings(text: str) -> list[str]:
        lines = text.split("\n")
        findings = []
        for line in lines:
            stripped = line.strip()
            if stripped.startswith(("- ", "• ", "* ", "1.", "2.", "3.")):
                clean = stripped.lstrip("-•*0123456789. ").strip()
                if len(clean) > 20:
                    findings.append(clean)
        return findings[:10]

    @staticmethod
    def _estimate_confidence(executions: list[SQLExecution], iterations: int) -> float:
        if not executions:
            return 0.3
        successful = sum(1 for e in executions if e.error is None)
        success_rate = successful / len(executions)
        iteration_factor = min(1.0, iterations / 5)
        return round(min(0.95, success_rate * 0.6 + iteration_factor * 0.4), 2)
