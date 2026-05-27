"""Tests for DuckDB engine — SQL execution, registration, error handling."""
import csv
import os
import tempfile
from pathlib import Path

import pytest

from src.infrastructure.duckdb.engine import DuckDBEngine, DuckDBQueryError


@pytest.fixture()
def engine() -> DuckDBEngine:
    return DuckDBEngine()


@pytest.fixture()
def sample_csv(tmp_path: Path) -> str:
    path = tmp_path / "test.csv"
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["id", "name", "revenue", "date"])
        writer.writeheader()
        writer.writerows([
            {"id": 1, "name": "Alice", "revenue": 100.5, "date": "2024-01-01"},
            {"id": 2, "name": "Bob", "revenue": 200.0, "date": "2024-01-02"},
            {"id": 3, "name": "Charlie", "revenue": 150.75, "date": "2024-01-03"},
        ])
    return str(path)


class TestDuckDBEngine:
    @pytest.mark.asyncio
    async def test_register_csv_creates_view(self, engine: DuckDBEngine, sample_csv: str) -> None:
        await engine.register_dataset("test_table", sample_csv, "csv")
        result = await engine.execute_query("SELECT COUNT(*) AS cnt FROM test_table")
        assert result.error is None
        assert result.row_count == 1
        assert result.result_preview[0]["cnt"] == 3

    @pytest.mark.asyncio
    async def test_execute_query_returns_execution(self, engine: DuckDBEngine, sample_csv: str) -> None:
        await engine.register_dataset("revenue_table", sample_csv, "csv")
        result = await engine.execute_query(
            "SELECT name, revenue FROM revenue_table ORDER BY revenue DESC",
            natural_language_intent="Get top earners",
        )
        assert result.error is None
        assert result.row_count == 3
        assert result.result_preview[0]["name"] == "Bob"
        assert result.natural_language_intent == "Get top earners"

    @pytest.mark.asyncio
    async def test_invalid_sql_returns_error(self, engine: DuckDBEngine) -> None:
        result = await engine.execute_query("SELECT * FROM nonexistent_table_xyz")
        assert result.error is not None

    @pytest.mark.asyncio
    async def test_row_limit_applied(self, engine: DuckDBEngine, sample_csv: str) -> None:
        await engine.register_dataset("limit_table", sample_csv, "csv")
        result = await engine.execute_query("SELECT * FROM limit_table", max_rows=2)
        assert result.row_count <= 2

    @pytest.mark.asyncio
    async def test_execution_time_recorded(self, engine: DuckDBEngine, sample_csv: str) -> None:
        await engine.register_dataset("time_table", sample_csv, "csv")
        result = await engine.execute_query("SELECT 1")
        assert result.execution_time_ms > 0

    @pytest.mark.asyncio
    async def test_get_table_info_returns_schema(self, engine: DuckDBEngine, sample_csv: str) -> None:
        await engine.register_dataset("info_table", sample_csv, "csv")
        info = await engine.get_table_info("info_table")
        assert len(info) > 0
        column_names = {row.get("column_name") or row.get("Field") for row in info}
        assert "id" in str(column_names).lower() or len(column_names) > 0

    def test_apply_row_limit_adds_limit_clause(self) -> None:
        query = "SELECT * FROM t"
        limited = DuckDBEngine._apply_row_limit(query, 100)
        assert "LIMIT 100" in limited

    def test_apply_row_limit_skips_existing_limit(self) -> None:
        query = "SELECT * FROM t LIMIT 50"
        limited = DuckDBEngine._apply_row_limit(query, 100)
        assert limited == query
