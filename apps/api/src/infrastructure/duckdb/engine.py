"""DuckDB analytical engine — thread-safe, connection-pooled query executor."""

from __future__ import annotations

import asyncio
import logging
import re
import time
import uuid
from collections.abc import Generator
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from pathlib import Path
from typing import Any

import duckdb

from src.domain.entities.analysis import SQLExecution

logger = logging.getLogger(__name__)

# DuckDB connections are not thread-safe; we use a dedicated thread pool
# with one connection per worker to avoid contention.
_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="duckdb-worker")


class DuckDBQueryError(Exception):
    pass


class DuckDBEngine:
    """Manages DuckDB connections and query execution for analytical workloads."""

    def __init__(self, db_path: str = ":memory:") -> None:
        self._db_path = db_path
        self._connections: dict[int, duckdb.DuckDBPyConnection] = {}

    def _get_connection(self) -> duckdb.DuckDBPyConnection:
        import threading

        tid = threading.get_ident()
        if tid not in self._connections:
            conn = duckdb.connect(self._db_path)
            conn.execute("SET threads = 4")
            conn.execute("SET memory_limit = '2GB'")
            conn.execute("INSTALL httpfs; LOAD httpfs;")
            conn.execute("INSTALL parquet; LOAD parquet;")
            conn.execute("INSTALL json; LOAD json;")
            self._connections[tid] = conn
            logger.debug("Created DuckDB connection for thread %s", tid)
        return self._connections[tid]

    @contextmanager
    def _connection(self) -> Generator[duckdb.DuckDBPyConnection, None, None]:
        conn = self._get_connection()
        try:
            yield conn
        except duckdb.Error as exc:
            raise DuckDBQueryError(str(exc)) from exc

    def _register_file_sync(self, table_name: str, file_path: str, file_format: str) -> None:
        with self._connection() as conn:
            path = Path(file_path)
            if not path.exists():
                raise FileNotFoundError(f"Dataset file not found: {file_path}")

            if file_format == "csv":
                conn.execute(
                    f"CREATE OR REPLACE VIEW {table_name} AS "
                    f"SELECT * FROM read_csv_auto('{file_path}', header=true, all_varchar=false)"
                )
            elif file_format == "parquet":
                conn.execute(
                    f"CREATE OR REPLACE VIEW {table_name} AS "
                    f"SELECT * FROM read_parquet('{file_path}')"
                )
            elif file_format in ("json", "jsonl"):
                conn.execute(
                    f"CREATE OR REPLACE VIEW {table_name} AS "
                    f"SELECT * FROM read_json_auto('{file_path}')"
                )
            else:
                raise DuckDBQueryError(f"Unsupported format: {file_format}")

    def _execute_sync(self, query: str) -> tuple[list[dict[str, Any]], str | None]:
        with self._connection() as conn:
            result = conn.execute(query).fetchdf()
            return result.to_dict(orient="records"), None

    def _explain_sync(self, query: str) -> str:
        with self._connection() as conn:
            result = conn.execute(f"EXPLAIN {query}").fetchall()
            return "\n".join(str(row) for row in result)

    async def register_dataset(self, table_name: str, file_path: str, file_format: str) -> None:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            _executor,
            self._register_file_sync,
            table_name,
            file_path,
            file_format,
        )
        logger.info("Registered dataset '%s' as table '%s'", file_path, table_name)

    async def execute_query(
        self,
        query: str,
        natural_language_intent: str | None = None,
        max_rows: int = 10_000,
    ) -> SQLExecution:
        start = time.perf_counter()
        limited_query = self._apply_row_limit(query, max_rows)

        loop = asyncio.get_event_loop()
        try:
            records, _error = await loop.run_in_executor(
                _executor, self._execute_sync, limited_query
            )
            duration_ms = (time.perf_counter() - start) * 1000

            plan: str | None = None
            try:
                plan = await loop.run_in_executor(_executor, self._explain_sync, limited_query)
            except Exception:
                pass

            return SQLExecution(
                id=uuid.uuid4(),
                query=query,
                natural_language_intent=natural_language_intent,
                execution_time_ms=round(duration_ms, 2),
                row_count=len(records),
                result_preview=records[:100],
                execution_plan=plan,
                error=None,
            )
        except DuckDBQueryError as exc:
            duration_ms = (time.perf_counter() - start) * 1000
            logger.warning("DuckDB query failed: %s | Query: %s", exc, query[:200])
            return SQLExecution(
                id=uuid.uuid4(),
                query=query,
                natural_language_intent=natural_language_intent,
                execution_time_ms=round(duration_ms, 2),
                row_count=0,
                error=str(exc),
            )

    async def get_table_info(self, table_name: str) -> list[dict[str, Any]]:
        result = await self.execute_query(f"DESCRIBE {table_name}")
        return result.result_preview

    async def sample_data(self, table_name: str, n: int = 100) -> list[dict[str, Any]]:
        result = await self.execute_query(f"SELECT * FROM {table_name} USING SAMPLE {n} ROWS")
        return result.result_preview

    async def get_column_stats(self, table_name: str, column: str) -> dict[str, Any]:
        result = await self.execute_query(f"""
            SELECT
                COUNT(*) AS total,
                COUNT({column}) AS non_null,
                COUNT(*) - COUNT({column}) AS nulls,
                COUNT(DISTINCT {column}) AS unique_vals,
                MIN({column}) AS min_val,
                MAX({column}) AS max_val,
                AVG(TRY_CAST({column} AS DOUBLE)) AS mean_val,
                STDDEV(TRY_CAST({column} AS DOUBLE)) AS std_val
            FROM {table_name}
        """)
        return result.result_preview[0] if result.result_preview else {}

    @staticmethod
    def _apply_row_limit(query: str, max_rows: int) -> str:
        normalized = query.strip().rstrip(";").upper()
        if not re.search(r"\bLIMIT\b", normalized) and normalized.startswith("SELECT"):
            return f"{query.strip().rstrip(';')} LIMIT {max_rows}"
        return query

    def close(self) -> None:
        for conn in self._connections.values():
            try:
                conn.close()
            except Exception:
                pass
        self._connections.clear()
