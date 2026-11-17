from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db, set_tenant_context
from app.core.security import Principal, get_current_principal
from app.models.domain import Alert, Constituency, County, Mention, SentimentScore, Ward
from app.models.schemas import AxisSummary, ConstituencyRead, CountyRead, CountySentiment, MentionRead, SentimentSummary, WardRead

router = APIRouter()


async def _bind(session: AsyncSession, principal: Principal) -> None:
    await set_tenant_context(session, principal.tenant_id)


@router.get("/counties", response_model=list[CountyRead])
async def list_counties(session: AsyncSession = Depends(get_db)) -> list[County]:
    return list((await session.execute(select(County).order_by(County.code))).scalars())


@router.get("/constituencies", response_model=list[ConstituencyRead])
async def list_constituencies(
    county_code: int | None = Query(default=None, ge=1, le=47),
    session: AsyncSession = Depends(get_db),
) -> list[Constituency]:
    statement = select(Constituency).join(County).order_by(Constituency.code)
    if county_code is not None:
        statement = statement.where(County.code == county_code)
    return list((await session.execute(statement)).scalars())


@router.get("/wards", response_model=list[WardRead])
async def list_wards(
    county_code: int | None = Query(default=None, ge=1, le=47),
    constituency_code: int | None = Query(default=None, ge=1, le=290),
    session: AsyncSession = Depends(get_db),
) -> list[Ward]:
    statement = select(Ward).join(Constituency).join(County).order_by(Ward.code)
    if county_code is not None:
        statement = statement.where(County.code == county_code)
    if constituency_code is not None:
        statement = statement.where(Constituency.code == constituency_code)
    return list((await session.execute(statement)).scalars())


@router.get("/summary", response_model=SentimentSummary)
async def sentiment_summary(
    county_code: int | None = Query(default=None, ge=1, le=47),
    constituency_code: int | None = Query(default=None, ge=1, le=290),
    ward_code: int | None = Query(default=None, ge=1, le=1450),
    window_hours: int = Query(default=24, ge=1, le=720),
    principal: Principal = Depends(get_current_principal),
    session: AsyncSession = Depends(get_db),
) -> SentimentSummary:
    await _bind(session, principal)
    cutoff = datetime.now(UTC) - timedelta(hours=window_hours)
    filters = [Mention.tenant_id == principal.tenant_id, Mention.collected_at >= cutoff]
    if county_code is not None:
        filters.append(County.code == county_code)
    if constituency_code is not None:
        filters.append(Constituency.code == constituency_code)
    if ward_code is not None:
        filters.append(Ward.code == ward_code)

    base = (
        select(
            func.count(SentimentScore.id),
            func.coalesce(func.avg(SentimentScore.score), 0.0),
            func.count(SentimentScore.id).filter(SentimentScore.score > 0.15),
            func.count(SentimentScore.id).filter(SentimentScore.score < -0.15),
            func.count(SentimentScore.id).filter(SentimentScore.score.between(-0.15, 0.15)),
        )
        .select_from(Mention)
        .join(SentimentScore, SentimentScore.mention_id == Mention.id)
        .outerjoin(County, County.id == Mention.county_id)
        .outerjoin(Constituency, Constituency.id == Mention.constituency_id)
        .outerjoin(Ward, Ward.id == Mention.ward_id)
        .where(*filters)
    )
    total, net, positive, negative, neutral = (await session.execute(base)).one()
    axes_rows = (
        await session.execute(
            select(
                SentimentScore.issue_axis,
                func.avg(SentimentScore.score),
                func.count(SentimentScore.id),
            )
            .select_from(Mention)
            .join(SentimentScore, SentimentScore.mention_id == Mention.id)
            .outerjoin(County, County.id == Mention.county_id)
            .outerjoin(Constituency, Constituency.id == Mention.constituency_id)
            .outerjoin(Ward, Ward.id == Mention.ward_id)
            .where(*filters)
            .group_by(SentimentScore.issue_axis)
            .order_by(func.count(SentimentScore.id).desc())
        )
    ).all()
    return SentimentSummary(
        total_mentions=int(total),
        net_sentiment=round(float(net), 4),
        positive=int(positive),
        negative=int(negative),
        neutral=int(neutral),
        window_hours=window_hours,
        axes=[AxisSummary(axis=axis, score=round(float(score), 4), volume=int(volume)) for axis, score, volume in axes_rows],
    )


@router.get("/mentions", response_model=list[MentionRead])
async def latest_mentions(
    county_code: int | None = Query(default=None, ge=1, le=47),
    constituency_code: int | None = Query(default=None, ge=1, le=290),
    ward_code: int | None = Query(default=None, ge=1, le=1450),
    limit: int = Query(default=30, ge=1, le=200),
    principal: Principal = Depends(get_current_principal),
    session: AsyncSession = Depends(get_db),
) -> list[MentionRead]:
    await _bind(session, principal)
    statement = (
        select(Mention, SentimentScore, County, Constituency, Ward)
        .join(SentimentScore, SentimentScore.mention_id == Mention.id)
        .outerjoin(County, County.id == Mention.county_id)
        .outerjoin(Constituency, Constituency.id == Mention.constituency_id)
        .outerjoin(Ward, Ward.id == Mention.ward_id)
        .where(Mention.tenant_id == principal.tenant_id)
        .order_by(Mention.collected_at.desc())
    )
    if county_code is not None:
        statement = statement.where(County.code == county_code)
    if constituency_code is not None:
        statement = statement.where(Constituency.code == constituency_code)
    if ward_code is not None:
        statement = statement.where(Ward.code == ward_code)
    statement = statement.limit(limit)
    rows = (await session.execute(statement)).all()
    return [
        MentionRead(
            id=mention.id,
            source=mention.source,
            author_handle=mention.author_handle,
            text=mention.text,
            language=mention.language,
            sheng_detected=mention.sheng_detected,
            engagement_count=mention.engagement_count,
            collected_at=mention.collected_at,
            county_code=county.code if county else None,
            county_name=county.name if county else None,
            constituency_code=constituency.code if constituency else None,
            constituency_name=constituency.name if constituency else None,
            ward_code=ward.code if ward else None,
            ward_name=ward.name if ward else None,
            score=score.score,
            sentiment="positive" if score.score > 0.15 else "negative" if score.score < -0.15 else "neutral",
            issue_axis=score.issue_axis,
        )
        for mention, score, county, constituency, ward in rows
    ]


@router.get("/county-map", response_model=list[CountySentiment])
async def county_map(
    window_hours: int = Query(default=24, ge=1, le=720),
    principal: Principal = Depends(get_current_principal),
    session: AsyncSession = Depends(get_db),
) -> list[CountySentiment]:
    await _bind(session, principal)
    cutoff = datetime.now(UTC) - timedelta(hours=window_hours)
    sentiment_subquery = (
        select(
            Mention.county_id.label("county_id"),
            func.count(SentimentScore.id).label("mentions"),
            func.avg(SentimentScore.score).label("net"),
        )
        .join(SentimentScore, SentimentScore.mention_id == Mention.id)
        .where(Mention.tenant_id == principal.tenant_id, Mention.collected_at >= cutoff)
        .group_by(Mention.county_id)
        .subquery()
    )
    alert_subquery = (
        select(Alert.county_id.label("county_id"), func.max(Alert.severity).label("threat"))
        .where(Alert.tenant_id == principal.tenant_id, Alert.status.in_(["open", "acknowledged"]))
        .group_by(Alert.county_id)
        .subquery()
    )
    rows = (
        await session.execute(
            select(
                County,
                func.coalesce(sentiment_subquery.c.mentions, 0),
                func.coalesce(sentiment_subquery.c.net, 0.0),
                func.coalesce(alert_subquery.c.threat, 1),
            )
            .outerjoin(sentiment_subquery, sentiment_subquery.c.county_id == County.id)
            .outerjoin(alert_subquery, alert_subquery.c.county_id == County.id)
            .order_by(County.code)
        )
    ).all()
    return [
        CountySentiment(
            county=CountyRead.model_validate(county),
            mentions=int(mentions),
            net_sentiment=round(float(net), 4),
            threat_level=int(threat),
        )
        for county, mentions, net, threat in rows
    ]

