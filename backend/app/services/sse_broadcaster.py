import asyncio
import json
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from fastapi import Request

from app.core.redis import get_redis
from app.models.schemas import StreamEvent
from config import settings


class SSEBroadcaster:
    channel_prefix = "pulse:events"

    @classmethod
    def channel(cls, tenant_id: UUID) -> str:
        return f"{cls.channel_prefix}:{tenant_id}"

    async def publish(self, tenant_id: UUID, event_type: str, data: dict[str, Any]) -> StreamEvent:
        event = StreamEvent(
            id=uuid4(),
            type=event_type,
            tenant_id=tenant_id,
            occurred_at=datetime.now(UTC),
            data=data,
        )
        await get_redis().publish(self.channel(tenant_id), event.model_dump_json())
        return event

    async def stream(self, tenant_id: UUID, request: Request) -> AsyncIterator[str]:
        pubsub = get_redis().pubsub()
        await pubsub.subscribe(self.channel(tenant_id))
        connected = StreamEvent(
            id=uuid4(),
            type="connected",
            tenant_id=tenant_id,
            occurred_at=datetime.now(UTC),
            data={"heartbeat_seconds": settings.sse_heartbeat_seconds},
        )
        yield self._format(connected)
        try:
            while not await request.is_disconnected():
                message = await pubsub.get_message(
                    ignore_subscribe_messages=True,
                    timeout=settings.sse_heartbeat_seconds,
                )
                if message and message.get("type") == "message":
                    event = StreamEvent.model_validate_json(message["data"])
                    yield self._format(event)
                else:
                    yield f": heartbeat {datetime.now(UTC).isoformat()}\n\n"
                await asyncio.sleep(0)
        finally:
            await pubsub.unsubscribe(self.channel(tenant_id))
            await pubsub.aclose()

    @staticmethod
    def _format(event: StreamEvent) -> str:
        payload = json.dumps(event.data, separators=(",", ":"), default=str)
        return f"id: {event.id}\nevent: {event.type}\ndata: {payload}\n\n"


sse_broadcaster = SSEBroadcaster()

