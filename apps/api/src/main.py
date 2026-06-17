"""NexusAI API — FastAPI application entrypoint."""

from __future__ import annotations

import asyncio
import logging
import sys
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from src.infrastructure.config import settings
from src.infrastructure.database.base import Base, engine
from src.infrastructure.events.bus import event_bus
from src.presentation.api.v1.analyses import router as analyses_router
from src.presentation.api.v1.datasets import router as datasets_router
from src.presentation.api.v1.insights import router as insights_router
from src.presentation.websocket.analysis_stream import router as ws_router


def configure_logging() -> None:
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.dev.ConsoleRenderer()
            if settings.log_format == "text"
            else structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(getattr(logging, settings.log_level)),
        logger_factory=structlog.PrintLoggerFactory(sys.stdout),
    )


configure_logging()
logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("NexusAI API starting", env=settings.app_env, model=settings.ollama_default_model)

    for attempt in range(10):
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            break
        except Exception as exc:
            if attempt == 9:
                logger.error("Database unreachable after 10 attempts, giving up", error=str(exc))
                raise
            logger.warning("Database not ready, retrying", attempt=attempt + 1, error=str(exc))
            await asyncio.sleep(3)

    await event_bus.start()
    logger.info("Event bus initialized")

    # Re-register all ready datasets in DuckDB after every startup/reload
    try:
        from src.infrastructure.database.base import AsyncSessionFactory
        from src.infrastructure.database.repositories.dataset_repo import SqlAlchemyDatasetRepository
        from src.presentation.dependencies import get_duckdb_engine

        duckdb_engine = get_duckdb_engine()
        async with AsyncSessionFactory() as session:
            repo = SqlAlchemyDatasetRepository(session)
            datasets = await repo.find_all(limit=500)
            registered = 0
            for ds in datasets:
                if ds.status == "ready" and ds.file_path and ds.file_format:
                    table_name = ds.metadata.get("duckdb_table", f"ds_{ds.id.hex[:12]}")
                    try:
                        await duckdb_engine.register_dataset(table_name, ds.file_path, ds.file_format)
                        registered += 1
                    except Exception as exc:
                        logger.warning("Failed to register dataset at startup", dataset_id=str(ds.id), error=str(exc))
        logger.info("DuckDB datasets registered at startup", count=registered)
    except Exception as exc:
        logger.warning("Dataset pre-registration skipped", error=str(exc))

    yield

    await event_bus.stop()
    await engine.dispose()
    logger.info("NexusAI API shutdown complete")


def create_app() -> FastAPI:
    app = FastAPI(
        title="NexusAI API",
        description="Autonomous AI Data Analyst — production-grade analytical platform",
        version="0.1.0",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.app_cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(GZipMiddleware, minimum_size=1000)

    @app.exception_handler(ValueError)
    async def value_error_handler(request: Request, exc: ValueError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"detail": str(exc)},
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled exception", path=request.url.path, exc=str(exc))
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error"},
        )

    api_prefix = "/api/v1"
    app.include_router(datasets_router, prefix=api_prefix)
    app.include_router(analyses_router, prefix=api_prefix)
    app.include_router(insights_router, prefix=api_prefix)
    app.include_router(ws_router)

    @app.get("/health", tags=["health"])
    async def health_check() -> dict[str, str]:
        return {"status": "healthy", "version": "0.1.0", "env": settings.app_env}

    return app


app = create_app()
