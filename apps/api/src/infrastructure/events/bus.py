"""In-process async event bus for decoupled internal communication."""

from __future__ import annotations

import asyncio
import logging
from collections import defaultdict
from collections.abc import Callable, Coroutine
from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

logger = logging.getLogger(__name__)

EventHandler = Callable[[Any], Coroutine[Any, Any, None]]


class EventType(StrEnum):
    DATASET_UPLOADED = "dataset.uploaded"
    DATASET_PROFILED = "dataset.profiled"
    DATASET_FAILED = "dataset.failed"
    ANALYSIS_STARTED = "analysis.started"
    ANALYSIS_STEP_COMPLETED = "analysis.step_completed"
    ANALYSIS_COMPLETED = "analysis.completed"
    ANALYSIS_FAILED = "analysis.failed"
    ANOMALY_DETECTED = "anomaly.detected"
    FORECAST_COMPUTED = "forecast.computed"
    INSIGHT_GENERATED = "insight.generated"
    INSIGHT_VERIFIED = "insight.verified"
    ML_PIPELINE_COMPLETED = "ml.pipeline_completed"


@dataclass
class DomainEvent:
    event_type: EventType
    payload: dict[str, Any]
    aggregate_id: UUID | None = None
    occurred_at: datetime = field(default_factory=datetime.utcnow)


class EventBus:
    """Single-process async pub/sub event bus.

    For production scale-out, swap handlers to publish onto a Redis Streams
    or Kafka topic without changing callsites.
    """

    def __init__(self) -> None:
        self._handlers: dict[str, list[EventHandler]] = defaultdict(list)
        self._queue: asyncio.Queue[DomainEvent] = asyncio.Queue(maxsize=1000)
        self._running = False

    def subscribe(self, event_type: EventType, handler: EventHandler) -> None:
        self._handlers[event_type].append(handler)
        logger.debug("Subscribed handler %s to %s", handler.__qualname__, event_type)

    async def publish(self, event: DomainEvent) -> None:
        await self._queue.put(event)

    def publish_sync(self, event: DomainEvent) -> None:
        try:
            self._queue.put_nowait(event)
        except asyncio.QueueFull:
            logger.warning("Event bus queue full, dropping event: %s", event.event_type)

    async def start(self) -> None:
        self._running = True
        logger.info("Event bus started")
        asyncio.create_task(self._dispatch_loop())  # noqa: RUF006

    async def stop(self) -> None:
        self._running = False
        await self._queue.join()
        logger.info("Event bus stopped")

    async def _dispatch_loop(self) -> None:
        while self._running:
            try:
                event = await asyncio.wait_for(self._queue.get(), timeout=1.0)
                await self._dispatch(event)
                self._queue.task_done()
            except TimeoutError:
                continue
            except Exception as exc:
                logger.exception("Event dispatch error: %s", exc)

    async def _dispatch(self, event: DomainEvent) -> None:
        handlers = self._handlers.get(event.event_type, [])
        if not handlers:
            return

        tasks = [handler(event) for handler in handlers]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for handler, result in zip(handlers, results, strict=False):
            if isinstance(result, Exception):
                logger.error(
                    "Handler %s failed for event %s: %s",
                    handler.__qualname__,
                    event.event_type,
                    result,
                )


# Module-level singleton
event_bus = EventBus()
