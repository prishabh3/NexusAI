"""SQL generation and execution tool for the AI agent."""
from __future__ import annotations

import logging
import re
from typing import Any

from src.domain.entities.analysis import SQLExecution
from src.infrastructure.duckdb.engine import DuckDBEngine

logger = logging.getLogger(__name__)


class SQLGenerationTool:
    """Tool that allows the agent to execute SQL queries against the dataset."""

    name = "execute_sql"
    description = (
        "Execute a SQL query against the uploaded dataset using DuckDB. "
        "The dataset is available as a table named 'dataset'. "
        "Returns query results with row count and execution time. "
        "Always use LIMIT clauses for exploratory queries."
    )

    def __init__(self, engine: DuckDBEngine, table_name: str) -> None:
        self._engine = engine
        self._table_name = table_name

    async def run(
        self,
        query: str,
        intent: str | None = None,
    ) -> dict[str, Any]:
        sanitized = self._sanitize_query(query)
        execution = await self._engine.execute_query(sanitized, natural_language_intent=intent)
        return {
            "success": execution.error is None,
            "row_count": execution.row_count,
            "execution_time_ms": execution.execution_time_ms,
            "results": execution.result_preview[:50],
            "error": execution.error,
            "query": sanitized,
        }

    def _sanitize_query(self, query: str) -> str:
        dangerous_patterns = [
            r"\bDROP\b",
            r"\bTRUNCATE\b",
            r"\bDELETE\b",
            r"\bINSERT\b",
            r"\bUPDATE\b",
            r"\bCREATE\s+TABLE\b",
            r"\bALTER\b",
        ]
        normalized = query.upper()
        for pattern in dangerous_patterns:
            if re.search(pattern, normalized):
                raise ValueError(f"Mutation query not allowed: {pattern}")

        if self._table_name != "dataset" and "dataset" in query.lower():
            query = re.sub(r"\bdataset\b", self._table_name, query, flags=re.IGNORECASE)

        return query


class SchemaInspectTool:
    """Tool that exposes dataset schema metadata to the agent."""

    name = "inspect_schema"
    description = (
        "Returns the dataset schema: column names, types, null counts, and statistics. "
        "Use this as the first step before writing SQL queries."
    )

    def __init__(self, engine: DuckDBEngine, table_name: str) -> None:
        self._engine = engine
        self._table_name = table_name

    async def run(self) -> dict[str, Any]:
        schema_info = await self._engine.get_table_info(self._table_name)
        sample = await self._engine.sample_data(self._table_name, n=5)
        return {
            "schema": schema_info,
            "sample_rows": sample,
            "table_name": self._table_name,
        }


class SampleDataTool:
    """Tool to fetch sample rows for exploratory understanding."""

    name = "sample_data"
    description = (
        "Returns a random sample of rows from the dataset. "
        "Use this to understand data shape before writing analytical queries."
    )

    def __init__(self, engine: DuckDBEngine, table_name: str, default_n: int = 20) -> None:
        self._engine = engine
        self._table_name = table_name
        self._default_n = default_n

    async def run(self, n: int | None = None) -> dict[str, Any]:
        rows = await self._engine.sample_data(self._table_name, n=n or self._default_n)
        return {"rows": rows, "count": len(rows)}
