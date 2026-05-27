# ADR-001: Clean Architecture for Backend

**Status:** Accepted  
**Date:** 2025-05-27

## Context

The NexusAI backend needs to support multiple analytical workloads (EDA, ML, forecasting, anomaly detection, agent orchestration) while remaining testable, maintainable, and extensible. A naive flat structure would tightly couple business logic to FastAPI, DuckDB, and SQLAlchemy, making unit tests slow and refactoring expensive.

## Decision

We apply Clean Architecture with four layers:

1. **Domain** — Pure Python entities and repository interfaces. Zero external dependencies. Business rules live here.
2. **Application** — Use case orchestrators. Depend only on domain interfaces. No I/O.
3. **Infrastructure** — Concrete implementations: SQLAlchemy repos, DuckDB engine, ML pipelines, AI agents.
4. **Presentation** — FastAPI routes, WebSocket handlers, request/response DTOs.

Dependency direction: Presentation → Application → Domain ← Infrastructure.

## Consequences

**Benefits:**
- Unit tests for domain logic run in <1ms with no DB/network
- Swapping databases requires only changing Infrastructure layer
- Use cases are pure functions — easy to test with mocked repositories
- FastAPI removed from business logic entirely

**Tradeoffs:**
- More boilerplate than flat architecture
- Repository pattern can feel verbose for simple CRUD
- Developers need to understand layer boundaries

## Implementation Notes

- Repository interfaces defined as ABCs in `domain/repositories/`
- SQLAlchemy implementations in `infrastructure/database/repositories/`
- FastAPI `Depends()` wires concrete implementations at request time
- Entities use Pydantic BaseModel for validation without ORM coupling
