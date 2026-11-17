import asyncio
import logging
import os
import socket
from datetime import UTC, datetime
from uuid import UUID

from redis.exceptions import ResponseError

from app.core.database import SessionFactory, set_tenant_context
from app.core.redis import close_redis, get_redis
from app.models.domain import Mention, SentimentScore
from app.services.geo_tagger import geo_tagger
from app.services.nlp_engine import nlp_engine
from app.services.sse_broadcaster import sse_broadcaster

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("pulse.nlp-worker")

STREAM = "pulse:mentions:raw"
GROUP = "pulse-nlp"
CONSUMER = f"{socket.gethostname()}-{os.getpid()}"


async def ensure_group() -> None:
    try:
        await get_redis().xgroup_create(STREAM, GROUP, id="0", mkstream=True)
    except ResponseError as exc:
        if "BUSYGROUP" not in str(exc):
            raise


async def process(message_id: str, fields: dict[str, str]) -> None:
    tenant_id = UUID(fields["tenant_id"])
    async with SessionFactory() as session:
        await set_tenant_context(session, tenant_id)
        result = nlp_engine.analyze(fields["text"])
        geo = await geo_tagger.tag(session, fields["text"])
        mention = Mention(
            tenant_id=tenant_id,
            county_id=geo.county_id,
            constituency_id=geo.constituency_id,
            ward_id=geo.ward_id,
            source=fields.get("source", "unknown"),
            external_id=fields.get("external_id", message_id),
            author_handle=fields.get("author_handle"),
            text=fields["text"],
            language=result.language,
            sheng_detected=result.sheng_detected,
            engagement_count=int(fields.get("engagement_count", "0")),
            collected_at=datetime.fromisoformat(fields["collected_at"]) if fields.get("collected_at") else datetime.now(UTC),
            raw_payload={"stream_id": message_id, "geo_confidence": geo.confidence},
        )
        session.add(mention)
        await session.flush()
        session.add(
            SentimentScore(
                tenant_id=tenant_id,
                mention_id=mention.id,
                issue_axis=result.issue_axis,
                score=result.score,
                confidence=result.confidence,
                model_version=nlp_engine.model_version,
            )
        )
        await session.commit()
        await sse_broadcaster.publish(
            tenant_id,
            "mention.created",
            {
                "id": str(mention.id),
                "source": mention.source,
                "text": mention.text,
                "language": result.language,
                "sheng_detected": result.sheng_detected,
                "county_name": geo.label,
                "score": result.score,
                "sentiment": "positive" if result.score > 0.15 else "negative" if result.score < -0.15 else "neutral",
                "issue_axis": result.issue_axis,
                "engagement_count": mention.engagement_count,
                "collected_at": mention.collected_at.isoformat(),
            },
        )


async def run() -> None:
    await ensure_group()
    logger.info("NLP worker started as %s", CONSUMER)
    while True:
        batches = await get_redis().xreadgroup(GROUP, CONSUMER, {STREAM: ">"}, count=20, block=5000)
        for _, messages in batches:
            for message_id, fields in messages:
                try:
                    await process(message_id, fields)
                except Exception:
                    logger.exception("Failed to process stream message %s", message_id)
                    continue
                await get_redis().xack(STREAM, GROUP, message_id)


async def main() -> None:
    try:
        await run()
    finally:
        await close_redis()


if __name__ == "__main__":
    asyncio.run(main())

