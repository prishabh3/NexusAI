# NexusAI Developer Handbook

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Project Structure](#project-structure)
3. [Development Setup](#development-setup)
4. [Backend Development](#backend-development)
5. [Frontend Development](#frontend-development)
6. [AI Agent System](#ai-agent-system)
7. [Testing Strategy](#testing-strategy)
8. [Database & Migrations](#database--migrations)
9. [Deployment](#deployment)
10. [Coding Standards](#coding-standards)
11. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

NexusAI follows **Clean Architecture** with strict dependency inversion:

```
Presentation  →  Application  →  Domain
                                    ↑
                           Infrastructure
```

- **Domain** (`src/domain/`) — Pure Python. Entities, value objects, repository interfaces, domain services. Zero I/O dependencies.
- **Application** (`src/application/`) — Use cases orchestrate domain and infrastructure. One public method per use case class.
- **Infrastructure** (`src/infrastructure/`) — DuckDB engine, ML pipelines, Ollama client, SQLAlchemy models, event bus.
- **Presentation** (`src/presentation/`) — FastAPI routers and WebSocket handlers. Thin: validates input, calls use case, serializes output.

**Rule:** Infrastructure depends on Domain interfaces (ABCs). Application depends on Domain. Presentation depends on Application. Domain knows nothing about persistence or I/O.

---

## Project Structure

```
NexusAI/
├── apps/
│   ├── api/                   # FastAPI backend
│   │   ├── src/
│   │   │   ├── domain/        # Entities, repo ABCs, domain services
│   │   │   ├── application/   # Use cases
│   │   │   ├── infrastructure/# DuckDB, ML, AI, DB, events
│   │   │   └── presentation/  # Routers, WebSocket, middleware
│   │   ├── tests/
│   │   ├── alembic/           # DB migrations
│   │   └── pyproject.toml
│   └── web/                   # Next.js 15 frontend
│       ├── src/
│       │   ├── app/           # App Router pages
│       │   ├── features/      # Feature-sliced components
│       │   ├── components/    # Shared UI primitives
│       │   ├── stores/        # Zustand state
│       │   ├── lib/           # API clients, utils
│       │   └── types/         # TypeScript type definitions
│       └── package.json
├── packages/                  # Shared packages (future)
├── infra/
│   └── k8s/                   # Kubernetes manifests
├── .github/workflows/         # CI/CD pipelines
├── data/samples/              # Demo datasets
└── docs/                      # ADRs, this handbook
```

---

## Development Setup

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Python | 3.12+ | Backend runtime |
| Node.js | 20+ | Frontend toolchain |
| pnpm | 9+ | Monorepo package manager |
| Docker | 24+ | Local services |
| Ollama | latest | Local LLM inference |

### Quick Start

```bash
# 1. Clone and install
git clone <repo>
cd NexusAI
pnpm install                  # Install all JS dependencies

# 2. Start infrastructure
docker compose up -d postgres redis ollama

# 3. Pull an Ollama model
docker exec nexusai-ollama ollama pull qwen2.5:7b

# 4. Configure environment
cp .env.example .env          # Edit DATABASE_URL, OLLAMA_BASE_URL, etc.

# 5. Run backend
cd apps/api
pip install -e ".[dev]"
alembic upgrade head
uvicorn src.main:app --reload --port 8000

# 6. Run frontend (new terminal)
cd apps/web
pnpm dev                      # http://localhost:3000
```

### Environment Variables

Key variables (see `.env.example` for the full list):

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | postgres://... | PostgreSQL with pgvector |
| `OLLAMA_BASE_URL` | http://localhost:11434 | Ollama server |
| `OLLAMA_DEFAULT_MODEL` | qwen2.5:14b | Default inference model |
| `AGENT_MAX_ITERATIONS` | 15 | Agentic loop limit |
| `DUCKDB_THREADS` | 4 | DuckDB thread pool size |
| `NEXT_PUBLIC_API_URL` | http://localhost:8000 | Frontend → API URL |

---

## Backend Development

### Adding a New Use Case

1. Define any new domain entities or value objects in `src/domain/entities/`.
2. Add a repository method to the ABC in `src/domain/repositories/`.
3. Implement the repository method in `src/infrastructure/database/repositories/`.
4. Create `src/application/use_cases/your_use_case.py`:

```python
class YourUseCase:
    def __init__(self, repo: YourRepository) -> None:
        self._repo = repo

    async def execute(self, ...) -> YourResult:
        ...
```

5. Wire the dependency in `src/presentation/dependencies.py`.
6. Add a route in `src/presentation/api/v1/`.
7. Write a unit test in `tests/unit/application/`.

### DuckDB Engine

`DuckdbEngine` uses a thread-per-connection pattern — one DuckDB connection per `ThreadPoolExecutor` worker:

```python
engine = get_duckdb_engine()
result = await engine.execute_query("SELECT * FROM my_view LIMIT 100")
# result.rows, result.columns, result.execution_time_ms
```

Never share a DuckDB connection across threads. The engine handles this transparently. Queries are automatically limited via `_apply_row_limit()`.

### Adding a New ML Pipeline

1. Create your pipeline class in `src/infrastructure/ml/`.
2. Run CPU-bound work in an executor:

```python
loop = asyncio.get_event_loop()
result = await loop.run_in_executor(None, self._fit_and_predict, df)
```

3. Return domain entities (`AnomalyRecord`, `ForecastPoint`, `MLResult`) — never raw sklearn objects.

### Event System

Publish domain events when state changes:

```python
from src.infrastructure.events.bus import event_bus, DomainEvent, EventType

await event_bus.publish(DomainEvent(
    event_type=EventType.ANALYSIS_COMPLETED,
    payload={"analysis_id": str(analysis.id)},
))
```

Subscribe in app startup or a service:

```python
event_bus.subscribe(EventType.DATASET_UPLOADED, handle_upload)
```

The bus is backed by an `asyncio.Queue` and designed for zero-friction swap to Redis Streams or Kafka.

---

## Frontend Development

### Feature Slice Convention

Each page's logic lives in `src/features/<feature-name>/`. A feature directory contains:

- `<feature>-view.tsx` — Main view component (data fetching via TanStack Query)
- Supporting sub-components scoped to the feature

Shared primitives (Button, Badge, Input, etc.) live in `src/components/ui/`.
Layout chrome (Sidebar, TopBar, PageHeader) lives in `src/components/layout/`.

### Data Fetching

Use TanStack Query for all server state. Cache keys follow `[resource, id]`:

```typescript
const { data } = useQuery({
  queryKey: ["analyses", datasetId],
  queryFn: () => analysesApi.getByDataset(datasetId),
  staleTime: 30_000,
});
```

Invalidate after mutations:

```typescript
const mutation = useMutation({
  mutationFn: datasetsApi.upload,
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ["datasets"] }),
});
```

### WebSocket (Real-time Agent Streaming)

`agent-chat.tsx` maintains a WebSocket to `/ws/analysis/{datasetId}`. The protocol:

| Direction | Event | Payload |
|-----------|-------|---------|
| Client → Server | *(raw JSON)* | `{ query: string, type: AnalysisType }` |
| Server → Client | `started` | `{ analysis_id }` |
| Server → Client | `step` | `AgentStep` |
| Server → Client | `completed` | `AnalysisResult` |
| Server → Client | `error` | `{ message }` |

Live steps are stored in `analysis-store.ts` (`liveSteps`) and rendered in `AgentStepTrace`.

### Zustand Stores

Two stores:

- **`dataset-store`** — `selectedDatasetId`, `isUploadDialogOpen`, upload progress
- **`analysis-store`** — `liveSteps`, `isAnalysisRunning`, `wsConnected`, result cache

Access with `useDatasetStore()` / `useAnalysisStore()` — both have devtools middleware.

---

## AI Agent System

### Agentic Loop (`AnalysisCoordinator`)

```
User query
    │
    ▼
System prompt + schema context
    │
    ▼
Ollama chat (qwen2.5:14b, temperature=0.1)
    │
    ├─ tool_calls present?
    │       │ Yes
    │       ▼
    │   Dispatch tool (inspect_schema / execute_sql / sample_data)
    │   Append tool result to messages
    │   Increment iteration counter
    │   Loop back ──────────────────────────────┐
    │                                            │
    │       │ No                                 │
    │       ▼                              (max 15 iterations)
    │   Extract key findings from response
    │   Return AnalysisResult
```

### Tools Available to the Agent

| Tool | Description |
|------|-------------|
| `inspect_schema` | Returns column names, types, nullability, cardinality |
| `execute_sql` | Runs a DuckDB SQL query; returns rows + execution plan |
| `sample_data` | Returns N random rows from a view |

SQL tool sanitizes queries: `DROP`, `TRUNCATE`, `DELETE`, `INSERT`, `UPDATE` are blocked.

### System Prompts

Prompts are in `src/infrastructure/ai/prompts/system_prompts.py`. The coordinator uses `COORDINATOR_SYSTEM_PROMPT` which instructs the agent to:

1. Always inspect schema before writing SQL
2. Prefer DuckDB-native functions (`STDDEV_POP`, `QUANTILE_CONT`, etc.)
3. Cite statistical evidence; never speculate without data
4. Structure findings as bullet points with numerical backing

---

## Testing Strategy

### Backend

```bash
cd apps/api
pytest                          # All tests
pytest tests/unit/              # Unit tests only (no DB required)
pytest tests/integration/       # Needs postgres + DuckDB
pytest --cov=src --cov-report=term-missing
```

Test isolation:
- Unit tests use `sqlite+aiosqlite:///:memory:` — no postgres required
- Integration tests require the postgres service (started by docker-compose)
- ML tests use small synthetic dataframes (no file I/O)

### Frontend

```bash
cd apps/web
pnpm test           # Vitest unit tests
pnpm test:coverage  # With coverage report
pnpm e2e            # Playwright (requires running dev server)
```

Test files live in `src/__tests__/` (utils, stores) and co-located `*.test.tsx` files for components.

### Coverage Targets

| Layer | Target |
|-------|--------|
| Domain services | 95% |
| Application use cases | 90% |
| Infrastructure (DuckDB, ML) | 80% |
| Presentation (routes) | 70% |
| Frontend utils | 95% |
| Frontend components | 75% |

---

## Database & Migrations

### Schema

| Table | Purpose |
|-------|---------|
| `datasets` | Dataset metadata, status, schema JSON |
| `dataset_versions` | Immutable snapshot per upload |
| `analyses` | Analysis runs with status and result JSON |
| `agent_runs` | Per-step agent trace |
| `insights` | AI-generated insights with pgvector embedding |

### Running Migrations

```bash
cd apps/api

# Create a new migration
alembic revision --autogenerate -m "add_column_xyz"

# Apply all pending migrations
alembic upgrade head

# Rollback one step
alembic downgrade -1
```

Migrations are in `alembic/versions/`. The async SQLAlchemy setup in `alembic/env.py` uses `asyncio.run(run_async_migrations())`.

### pgvector (Semantic Search)

`InsightModel.embedding` is a `Vector(768)` column. Semantic search queries use cosine distance:

```sql
SELECT * FROM insights
ORDER BY embedding <=> :query_embedding
WHERE 1 - (embedding <=> :query_embedding) >= 0.7
LIMIT 10;
```

The embedding is generated by the Ollama model's hidden states or a dedicated embedding endpoint.

---

## Deployment

### Docker Compose (Development)

```bash
docker compose up -d          # Start all services
docker compose logs -f api    # Tail API logs
docker compose down -v        # Stop + remove volumes
```

Services: `api` (port 8000), `web` (port 3000), `postgres` (5432), `redis` (6379), `ollama` (11434), `worker` (Celery).

### Kubernetes (Production)

Manifests are in `infra/k8s/base/`. Apply with kustomize:

```bash
kubectl apply -k infra/k8s/overlays/production
```

Key resources:
- `api-deployment.yaml` — 2 replicas, rolling update, 2 CPU / 4 Gi RAM limits
- `web-deployment.yaml` — Deployment + Service + Ingress (TLS via cert-manager)
- `postgres-statefulset.yaml` — PVC-backed PostgreSQL with pgvector
- `ollama-deployment.yaml` — GPU node selector, persistent model cache

### CI/CD (GitHub Actions)

On every push to any branch:
1. `api-lint` — Ruff + mypy strict
2. `web-lint` — ESLint + TypeScript compiler
3. `api-test` — pytest with postgres service container
4. `web-test` — Vitest

On merge to `main`:
5. `docker-build` — Multi-arch image pushed to `ghcr.io/<org>/nexusai-api` and `nexusai-web`
6. `security` — Trivy SARIF uploaded to GitHub Security tab
7. `deploy` — `kubectl set image` rolling deploy

---

## Coding Standards

### Python

- **Formatter:** Ruff (`ruff format`)
- **Linter:** Ruff (`ruff check --fix`)
- **Type checker:** mypy strict mode
- All public functions must be typed
- Async functions use `async def` throughout; no `asyncio.run()` inside request handlers
- Use `structlog` for structured logging (never `print`)
- No bare `except:` — always catch specific exceptions

### TypeScript / React

- **Formatter:** Prettier (`.prettierrc`)
- **Linter:** ESLint with `@typescript-eslint/recommended`
- Strict TypeScript (`"strict": true`)
- No `any` without a `// eslint-disable` comment explaining why
- Components: function declarations, not arrow functions at module level
- Event handlers: prefix with `handle` (`handleSubmit`, `handleChange`)
- Booleans: prefix with `is`/`has`/`can` (`isLoading`, `hasError`)

### Git Conventions

Branch naming:
- `feat/<short-description>` — New feature
- `fix/<short-description>` — Bug fix
- `chore/<short-description>` — Tooling, deps, config

Commit messages follow Conventional Commits:
```
feat(analysis): add multi-dataset correlation view
fix(duckdb): prevent connection leak on query timeout
chore(deps): bump scikit-learn to 1.5.2
```

---

## Troubleshooting

### Ollama not responding

```bash
# Check Ollama is running
curl http://localhost:11434/api/tags

# Verify model is pulled
docker exec nexusai-ollama ollama list

# Check API logs
docker compose logs ollama
```

### DuckDB thread pool exhaustion

Increase `DUCKDB_THREADS` in `.env` (default: 4). Each thread maintains one DuckDB connection. Connections are reused across requests within a thread.

### pgvector extension missing

```sql
-- Connect to postgres and run:
CREATE EXTENSION IF NOT EXISTS vector;
```

Or run `alembic upgrade head` which creates the extension in the initial migration.

### WebSocket disconnects immediately

Check CORS config in `src/main.py`. The `allowed_origins` must include the frontend URL. Also verify the `NEXT_PUBLIC_WS_URL` env var in the frontend matches the backend host.

### Frontend type errors on `AnalysisDetail`

The `result` field is `AnalysisResult` which has `ml_results: MLResult[]`. ML-specific fields (`model_name`, `metrics`, `feature_importance`, `forecast_points`, `anomalies`) live on individual `MLResult` objects, not directly on `AnalysisResult`. Always access via `result.ml_results[0]`.

### High memory usage in ML pipeline

Prophet keeps its Stan model in memory. If running multiple forecasts, ensure `OLLAMA_KEEP_ALIVE` is set and consider restarting the worker between large jobs. The Celery worker (`worker` service) can be scaled independently of the API.
