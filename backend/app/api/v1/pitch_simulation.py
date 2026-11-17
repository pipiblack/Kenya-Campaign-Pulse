from datetime import UTC, datetime
from itertools import cycle
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.alerts import _read
from app.core.database import get_db, set_tenant_context
from app.core.security import Principal, get_current_principal, require_operator
from app.models.domain import Alert, BotCluster, Constituency, County, Mention, SentimentScore, Ward
from app.models.schemas import CrisisInjectionRequest, CrisisInjectionResponse
from app.services.sse_broadcaster import sse_broadcaster

router = APIRouter()

SCENARIOS = {
    "cost_of_living": {
        "title": "Coordinated cost-of-living narrative spike",
        "axis": "economy",
        "category": "coordinated_narrative",
        "texts": [
            "Bei ya unga imepanda tena, wananchi wamechoka kabisa.",
            "Manze hii cost of living ni noma, hakuna relief kwa families.",
            "Prices are rising while local leaders stay silent.",
            "Chapaa inaisha kwa food na transport pekee — we need answers.",
        ],
    },
    "healthcare_outage": {
        "title": "County healthcare service interruption",
        "axis": "healthcare",
        "category": "service_delivery",
        "texts": [
            "Hospital has no medicine and patients are being turned away.",
            "Afya iko crisis, hakuna dawa kwa clinic leo.",
            "Emergency services have failed families in the county.",
            "Wasee are waiting hours at the hospital — this is unacceptable.",
        ],
    },
    "security_incident": {
        "title": "Rapid security concern amplification",
        "axis": "security",
        "category": "public_safety",
        "texts": [
            "Residents say the area is unsafe after another incident.",
            "Usalama umekuwa mbaya na wananchi wanataka action.",
            "Security alerts are spreading fast across local groups.",
            "Rada ni gani? Wasee need verified updates from authorities.",
        ],
    },
    "leadership_scandal": {
        "title": "Leadership integrity allegation gaining traction",
        "axis": "corruption",
        "category": "reputation",
        "texts": [
            "New corruption allegations demand an immediate response.",
            "Wananchi wanataka ukweli kuhusu ufisadi wa county.",
            "The leadership scandal is spreading across every channel.",
            "Manze accountability iko wapi? Release the records now.",
        ],
    },
}

PLAYBOOK = [
    {"minute": 0, "action": "Verify source cluster and preserve evidence", "owner": "Sentry analyst"},
    {"minute": 5, "action": "Brief incident lead with county-level signal context", "owner": "Duty lead"},
    {"minute": 10, "action": "Publish a verified holding line in English and Kiswahili", "owner": "Communications"},
    {"minute": 20, "action": "Activate CATI pulse-check sample", "owner": "Voice supervisor"},
    {"minute": 30, "action": "Review trajectory and escalate, contain or close", "owner": "Command lead"},
]


@router.get("/scenarios")
async def scenarios() -> list[dict[str, str]]:
    return [{"id": key, "title": value["title"]} for key, value in SCENARIOS.items()]


@router.post("/inject-crisis", response_model=CrisisInjectionResponse)
async def inject_crisis(
    payload: CrisisInjectionRequest,
    principal: Principal = Depends(require_operator),
    session: AsyncSession = Depends(get_db),
) -> CrisisInjectionResponse:
    await set_tenant_context(session, principal.tenant_id)
    county = (await session.execute(select(County).where(County.code == payload.county_code))).scalar_one()
    constituency: Constituency | None = None
    ward: Ward | None = None
    if payload.constituency_code is not None:
        constituency = (
            await session.execute(
                select(Constituency).where(
                    Constituency.code == payload.constituency_code,
                    Constituency.county_id == county.id,
                )
            )
        ).scalar_one_or_none()
        if constituency is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Constituency does not belong to the selected county")
    if payload.ward_code is not None:
        if constituency is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Select a constituency before selecting a ward")
        ward = (
            await session.execute(
                select(Ward).where(Ward.code == payload.ward_code, Ward.constituency_id == constituency.id)
            )
        ).scalar_one_or_none()
        if ward is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ward does not belong to the selected constituency")
    scope_name = ward.name if ward else constituency.name if constituency else county.name
    scenario = SCENARIOS[payload.scenario]
    severity = 4 if payload.intensity >= 90 else 3
    mention_count = max(6, payload.intensity // 7)
    cluster = BotCluster(
        tenant_id=principal.tenant_id,
        county_id=county.id,
        label=f"SIM-{payload.scenario.upper()}-{datetime.now(UTC):%H%M%S}",
        narrative=scenario["title"],
        coordination_score=round(min(0.98, 0.58 + payload.intensity / 250), 3),
        threat_level=severity,
        account_count=mention_count * 7,
        evidence={"simulation": True, "burst_mentions": mention_count, "intensity": payload.intensity},
    )
    session.add(cluster)
    await session.flush()

    templates = cycle(scenario["texts"])
    created_mentions: list[Mention] = []
    for index in range(mention_count):
        mention = Mention(
            tenant_id=principal.tenant_id,
            county_id=county.id,
            constituency_id=constituency.id if constituency else None,
            ward_id=ward.id if ward else None,
            source=("x", "tiktok", "facebook", "news")[index % 4],
            external_id=f"simulation-{cluster.id}-{index}",
            author_handle=f"signal_{payload.county_code}_{index:02d}",
            text=next(templates),
            language=("sw", "sheng", "en")[index % 3],
            sheng_detected=index % 3 == 1,
            engagement_count=int(payload.intensity * (1 + index / 3)),
            raw_payload={"simulation": True, "scenario": payload.scenario, "scope": scope_name},
        )
        session.add(mention)
        await session.flush()
        session.add(
            SentimentScore(
                tenant_id=principal.tenant_id,
                mention_id=mention.id,
                issue_axis=scenario["axis"],
                score=round(-0.58 - payload.intensity / 280, 3),
                confidence=0.94,
                model_version="pitch-simulator-1.0",
            )
        )
        created_mentions.append(mention)

    alert = Alert(
        tenant_id=principal.tenant_id,
        county_id=county.id,
        bot_cluster_id=cluster.id,
        severity=severity,
        category=scenario["category"],
        title=scenario["title"],
        narrative=f"Simulated {payload.intensity}% intensity signal burst detected in {scope_name}, {county.name} across four channels.",
        status="open",
        playbook=PLAYBOOK,
    )
    session.add(alert)
    await session.commit()

    alert_read = _read(alert, county)
    event = await sse_broadcaster.publish(
        principal.tenant_id,
        "alert.created",
        {**alert_read.model_dump(mode="json"), "simulation": True, "mentions_created": mention_count},
    )
    for mention in created_mentions[:5]:
        await sse_broadcaster.publish(
            principal.tenant_id,
            "mention.created",
            {
                "id": str(mention.id),
                "source": mention.source,
                "text": mention.text,
                "language": mention.language,
                "sheng_detected": mention.sheng_detected,
                "county_code": county.code,
                "county_name": county.name,
                "constituency_code": constituency.code if constituency else None,
                "constituency_name": constituency.name if constituency else None,
                "ward_code": ward.code if ward else None,
                "ward_name": ward.name if ward else None,
                "score": round(-0.58 - payload.intensity / 280, 3),
                "sentiment": "negative",
                "issue_axis": scenario["axis"],
                "engagement_count": mention.engagement_count,
                "collected_at": mention.collected_at.isoformat(),
            },
        )
    return CrisisInjectionResponse(alert=alert_read, mentions_created=mention_count, event_id=event.id)


@router.get("/events")
async def event_stream(
    request: Request,
    principal: Principal = Depends(get_current_principal),
) -> StreamingResponse:
    return StreamingResponse(
        sse_broadcaster.stream(principal.tenant_id, request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

