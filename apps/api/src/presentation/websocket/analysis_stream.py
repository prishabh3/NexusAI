"""WebSocket endpoint for real-time analysis step streaming."""
from __future__ import annotations

import json
import logging
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from src.application.use_cases.run_analysis import RunAnalysisCommand, RunAnalysisUseCase
from src.domain.entities.analysis import AgentStep, AnalysisType
from src.presentation.dependencies import get_run_analysis_use_case_sync

logger = logging.getLogger(__name__)
router = APIRouter()


@router.websocket("/ws/analysis/{dataset_id}")
async def stream_analysis(
    websocket: WebSocket,
    dataset_id: uuid.UUID,
) -> None:
    await websocket.accept()
    logger.info("WebSocket connection opened for dataset %s", dataset_id)

    try:
        raw = await websocket.receive_text()
        request = json.loads(raw)
        query = request.get("query", "Perform a comprehensive analysis.")
        analysis_type = AnalysisType(request.get("type", AnalysisType.FULL_PIPELINE))

        use_case: RunAnalysisUseCase = get_run_analysis_use_case_sync()

        async def on_step(step: AgentStep) -> None:
            try:
                await websocket.send_json({
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
                })
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

        await websocket.send_json({
            "event": "completed",
            "data": {
                "analysis_id": str(analysis.id),
                "status": analysis.status,
                "summary": analysis.result.summary if analysis.result else None,
                "finding_count": len(analysis.result.key_findings) if analysis.result else 0,
                "step_count": len(analysis.agent_steps),
                "duration_seconds": analysis.duration_seconds,
            },
        })

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected for dataset %s", dataset_id)
    except json.JSONDecodeError:
        await websocket.send_json({"event": "error", "data": {"message": "Invalid JSON payload"}})
    except Exception as exc:
        logger.exception("WebSocket analysis error: %s", exc)
        try:
            await websocket.send_json({"event": "error", "data": {"message": str(exc)}})
        except Exception:
            pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
