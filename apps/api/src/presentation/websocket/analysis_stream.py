"""WebSocket endpoint for real-time analysis step streaming."""

from __future__ import annotations

import asyncio
import json
import logging
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from src.application.use_cases.run_analysis import RunAnalysisCommand, RunAnalysisUseCase
from src.domain.entities.analysis import AgentStep, AnalysisType
from src.infrastructure.database.base import AsyncSessionFactory
from src.infrastructure.database.repositories.analysis_repo import SqlAlchemyAnalysisRepository
from src.infrastructure.database.repositories.dataset_repo import SqlAlchemyDatasetRepository
from src.presentation.dependencies import get_duckdb_engine

logger = logging.getLogger(__name__)
router = APIRouter()

_HEARTBEAT_INTERVAL = 20  # seconds between keep-alive pings


async def _heartbeat(websocket: WebSocket, stop: asyncio.Event) -> None:
    """Send periodic heartbeat events so the browser doesn't close the connection."""
    while not stop.is_set():
        await asyncio.sleep(_HEARTBEAT_INTERVAL)
        if stop.is_set():
            break
        try:
            await websocket.send_json({"event": "heartbeat"})
        except Exception:
            break


@router.websocket("/ws/analysis/{dataset_id}")
async def stream_analysis(
    websocket: WebSocket,
    dataset_id: uuid.UUID,
) -> None:
    await websocket.accept()
    logger.info("WebSocket connection opened for dataset %s", dataset_id)

    stop_heartbeat = asyncio.Event()
    heartbeat_task = asyncio.create_task(_heartbeat(websocket, stop_heartbeat))

    async with AsyncSessionFactory() as session:
        try:
            raw = await websocket.receive_text()
            request = json.loads(raw)
            query = request.get("query", "Perform a comprehensive analysis.")
            try:
                analysis_type = AnalysisType(request.get("type", AnalysisType.FULL_PIPELINE))
            except ValueError:
                analysis_type = AnalysisType.FULL_PIPELINE

            use_case = RunAnalysisUseCase(
                dataset_repo=SqlAlchemyDatasetRepository(session),
                analysis_repo=SqlAlchemyAnalysisRepository(session),
                duckdb_engine=get_duckdb_engine(),
            )

            async def on_step(step: AgentStep) -> None:
                try:
                    await websocket.send_json(
                        {
                            "event": "step",
                            "data": {
                                "step_number": step.step_number,
                                "agent": step.agent_name,
                                "action": step.action,
                                "tool": step.tool_name,
                                "reasoning": step.reasoning[:500] if step.reasoning else None,
                                "sql_count": len(step.sql_executions),
                                "duration_ms": step.duration_ms,
                            },
                        }
                    )
                except Exception:
                    pass

            await websocket.send_json({"event": "started", "data": {"dataset_id": str(dataset_id)}})

            analysis = await use_case.execute(
                RunAnalysisCommand(
                    dataset_id=dataset_id,
                    analysis_type=analysis_type,
                    user_query=query,
                ),
                on_step=on_step,
            )

            await session.commit()

            stop_heartbeat.set()
            await websocket.send_json(
                {
                    "event": "completed",
                    "data": {
                        "analysis_id": str(analysis.id),
                        "status": analysis.status,
                        "summary": analysis.result.summary if analysis.result else None,
                        "finding_count": len(analysis.result.key_findings)
                        if analysis.result
                        else 0,
                        "step_count": len(analysis.agent_steps),
                        "duration_seconds": analysis.duration_seconds,
                    },
                }
            )

        except WebSocketDisconnect:
            logger.info("WebSocket disconnected for dataset %s", dataset_id)
        except json.JSONDecodeError:
            await websocket.send_json(
                {"event": "error", "data": {"message": "Invalid JSON payload"}}
            )
        except Exception as exc:
            logger.exception("WebSocket analysis error: %s", exc)
            try:
                await websocket.send_json({"event": "error", "data": {"message": str(exc)}})
            except Exception:
                pass
        finally:
            stop_heartbeat.set()
            heartbeat_task.cancel()
            try:
                await websocket.close()
            except Exception:
                pass
