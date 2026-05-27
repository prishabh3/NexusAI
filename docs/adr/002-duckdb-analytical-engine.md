# ADR-002: DuckDB as Primary Analytical Engine

**Status:** Accepted  
**Date:** 2025-05-27

## Context

The platform needs to execute arbitrary SQL queries against user-uploaded datasets (CSV, Parquet, JSON) with low latency. Options considered:
1. Load data into PostgreSQL
2. Use pandas + SQLite
3. Use DuckDB (embedded)
4. Use Apache Spark

## Decision

DuckDB as the primary analytical engine, server-side initially with DuckDB-WASM as a future browser path.

## Rationale

- **Zero-copy Parquet reads** — DuckDB reads parquet files directly without loading into memory
- **Columnar execution** — 10-100x faster than row-oriented SQLite for aggregations
- **SQL-complete** — Window functions, CTEs, CORR(), PERCENTILE_CONT(), etc.
- **Embedded** — No separate service, no network latency, runs in-process
- **Python-native** — `duckdb` package integrates cleanly with pandas/numpy
- **WASM available** — `@duckdb/duckdb-wasm` enables client-side analytics

## Thread Safety

DuckDB connections are not thread-safe. We use a `ThreadPoolExecutor` with one connection per thread, avoiding the need for connection pooling infrastructure.

## Consequences

- Dataset files must be accessible to the API process (handled by shared volume)
- Very large files (>2GB) may exhaust server memory — mitigated by streaming queries and LIMIT enforcement
- DuckDB-WASM adds significant bundle size to frontend (~3MB)
