# NexusAI — Autonomous AI Data Analyst

You upload a CSV, Parquet, or JSON file. NexusAI sends it to a local language model (running on your own machine via Ollama), which writes and executes DuckDB SQL queries, invokes machine learning pipelines when relevant, and returns a structured report with key findings, anomalies, forecasts, and feature-importance charts. No data leaves your machine. No API keys required.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Architecture](#architecture)
3. [How the Pieces Fit Together](#how-the-pieces-fit-together)
4. [Quick Start](#quick-start)
5. [Feature Walkthrough](#feature-walkthrough)
6. [API Reference](#api-reference)
7. [Database Layout](#database-layout)
8. [Key Design Decisions](#key-design-decisions)
9. [Testing](#testing)
10. [Project Structure](#project-structure)
11. [Common Issues](#common-issues)

---

## Tech Stack

| Layer | Technology | What it does here |
|---|---|---|
| **Frontend** | Next.js 15 (App Router) | Page routing, server components |
| | TypeScript (strict) | All frontend code |
| | Tailwind CSS | Styling |
| | Zustand | Client state (`dataset-store`, `analysis-store`) |
| | TanStack Query | Server state, caching, cache invalidation |
| | Recharts | Forecast, feature importance, correlation charts |
| | Framer Motion | Upload drop-zone animation, step-trace expand |
| | Radix UI primitives | Accessible dialog, select, tabs, dropdown |
| **Backend** | FastAPI 0.115 | HTTP API and WebSocket server |
| | Python 3.12 | Runtime |
| | Pydantic v2 | Request/response validation, domain entities |
| | SQLAlchemy 2.0 async | ORM; `AsyncSession` per request via `Depends` |
| | Alembic | Schema migrations |
| | structlog | Structured JSON logging |
| **AI / Agents** | Ollama | Local LLM inference (`qwen2.5:14b` default) |
| | httpx | Async HTTP client that calls Ollama's `/api/chat` |
| | LangChain / LangGraph | Listed in `pyproject.toml` but agent loop is custom |
| **Analytics** | DuckDB 1.1 | In-process OLAP SQL engine; one connection per thread |
| | pandas 2.2 | Data loading and profiling |
| | pyarrow | Parquet read/write |
| **ML** | scikit-learn 1.5 | IsolationForest, LOF, DBSCAN, RandomForest, GBM |
| | XGBoost 2.1 | Primary forecasting fallback; AutoML candidate |
| | Prophet 1.1 | Time-series forecasting (optional; XGBoost fallback) |
| | SHAP 0.46 | Feature importance and model explanation |
| **Persistence** | PostgreSQL 16 + pgvector | Relational store + 768-dim insight embeddings |
| | Redis 7 | Celery broker and result backend |
| | Celery 5.4 | Background task worker (heavy ML jobs) |
| **Infrastructure** | Docker Compose | Local multi-service environment |
| | Kubernetes | Production manifests (`infra/k8s/base/`) |
| | GitHub Actions | CI: lint → test → Docker build → Trivy scan → deploy |
| | Turborepo | Monorepo task orchestration (`build`, `test`, `lint`) |
| | pnpm workspaces | JS package management across `apps/` and `packages/` |

---

## Architecture

```
Browser
  │  REST (axios)  +  WebSocket
  ▼
┌────────────────────────────────────────────────┐
│  Next.js 15  (port 3000)                       │
│  pages: overview · datasets · analysis ·       │
│         chat · insights · forecasting ·        │
│         anomalies · models · settings          │
│  stores: dataset-store  analysis-store         │
└───────────────────┬────────────────────────────┘
                    │ HTTP /api/v1/*
                    │ WS   /ws/analysis/{dataset_id}
                    ▼
┌────────────────────────────────────────────────┐
│  FastAPI  (port 8000)                          │
│                                                │
│  Presentation ──► Application ──► Domain       │
│  (routes/WS)      (use cases)     (entities)   │
│                        │              ▲         │
│                        ▼              │         │
│                  Infrastructure ──────┘         │
│           ┌──────────┬──────────┬──────────┐   │
│           │ DuckDB   │ ML       │ AI Agent │   │
│           │ engine   │ pipelines│ (Ollama) │   │
│           └──────────┴──────────┴──────────┘   │
│                        │                        │
│           ┌────────────▼───────────────────┐   │
│           │  SQLAlchemy  (AsyncSession)     │   │
│           └────────────────────────────────┘   │
└────────────────────────────────────────────────┘
          │              │              │
          ▼              ▼              ▼
   PostgreSQL        Redis          Ollama
   + pgvector     (Celery Q)    (port 11434)
```

**Dependency rule:** Arrows point inward. `Infrastructure` depends on `Domain` interfaces (ABCs). `Application` depends on `Domain`. `Presentation` depends on `Application`. `Domain` has no external imports.

---

## How the Pieces Fit Together

### Upload flow

You drag a file into the browser. The frontend sends a `multipart/form-data` POST to `POST /api/v1/datasets`. The `UploadDatasetUseCase` runs four steps in sequence:

1. **Save to disk.** `FileHandler` writes the bytes to `$STORAGE_PATH/{uuid}/{filename}` and computes a SHA-256 content hash.
2. **Profile.** `DatasetProfiler` loads the file with pandas and walks each column. For each column it infers the type (integer, float, string, boolean, datetime, unknown), computes mean/std/skewness/kurtosis/quantiles for numeric columns, top-value frequencies for categorical ones, and a null rate. A data quality score (0–1) is derived from null rates and cardinality. A correlation matrix is computed for all numeric column pairs.
3. **Register with DuckDB.** The file is registered as a SQL `VIEW` named `ds_{first 12 chars of UUID}` using `read_csv_auto`, `read_parquet`, or `read_json_auto`. This view persists in the in-memory DuckDB instance for the process lifetime.
4. **Persist.** The `Dataset` entity (including the full schema JSON) is written to PostgreSQL. The `duckdb_table` name is stored in the dataset's `metadata` column so analysis runs can look it up later.

Events are published on the internal `EventBus` at each stage: `dataset.uploaded`, `dataset.profiled`, and `dataset.failed`. The bus is an `asyncio.Queue` in-process; handlers run concurrently via `asyncio.gather`.

### Analysis flow (agentic)

You type a question in the Query page and press Send. The browser opens a WebSocket to `WS /ws/analysis/{dataset_id}` and sends `{"query": "...", "type": "eda"}`.

The `AnalysisCoordinator` receives the request and enters a loop (capped at `AGENT_MAX_ITERATIONS`, default 15):

1. Call Ollama's `/api/chat` with the system prompt, the user's question, and three tool definitions: `inspect_schema`, `execute_sql`, `sample_data`.
2. Ollama responds with either a `tool_calls` array or plain text.
3. If there are tool calls, dispatch each one. `execute_sql` goes through `SQLGenerationTool`, which first strips dangerous keywords (`DROP`, `TRUNCATE`, `DELETE`, `INSERT`, `UPDATE`, `CREATE TABLE`, `ALTER`) with a regex scan, then hands the query to `DuckDBEngine.execute_query`. The engine runs the query inside a `ThreadPoolExecutor` — DuckDB connections are not thread-safe, so the engine keeps one connection per thread keyed by `threading.get_ident()`.
4. Tool results are appended to the message list as `role: tool` messages and the loop continues.
5. When Ollama returns a response with no tool calls (or `done_reason: stop`), the loop breaks. The final assistant message becomes the summary. Lines starting with `-`, `•`, or numbered lists are extracted as `key_findings`.

Each iteration emits a `step` WebSocket event to the browser. The browser renders each step live in the agent trace panel.

The confidence score is computed from `(sql_success_rate * 0.6) + (min(iterations/5, 1.0) * 0.4)`. More successful queries and more iterations increase confidence up to a cap of 0.95.

### ML-direct flows (no agentic loop)

For `anomaly_detection`, `forecasting`, `classification`, `regression`, and `clustering` analysis types, `RunAnalysisUseCase` skips the coordinator and calls the relevant ML class directly, wrapping it in `asyncio.run_in_executor` to avoid blocking the event loop.

**Anomaly detection** runs three algorithms in parallel on the scaled numeric columns: IsolationForest (200 estimators), Local Outlier Factor (20 neighbors), and DBSCAN (eps=0.5). Each produces a 0–1 score normalized min-max. The ensemble strategy (default: `vote`) counts how many algorithms flagged each row as anomalous, divides by 3, and flags rows above the 95th percentile. Severity maps to percentile ranks: ≥p90 = critical, ≥p75 = high, ≥0.5 = medium, below = low. For each anomaly, columns more than 2 standard deviations from the mean are listed as `affected_columns`.

**Forecasting** uses Prophet with a 95% confidence interval. If Prophet is not installed, it falls back to XGBoost with ordinal date encoding plus day-of-week, month, and quarter features. Forecast points carry `is_forecast: true/false` to distinguish historical from predicted values in the chart.

**AutoML** infers problem type by counting unique values in the target column: ≤20 unique values → classification, otherwise regression. It benchmarks XGBoost, RandomForest, GradientBoosting, and Logistic/Ridge Regression using 3-fold cross-validation within a 60-second time budget. The best-metric model is selected and explained with SHAP TreeExplainer.

---

## Quick Start

### Prerequisites

| Tool | Minimum version | Check |
|---|---|---|
| Docker | 24 | `docker --version` |
| Docker Compose | 2.20 | `docker compose version` |
| Ollama | latest | not needed for Docker setup |

> **No Python or Node needed** to run with Docker Compose — the containers handle everything.

### 1. Clone and configure

```bash
git clone https://github.com/prishabh3/NexusAI.git
cd NexusAI
cp .env.example .env
```

Open `.env` and change the one required value:

```bash
# Generate a random 32-char key:
openssl rand -hex 32
# Paste the output as APP_SECRET_KEY in .env
```

Everything else in `.env` works as-is for local development.

### 2. Start all services

```bash
docker compose up -d
```

This starts six containers. Wait about 30 seconds for PostgreSQL health checks to pass:

```bash
docker compose ps   # all should show "healthy" or "running"
```

| Container | Port | What it is |
|---|---|---|
| `nexusai-api` | 8000 | FastAPI backend |
| `nexusai-web` | 3000 | Next.js frontend |
| `nexusai-postgres` | 5432 | PostgreSQL 16 + pgvector |
| `nexusai-redis` | 6379 | Redis 7 |
| `nexusai-ollama` | 11434 | Ollama LLM server |
| `nexusai-worker` | — | Celery background worker |

### 3. Pull a language model

The API cannot run analyses until Ollama has at least one model downloaded:

```bash
# Recommended — needs ~9 GB VRAM or ~16 GB RAM
docker exec nexusai-ollama ollama pull qwen2.5:14b

# Lighter alternative — needs ~5 GB VRAM or ~8 GB RAM
docker exec nexusai-ollama ollama pull qwen2.5:7b
```

The model is stored in the `ollama-models` Docker volume, so you only need to pull it once.

### 4. Open the app

[http://localhost:3000](http://localhost:3000)

API documentation (Swagger UI): [http://localhost:8000/api/docs](http://localhost:8000/api/docs)

---

### Local development (no Docker)

Run the backend and frontend directly if you want hot-reload and debugger access.

**Backend:**

```bash
cd apps/api

# Requires Python 3.12+
python -m venv .venv && source .venv/bin/activate

pip install -e ".[dev]"

# Start postgres and redis (keep Docker for infra only)
docker compose up -d postgres redis ollama

# Copy and edit env — point DATABASE_URL at localhost
cp ../../.env.example .env
# DATABASE_URL=postgresql+asyncpg://nexus:nexus@localhost:5432/nexusai
# REDIS_URL=redis://localhost:6379/0
# OLLAMA_BASE_URL=http://localhost:11434

# Run migrations (creates all tables + enables pgvector extension)
alembic upgrade head

# Start with hot reload
uvicorn src.main:app --reload --port 8000
```

**Frontend:**

```bash
cd apps/web

# Requires Node 20+ and pnpm
pnpm install
pnpm dev    # http://localhost:3000
```

---

## Feature Walkthrough

### Step 1 — Upload a dataset

Click **Datasets** in the left sidebar, then **Upload Dataset**. A dialog opens. Drag a CSV, Parquet, or JSON file onto the drop zone (max 500 MB). Give it a name and optional description. Click Upload.

The status changes from `uploading` → `processing` → `ready`. Processing takes 1–10 seconds depending on file size. When ready, the detail page shows:

- Row count, column count, file size
- Data quality score (0–100%)
- Per-column statistics: type, null rate, min/max/mean/std, top values
- Correlation matrix heatmap for numeric columns

### Step 2 — Ask a question

Click **Query** in the sidebar. Select your dataset from the dropdown at the top. Type a question in the text box, for example:

> "Which product categories have the highest revenue growth, and are there any anomalous spikes?"

Press **Send** (or `Ctrl+Enter`). A WebSocket opens and the agent starts working. You see each step arrive in real time:

- `inspect_schema` — the agent reads column names and types
- `execute_sql` — SQL queries appear with row counts and execution times
- The final summary appears in the chat area as formatted markdown

The agent trace panel (collapsible per step) shows the SQL query, row count, and execution time for each database call.

### Step 3 — Run dedicated ML analyses

For anomaly detection, forecasting, or AutoML, use the REST API directly or navigate to the dedicated pages:

- **Anomalies** — lists all anomaly detection runs; shows severity breakdown and per-row explanations
- **Forecasting** — shows forecast chart with historical data, predicted values, and confidence bands
- **Models** — shows AutoML results: winning model name, accuracy/RMSE/AUC, SHAP feature importance bar chart

To trigger them via API:

```bash
# Anomaly detection
curl -X POST http://localhost:8000/api/v1/analyses \
  -H "Content-Type: application/json" \
  -d '{
    "dataset_id": "<your-dataset-uuid>",
    "analysis_type": "anomaly_detection"
  }'

# Forecasting — requires specifying which columns to use
curl -X POST http://localhost:8000/api/v1/analyses \
  -H "Content-Type: application/json" \
  -d '{
    "dataset_id": "<your-dataset-uuid>",
    "analysis_type": "forecasting",
    "configuration": {
      "time_column": "date",
      "value_column": "revenue"
    }
  }'

# AutoML classification
curl -X POST http://localhost:8000/api/v1/analyses \
  -H "Content-Type: application/json" \
  -d '{
    "dataset_id": "<your-dataset-uuid>",
    "analysis_type": "classification",
    "configuration": {
      "target_column": "churned"
    }
  }'
```

### Step 4 — Browse insights

Click **Insights** in the sidebar. AI-generated insights from all analyses are listed here, filterable by category (anomaly, trend, correlation, forecast, recommendation, data quality, business, statistical) and severity (critical, warning, opportunity, info). Each insight shows:

- Confidence score
- Affected columns
- Business impact text
- Recommended actions
- A verify button (marks the insight as human-confirmed)

### Step 5 — Settings

Click **Settings** to check live connectivity (API, Ollama, database), change the default Ollama model, adjust the agent iteration limit, temperature, and DuckDB row limit.

---

## API Reference

Base URL: `http://localhost:8000/api/v1`
WebSocket: `ws://localhost:8000`

No authentication is required in development. Set `APP_SECRET_KEY` in production for session signing.

### Datasets

| Method | Path | Description |
|---|---|---|
| `POST` | `/datasets` | Upload a file and profile it |
| `GET` | `/datasets` | List all datasets (`limit`, `offset` params) |
| `GET` | `/datasets/search` | Search by name (`q`, `limit` params) |
| `GET` | `/datasets/{id}` | Full detail including schema and column profiles |
| `DELETE` | `/datasets/{id}` | Delete dataset and all associated data (cascade) |
| `GET` | `/datasets/{id}/versions` | List version history |

**Upload example:**

```bash
curl -X POST http://localhost:8000/api/v1/datasets \
  -F "file=@sales.csv" \
  -F "name=Q4 Sales" \
  -F "description=Regional sales data for Q4 2024" \
  -F "tags=sales,quarterly"
```

**Response:**

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "name": "Q4 Sales",
  "status": "ready",
  "row_count": 1825,
  "column_count": 9,
  "data_quality_score": 0.94,
  "analysis_count": 0,
  "tags": ["sales", "quarterly"],
  "created_at": "2025-05-27T10:30:00"
}
```

### Analyses

| Method | Path | Description |
|---|---|---|
| `POST` | `/analyses` | Start an analysis (returns 202 immediately) |
| `GET` | `/analyses/recent` | Last N analyses across all datasets (`limit` param) |
| `GET` | `/analyses/dataset/{id}` | All analyses for one dataset |
| `GET` | `/analyses/{id}` | Full detail: agent steps, SQL executions, ML results |

**POST /analyses request body:**

```json
{
  "dataset_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "analysis_type": "eda",
  "user_query": "Summarise the top revenue trends by region.",
  "configuration": {}
}
```

Valid `analysis_type` values: `eda`, `anomaly_detection`, `forecasting`, `clustering`, `classification`, `regression`, `correlation`, `custom_query`, `full_pipeline`.

**GET /analyses/{id} response (abridged):**

```json
{
  "id": "...",
  "status": "completed",
  "duration_seconds": 42.3,
  "step_count": 7,
  "agent_steps": [
    {
      "step_number": 0,
      "tool_name": "inspect_schema",
      "reasoning": "I need to understand the column types before writing SQL.",
      "sql_executions": []
    },
    {
      "step_number": 1,
      "tool_name": "execute_sql",
      "sql_executions": [{
        "query": "SELECT region, SUM(revenue) FROM ds_3fa85f64 GROUP BY region ORDER BY 2 DESC",
        "execution_time_ms": 12.4,
        "row_count": 5
      }]
    }
  ],
  "result": {
    "summary": "North region leads with $14.2M...",
    "key_findings": ["North region leads...", "Anomalous spike on 2023-12-24..."],
    "confidence_score": 0.87
  }
}
```

### Insights

| Method | Path | Description |
|---|---|---|
| `GET` | `/insights` | Recent insights across all datasets |
| `GET` | `/insights/dataset/{id}` | Insights for one dataset (`category`, `limit` params) |
| `GET` | `/insights/{id}` | Single insight |
| `POST` | `/insights/{id}/verify` | Mark an insight as human-verified |
| `GET` | `/insights/{id}/similar` | Semantically similar insights via pgvector cosine distance |

### WebSocket

**Endpoint:** `WS /ws/analysis/{dataset_id}`

Send one JSON message after connecting:

```json
{"query": "Find all revenue anomalies.", "type": "anomaly_detection"}
```

The server emits a stream of events:

| Event | Payload |
|---|---|
| `started` | `{"dataset_id": "..."}` |
| `step` | `{"step_number": 0, "tool": "inspect_schema", "reasoning": "...", "sql_count": 0, "duration_ms": 180}` |
| `completed` | `{"analysis_id": "...", "summary": "...", "finding_count": 5, "step_count": 7, "duration_seconds": 38.1}` |
| `error` | `{"message": "..."}` |

### Health

```bash
GET /health
# → {"status": "healthy", "version": "0.1.0", "env": "development"}
```

---

## Database Layout

One PostgreSQL database (`nexusai`) with five tables. The `pgvector` extension is installed automatically by `infra/docker/postgres/init.sql` when the container first starts.

### `datasets`

Stores one row per uploaded file.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `name` | varchar(255) | User-provided, indexed |
| `description` | text | Nullable |
| `original_filename` | varchar(500) | |
| `file_path` | varchar(1000) | Absolute path on the API container |
| `file_format` | varchar(20) | `csv`, `parquet`, `json`, `jsonl` |
| `status` | varchar(50) | `uploading` → `processing` → `ready` / `failed` / `archived` |
| `schema_data` | jsonb | Full `DatasetSchema` — column profiles, correlation matrix, quality score |
| `current_version` | int | Increments on re-upload |
| `tags` | jsonb | `string[]` |
| `metadata` | jsonb | Includes `duckdb_table` key after profiling |
| `analysis_count` | int | Incremented after each completed analysis |

### `dataset_versions`

One row per file version. Has a unique constraint on `(dataset_id, version_number)`.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `dataset_id` | UUID FK → datasets | Cascade delete |
| `version_number` | int | |
| `file_path` | varchar(1000) | |
| `schema_snapshot` | jsonb | Schema at time of upload |
| `row_count` | bigint | |
| `size_bytes` | bigint | |
| `notes` | text | |

### `analyses`

One row per analysis run.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `dataset_id` | UUID FK → datasets | Cascade delete |
| `analysis_type` | varchar(50) | Indexed |
| `status` | varchar(50) | `queued` → `running` → `completed` / `failed` / `cancelled` |
| `user_query` | text | The natural-language question, if any |
| `configuration` | jsonb | `time_column`, `value_column`, `target_column`, etc. |
| `agent_steps` | jsonb | Array of `AgentStep` objects including SQL executions |
| `result` | jsonb | `AnalysisResult` — summary, key_findings, ml_results |
| `error_message` | text | Populated on failure |
| `duration_seconds` | float | `completed_at - started_at` |
| `prompt_tokens_used` | int | |
| `completion_tokens_used` | int | |

### `agent_runs`

One row per agent invocation within an analysis. Used for debugging and token accounting.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `analysis_id` | UUID FK → analyses | Cascade delete |
| `agent_type` | varchar(50) | `coordinator`, `eda`, `sql`, etc. |
| `status` | varchar(50) | |
| `system_prompt` | text | Exact prompt sent to Ollama |
| `messages` | jsonb | Full message history |
| `tool_calls` | jsonb | All tool calls made |
| `final_output` | text | Last assistant message |
| `iteration_count` | int | How many loop iterations ran |
| `model_name` | varchar(100) | Which Ollama model was used |

### `insights`

One row per AI-generated or human-verified finding.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `dataset_id` | UUID FK → datasets | Cascade delete |
| `analysis_id` | UUID FK → analyses | Nullable; SET NULL on analysis delete |
| `title` | varchar(500) | |
| `body` | text | Full explanation |
| `category` | varchar(50) | `anomaly`, `trend`, `correlation`, `forecast`, `recommendation`, `data_quality`, `business`, `statistical` |
| `severity` | varchar(50) | `critical`, `warning`, `opportunity`, `info` |
| `confidence_score` | float | 0.0–1.0 |
| `evidence` | jsonb | Array of evidence items |
| `affected_columns` | jsonb | Column name list |
| `recommended_actions` | jsonb | String array |
| `embedding` | vector(768) | For cosine-distance similarity search via pgvector |
| `is_verified` | boolean | Human-verified flag |

**Similarity search query** (used by `GET /insights/{id}/similar`):

```sql
SELECT id, 1 - (embedding <=> :query_embedding) AS similarity
FROM insights
WHERE embedding IS NOT NULL
  AND 1 - (embedding <=> :query_embedding) >= 0.75
ORDER BY embedding <=> :query_embedding
LIMIT 10
```

---

## Key Design Decisions

### Clean Architecture dependency rule

The codebase is split into four layers: Domain, Application, Infrastructure, Presentation. Imports only go inward — Infrastructure depends on Domain interfaces (ABCs), never the reverse. This means you can swap out the database, the ML library, or the LLM backend without touching domain logic.

Domain entities (`Dataset`, `Analysis`, `Insight`) are plain Pydantic models. They have no SQLAlchemy imports. Persistence is handled by `SqlAlchemy*Repository` classes in Infrastructure that implement the domain `*Repository` ABCs.

### DuckDB thread-safety

DuckDB connections are not safe to share across threads. The `DuckDBEngine` keeps a `dict[thread_id → connection]` and creates a new connection on first use in each thread. A `ThreadPoolExecutor(max_workers=4)` handles all blocking DuckDB calls. Async callers use `asyncio.run_in_executor` to submit work to that pool without blocking FastAPI's event loop.

Every SELECT query automatically gets `LIMIT 10000` appended by `_apply_row_limit` if no LIMIT clause is present, preventing accidental full-table scans that would exhaust memory.

### Agentic loop with a hard iteration cap

The coordinator loop runs up to `AGENT_MAX_ITERATIONS` (default 15) turns. This prevents infinite loops when the model keeps calling tools without reaching a conclusion. If the agent hits the cap, the last assistant message is used as the summary regardless.

Temperature is set to 0.1 for all SQL generation calls. Lower temperature means the model picks the most likely next token, which produces more deterministic SQL rather than creative but incorrect queries.

### SQL mutation guard

Before any agent-generated SQL reaches DuckDB, `SQLGenerationTool._sanitize_query` scans the normalized (uppercased) query with seven regex patterns: `DROP`, `TRUNCATE`, `DELETE`, `INSERT`, `UPDATE`, `CREATE TABLE`, `ALTER`. A match raises a `ValueError` that becomes a tool error, not a crash.

### Anomaly detection ensemble voting

Running three algorithms and taking the majority vote reduces false positives that any single algorithm would produce on its own:
- **IsolationForest** catches global outliers (points far from the data cloud)
- **LOF** catches local outliers (points that are dense relative to neighbors in a different region)
- **DBSCAN** marks noise points — rows that don't fit any cluster with at least `min_samples=5` neighbors within `eps=0.5`

A row is flagged as anomalous when at least 2 of 3 algorithms agree (vote threshold: combined score > 0.5 after normalization).

### Event bus designed for scale-out

`EventBus` is backed by an `asyncio.Queue` and dispatches handlers with `asyncio.gather`. Swapping to Kafka or Redis Streams requires changing only `publish` and `_dispatch_loop` — all call sites use `event_bus.publish(DomainEvent(...))` unchanged.

### pgvector for insight deduplication and discovery

Each insight gets a 768-dimensional embedding (model: `nomic-embed-text` via Ollama). The `GET /insights/{id}/similar` endpoint uses the `<=>` (cosine distance) operator to find insights with ≥0.75 similarity. This surfaces related findings from previous analyses without running the analysis again.

### Forecasting fallback chain

Prophet is declared as an optional dependency. If it is not installed (`ImportError`), `ProphetForecaster.fit_predict` automatically falls back to an XGBoost model trained on ordinal date + day-of-week + month + quarter features. The API response shape is identical either way, so the frontend chart does not need to know which model ran.

---

## Testing

### Backend

```bash
cd apps/api
pip install -e ".[dev]"

# Unit tests (no database required — uses sqlite+aiosqlite in memory)
pytest tests/unit -v

# Integration tests (requires running postgres on port 5432)
docker compose up -d postgres
pytest tests/integration -v

# Coverage report
pytest tests/unit --cov=src --cov-report=term-missing
```

**What the tests cover:**

| Test file | What it tests |
|---|---|
| `tests/unit/domain/test_dataset_profiler.py` | `DatasetProfiler` — type inference, null counts, mean/std, top values, quality score, primary key inference |
| `tests/unit/domain/test_entities.py` | `Dataset` and `Analysis` state machine methods (`mark_ready`, `start`, `complete`, `fail`) |
| `tests/unit/infrastructure/test_duckdb_engine.py` | CSV registration, query execution, row limit enforcement, error handling |
| `tests/unit/infrastructure/test_anomaly_detector.py` | Injected outliers are detected, scores are normalized, severity levels are correct |
| `tests/unit/infrastructure/test_automl.py` | Problem type inference, model training, metric computation |
| `tests/integration/test_api_datasets.py` | Full upload-profile-retrieve cycle against a real (in-memory SQLite) database |

Unit tests use SQLite in-memory via `sqlite+aiosqlite:///:memory:` so they run without Docker. The conftest creates all tables with `Base.metadata.create_all`, runs each test in a rolled-back transaction, and disposes the engine at session end.

### Frontend

```bash
cd apps/web
pnpm install

# Unit and component tests (Vitest + RTL)
pnpm test

# With coverage
pnpm test -- --coverage

# End-to-end (requires running app at localhost:3000)
pnpm e2e
```

**What the tests cover:**

| Test file | What it tests |
|---|---|
| `src/__tests__/utils.test.ts` | All utility functions: `formatBytes`, `formatNumber`, `formatPercent`, `formatDuration`, `truncate`, `cn` Tailwind deduplication |
| `src/__tests__/kpi-card.test.tsx` | KPI card renders title, value, trend indicator |
| `tests/e2e/dataset-workflow.spec.ts` | Playwright: upload a CSV, wait for ready status, open detail view, verify column count |

---

## Project Structure

```
NexusAI/
├── apps/
│   ├── api/                             # FastAPI backend
│   │   ├── src/
│   │   │   ├── domain/
│   │   │   │   ├── entities/
│   │   │   │   │   ├── dataset.py       # Dataset, DatasetSchema, ColumnProfile, DatasetVersion
│   │   │   │   │   ├── analysis.py      # Analysis, AgentStep, MLResult, ForecastPoint, AnomalyRecord
│   │   │   │   │   ├── insight.py       # Insight, InsightCategory, InsightSeverity
│   │   │   │   │   └── agent_run.py     # AgentRun, ToolCallRecord
│   │   │   │   ├── repositories/        # ABCs only — no I/O
│   │   │   │   │   ├── dataset_repository.py
│   │   │   │   │   ├── analysis_repository.py
│   │   │   │   │   └── insight_repository.py
│   │   │   │   └── services/
│   │   │   │       └── dataset_profiler.py  # Pure Python — no I/O, fully testable
│   │   │   ├── application/
│   │   │   │   └── use_cases/
│   │   │   │       ├── upload_dataset.py    # File save → profile → DuckDB register → publish events
│   │   │   │       └── run_analysis.py      # Dispatch to coordinator or ML pipeline
│   │   │   ├── infrastructure/
│   │   │   │   ├── ai/
│   │   │   │   │   ├── agents/coordinator.py    # OllamaClient + AnalysisCoordinator loop
│   │   │   │   │   ├── tools/sql_tool.py        # execute_sql, inspect_schema, sample_data tools
│   │   │   │   │   └── prompts/system_prompts.py
│   │   │   │   ├── duckdb/engine.py             # Thread-per-connection DuckDB wrapper
│   │   │   │   ├── ml/
│   │   │   │   │   ├── anomaly/detector.py      # IsolationForest + LOF + DBSCAN ensemble
│   │   │   │   │   ├── forecasting/prophet_forecaster.py  # Prophet + XGBoost fallback
│   │   │   │   │   └── automl/pipeline.py       # Problem inference + model benchmarking + SHAP
│   │   │   │   ├── database/
│   │   │   │   │   ├── models.py                # SQLAlchemy ORM models
│   │   │   │   │   ├── base.py                  # async engine + Base declarative
│   │   │   │   │   └── repositories/            # Concrete repo implementations
│   │   │   │   ├── events/bus.py                # asyncio.Queue pub/sub event bus
│   │   │   │   ├── storage/file_handler.py      # Async file save + SHA-256 hash
│   │   │   │   └── config.py                    # pydantic-settings; lru_cache singleton
│   │   │   └── presentation/
│   │   │       ├── api/v1/
│   │   │       │   ├── datasets.py              # CRUD + search + versions endpoints
│   │   │       │   ├── analyses.py              # Run + retrieve + recent endpoints
│   │   │       │   └── insights.py              # List + verify + similar endpoints
│   │   │       ├── websocket/analysis_stream.py # WS /ws/analysis/{dataset_id}
│   │   │       └── dependencies.py              # FastAPI Depends factories
│   │   ├── alembic/                             # DB migration scripts
│   │   ├── tests/
│   │   │   ├── conftest.py                      # SQLite in-memory fixtures
│   │   │   ├── unit/                            # Domain + infrastructure unit tests
│   │   │   └── integration/                     # API endpoint tests
│   │   ├── Dockerfile                           # Multi-stage: development / builder / production
│   │   └── pyproject.toml                       # Dependencies, ruff, mypy, pytest config
│   │
│   └── web/                                     # Next.js 15 frontend
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx                   # Root layout, font, ThemeProvider
│       │   │   └── (dashboard)/                 # All authenticated pages share sidebar + topbar
│       │   │       ├── page.tsx                 # Overview — KPI cards, recent analyses
│       │   │       ├── datasets/                # Dataset list + detail pages
│       │   │       ├── chat/                    # Agent chat + WebSocket
│       │   │       ├── analysis/                # Analysis list + [id] detail
│       │   │       ├── insights/                # Insights grid with filters
│       │   │       ├── forecasting/             # Forecast chart + metrics
│       │   │       ├── anomalies/               # Anomaly timeline + severity breakdown
│       │   │       ├── models/                  # AutoML results + SHAP chart
│       │   │       └── settings/                # System status + model config
│       │   ├── features/                        # Feature-sliced components
│       │   │   ├── upload/                      # DatasetUploader, SchemaTable, DatasetListView
│       │   │   ├── chat/                        # AgentChat, AgentStepTrace, SQLResultTable
│       │   │   ├── analysis/                    # CorrelationHeatmap, FeatureImportanceChart
│       │   │   ├── anomaly/                     # AnomalyTimeline
│       │   │   ├── forecasting/                 # ForecastChart (Recharts AreaChart)
│       │   │   ├── insights/                    # InsightCard, InsightsView
│       │   │   └── settings/                    # SettingsView
│       │   ├── components/
│       │   │   ├── layout/                      # Sidebar, TopBar, PageHeader
│       │   │   ├── dashboard/                   # KpiCard, ActivityTimeline
│       │   │   └── ui/                          # Button, Badge, Dialog, Input, Select, Tabs...
│       │   ├── stores/
│       │   │   ├── dataset-store.ts             # selectedDatasetId, isUploadDialogOpen
│       │   │   └── analysis-store.ts            # liveSteps, isAnalysisRunning, wsConnected
│       │   ├── lib/
│       │   │   ├── api/
│       │   │   │   ├── client.ts                # axios instance with base URL + error interceptor
│       │   │   │   ├── datasets.ts              # datasetsApi (re-exports analysesApi, insightsApi)
│       │   │   │   ├── analyses.ts              # analysesApi — getById, getByDataset, getRecent
│       │   │   │   ├── insights.ts              # insightsApi — getByDataset, getRecent, verify
│       │   │   │   └── system.ts                # systemApi — health check
│       │   │   └── utils.ts                     # cn(), formatBytes, formatNumber, formatDuration
│       │   └── types/dataset.ts                 # TypeScript types mirroring all Pydantic models
│       ├── tailwind.config.ts                   # Enterprise palette, severity colors, shadow tokens
│       └── vitest.config.ts
│
├── packages/                                    # Shared packages (reserved for future use)
├── data/
│   └── samples/
│       ├── generate_samples.py                  # Generates 4 demo CSVs
│       ├── ecommerce_sales.csv                  # 1825 rows — trend + seasonality + anomalies
│       ├── customer_churn.csv                   # 2000 rows — binary classification target
│       ├── financial_transactions.csv           # 5000 rows — 1.5% fraud rate
│       └── inventory_management.csv             # 9000 rows — stockout anomalies
├── docs/
│   ├── adr/                                     # Architecture Decision Records
│   │   ├── 001-clean-architecture.md
│   │   ├── 002-duckdb-analytical-engine.md
│   │   └── 003-local-llm-ollama.md
│   └── developer-handbook.md                   # In-depth contributor guide
├── infra/
│   ├── docker/postgres/init.sql                 # Enables pgvector, uuid-ossp, pg_trgm
│   └── k8s/base/                                # Kubernetes: namespace, deployments, ingress
├── tests/e2e/
│   ├── playwright.config.ts
│   └── dataset-workflow.spec.ts
├── .github/workflows/
│   ├── ci.yml                                   # Lint → test → build → security scan
│   └── deploy.yml                               # kubectl rollout on merge to main
├── docker-compose.yml
├── .env.example
├── turbo.json                                   # Turborepo pipeline: build, dev, test, lint
└── pnpm-workspace.yaml                          # pnpm workspace root
```

---

## Common Issues

### "Analysis failed: Dataset {id} is not ready"

The dataset is still in `processing` status. Either:
- The profiling is still running — wait a few seconds and retry.
- Profiling failed — check the API logs: `docker compose logs api`. The most common cause is a malformed CSV (wrong encoding, mixed delimiter). Try re-uploading with UTF-8 encoding and comma delimiters.

```bash
docker compose logs api --tail=50
```

### Ollama returns 404 or connection refused

```bash
# Check Ollama is running
curl http://localhost:11434/api/tags

# If nothing is returned, the container may not have started
docker compose ps nexusai-ollama

# Check which models are available
docker exec nexusai-ollama ollama list
```

If the model list is empty, pull a model (see Quick Start step 3). The API logs will show `Model 'qwen2.5:14b' not found` if the requested model was never pulled.

### DuckDB "Table not found" error in analysis

DuckDB views are stored in-memory per process. If the API container was restarted after datasets were uploaded, the views no longer exist. Re-register them by calling:

```bash
# Trigger a re-upload of the file, OR:
# Manually re-register via the upload endpoint using the same file
```

A permanent fix for production is to use a persistent DuckDB database file (`DUCKDB_PATH=/app/data/nexus.duckdb`) and re-register views at startup by querying `datasets` where `status = 'ready'`. This is not yet implemented.

### pgvector extension missing

```
sqlalchemy.exc.ProgrammingError: (psycopg2.errors.UndefinedFunction) operator does not exist: vector <=> vector
```

The `init.sql` creates the extension on first container start, but only if the volume is new. If you started with an existing postgres volume, run:

```bash
docker exec -it nexusai-postgres psql -U nexus -d nexusai -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### WebSocket disconnects immediately

The frontend WebSocket URL is set at build time via `NEXT_PUBLIC_WS_URL`. If you changed the API port, rebuild the frontend container:

```bash
docker compose build web
docker compose up -d web
```

Also check CORS — `APP_CORS_ORIGINS` in `.env` must include the frontend origin (`http://localhost:3000` by default).

### "Prophet not installed" warning in logs

Prophet has a complex install (depends on PyStan which requires a C++ compiler). The forecaster automatically falls back to XGBoost when Prophet is unavailable, so analyses still work. To install Prophet in the API container:

```bash
docker exec -it nexusai-api pip install prophet
```

Or add it to the `Dockerfile` build stage.

### Frontend TypeScript errors after pulling

```bash
cd apps/web
pnpm install          # install any new dependencies
pnpm typecheck        # run tsc --noEmit to see errors
```

If the backend added new fields to the API response, update `src/types/dataset.ts` to match.
