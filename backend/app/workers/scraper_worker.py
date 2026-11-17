import asyncio
import os
import random
from datetime import UTC, datetime

from app.core.redis import close_redis, get_redis
from config import settings

STREAM = "pulse:mentions:raw"
SAMPLE_SIGNALS = [
    ("x", "Nakuru farmers say fertilizer prices are ghali but the rains look good."),
    ("facebook", "Hospital services in Kisumu have improved this week, hongera staff."),
    ("tiktok", "Manze traffic ya Nairobi ni noma, barabara needs a better plan."),
    ("news", "Youth employment programme opens new applications in Mombasa."),
    ("x", "Wananchi in Kiambu ask for verified updates on county water projects."),
]


async def run() -> None:
    tenant_id = os.getenv("SCRAPER_TENANT_ID", settings.demo_tenant_id)
    interval = max(2, int(os.getenv("SCRAPER_INTERVAL_SECONDS", "8")))
    while True:
        source, text = random.choice(SAMPLE_SIGNALS)
        await get_redis().xadd(
            STREAM,
            {
                "tenant_id": tenant_id,
                "source": source,
                "external_id": f"demo-{datetime.now(UTC).timestamp()}",
                "author_handle": f"public_signal_{random.randint(100, 999)}",
                "text": text,
                "engagement_count": str(random.randint(4, 480)),
                "collected_at": datetime.now(UTC).isoformat(),
            },
            maxlen=100_000,
            approximate=True,
        )
        await asyncio.sleep(interval)


async def main() -> None:
    try:
        await run()
    finally:
        await close_redis()


if __name__ == "__main__":
    asyncio.run(main())

