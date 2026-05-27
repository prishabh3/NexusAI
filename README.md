# NexusAI — Autonomous AI Data Analyst

> Enterprise-grade AI-powered data analysis platform. Upload datasets, get autonomous insights, forecasts, anomaly detection, and conversational analytics — all powered by local LLMs.

---

## What It Does

NexusAI is an autonomous data analyst agent. You upload a dataset; it reasons, queries, and produces evidence-backed business insights without you writing a single line of code.

**The AI agent:**
1. Inspects your schema
2. Forms analytical hypotheses
3. Writes and executes DuckDB SQL
4. Invokes ML models when needed
5. Synthesizes findings into structured insights
6. Presents a complete analytical report

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                         NexusAI Platform                            │
│                                                                      │
│  ┌──────────────┐    ┌──────────────────────────────────────────┐  │
│  │  Next.js 15  │    │            FastAPI (Python 3.12)          │  │
│  │  TypeScript  │◄──►│                                            │  │
│  │  Tailwind    │    │  ┌──────────┐  ┌──────────┐  ┌────────┐ │  │
│  │  Zustand     │    │  │ Domain   │  │ App Layer│  │ Infra  │ │  │
│  │  Recharts    │    │  │ Entities │  │ Use Cases│  │ Layer  │ │  │
│  │  DuckDB-WASM │    │  └──────────┘  └──────────┘  └────────┘ │  │
│  └──────────────┘    │                                            │  │
│                       │  ┌──────────────────────────────────────┐ │  │
│                       │  │       Agent Orchestration             │ │  │
│                       │  │  Coordinator → EDA → SQL → Forecast  │ │  │
│                       │  │  Anomaly → Insight → Visualization   │ │  │
│                       │  └──────────────────────────────────────┘ │  │
│                       └──────────────────────────────────────────┘  │
│                                                                      │
│  ┌─────────┐  ┌──────────────┐  ┌────────────┐  ┌──────────────┐ │
│  │PostgreSQL│  │ Redis/Celery │  │   Ollama   │  │   DuckDB     │ │
│  │pgvector  │  │  (workers)  │  │ (local LLM)│  │  (analytics) │ │
│  └─────────┘  └──────────────┘  └────────────┘  └──────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

**Tech Stack:**

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Zustand, Recharts |
| Backend | FastAPI, Python 3.12, Pydantic v2, SQLAlchemy 2.0 async |
| AI/LLM | Ollama (qwen2.5, llama3, deepseek), LangGraph orchestration |
| Analytics | DuckDB (server + WASM browser), Apache Parquet |
| ML | scikit-learn, XGBoost, Prophet, SHAP |
| Database | PostgreSQL 16 + pgvector |
| Cache/Queue | Redis, Celery |
| Infrastructure | Docker, Kubernetes, GitHub Actions |

---

## Quick Start

### Prerequisites

- Docker & Docker Compose
- (Optional) Ollama for local LLM inference

### 1. Clone and configure

```bash
git clone <repo-url> nexusai
cd nexusai
cp .env.example .env
# Edit .env — at minimum set APP_SECRET_KEY
```

### 2. Start services

```bash
docker compose up -d
```

This starts:
- **PostgreSQL + pgvector** on port 5432
- **Redis** on port 6379
- **Ollama** on port 11434
- **API** on port 8000
- **Web** on port 3000
- **Celery worker**

### 3. Pull an LLM model

```bash
docker exec nexusai-ollama ollama pull qwen2.5:14b
# Or for lighter resource usage:
docker exec nexusai-ollama ollama pull qwen2.5:7b
```

### 4. Open the app

Visit [http://localhost:3000](http://localhost:3000)

---

## Local Development (without Docker)

### Backend

```bash
cd apps/api

# Create virtual environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -e ".[dev]"

# Set env vars (copy and edit)
cp ../../.env.example .env

# Run database migrations
alembic upgrade head

# Start dev server
uvicorn src.main:app --reload --port 8000
```

### Frontend

```bash
cd apps/web

# Install dependencies (requires pnpm)
pnpm install

# Start dev server
pnpm dev
```

---

## Core Features

### Dataset Upload
- Drag & drop CSV, Parquet, JSON files
- Automatic schema inference and statistical profiling
- Column type detection, null analysis, cardinality
- Data quality scoring (0–100%)
- Correlation matrix computation

### AI Agent Analysis
- True agentic loop — not one-shot prompting
- Agent inspects schema → forms hypotheses → executes SQL → refines
- Full reasoning trace visible in UI
- Configurable iteration limit (default 15)

### Anomaly Detection
- Ensemble: Isolation Forest + Local Outlier Factor + DBSCAN
- Automatic severity scoring (low/medium/high/critical)
- Per-anomaly column attribution and explanation

### Forecasting
- Prophet (primary) with XGBoost fallback
- Confidence intervals at configurable percentile
- Automatic seasonality detection
- Trend decomposition

### AutoML
- Automatic problem type inference (classification/regression)
- Benchmarks XGBoost, Random Forest, Gradient Boosting, LogReg/Ridge
- SHAP explainability
- Feature importance charts

### Conversational Analytics
- WebSocket-powered real-time chat
- Agent streams reasoning steps live
- Generated SQL visible and inspectable
- SQL result tables inline

---

## API Reference

API docs available at [http://localhost:8000/api/docs](http://localhost:8000/api/docs) (Swagger UI).

**Key endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/datasets` | Upload dataset |
| GET | `/api/v1/datasets` | List datasets |
| GET | `/api/v1/datasets/{id}` | Get dataset detail + schema |
| POST | `/api/v1/analyses` | Run analysis |
| GET | `/api/v1/analyses/{id}` | Get analysis result |
| GET | `/api/v1/insights/dataset/{id}` | List insights |
| WS | `/ws/analysis/{dataset_id}` | Stream live analysis |

---

## Environment Variables

See [.env.example](.env.example) for all variables with documentation.

Required:
- `APP_SECRET_KEY` — 32+ char random string
- `DATABASE_URL` — PostgreSQL connection URL
- `REDIS_URL` — Redis URL

---

## Project Structure

```
nexusai/
├── apps/
│   ├── api/                    # FastAPI backend
│   │   ├── src/
│   │   │   ├── domain/         # Entities, repositories (interfaces), domain services
│   │   │   ├── application/    # Use cases — pure orchestration
│   │   │   ├── infrastructure/ # DB, DuckDB, ML, AI agents, events, storage
│   │   │   └── presentation/   # REST API, WebSocket, middleware
│   │   ├── tests/
│   │   ├── alembic/
│   │   └── pyproject.toml
│   └── web/                    # Next.js frontend
│       ├── src/
│       │   ├── app/            # Next.js app router pages
│       │   ├── components/     # Shared UI components
│       │   ├── features/       # Feature-scoped modules
│       │   ├── stores/         # Zustand state stores
│       │   ├── lib/            # API client, utils
│       │   └── types/          # TypeScript types
│       └── package.json
├── packages/                   # Shared packages (future)
├── infra/
│   ├── docker/
│   └── k8s/
├── tests/e2e/                  # Playwright E2E tests
├── docs/
├── docker-compose.yml
└── .github/workflows/
```

---

## Running Tests

### Backend

```bash
cd apps/api
pytest tests/unit -v
pytest tests/integration -v
```

### Frontend

```bash
cd apps/web
pnpm test
pnpm test:e2e
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make changes with tests
4. Ensure CI passes: `turbo run lint test typecheck`
5. Open a pull request

---

## License

MIT — see [LICENSE](LICENSE)
