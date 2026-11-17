from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db, set_tenant_context
from app.core.security import Principal, get_current_principal, require_operator
from app.models.domain import Alert, County
from app.models.schemas import AlertActionRequest, AlertRead
from app.services.sse_broadcaster import sse_broadcaster

router = APIRouter()


def _read(alert: Alert, county: County | None) -> AlertRead:
    return AlertRead(
        id=alert.id,
        county_code=county.code if county else None,
        county_name=county.name if county else None,
        severity=alert.severity,
        category=alert.category,
        title=alert.title,
        narrative=alert.narrative,
        status=alert.status,
        playbook=alert.playbook,
        created_at=alert.created_at,
    )


@router.get("", response_model=list[AlertRead])
async def list_alerts(
    alert_status: str | None = Query(default=None, alias="status"),
    county_code: int | None = Query(default=None, ge=1, le=47),
    minimum_severity: int = Query(default=1, ge=1, le=4),
    limit: int = Query(default=50, ge=1, le=200),
    principal: Principal = Depends(get_current_principal),
    session: AsyncSession = Depends(get_db),
) -> list[AlertRead]:
    await set_tenant_context(session, principal.tenant_id)
    statement = (
        select(Alert, County)
        .outerjoin(County, County.id == Alert.county_id)
        .where(Alert.tenant_id == principal.tenant_id, Alert.severity >= minimum_severity)
        .order_by(Alert.created_at.desc())
        .limit(limit)
    )
    if alert_status:
        statement = statement.where(Alert.status == alert_status)
    if county_code is not None:
        statement = statement.where(County.code == county_code)
    return [_read(alert, county) for alert, county in (await session.execute(statement)).all()]


@router.patch("/{alert_id}", response_model=AlertRead)
async def act_on_alert(
    alert_id: UUID,
    payload: AlertActionRequest,
    principal: Principal = Depends(require_operator),
    session: AsyncSession = Depends(get_db),
) -> AlertRead:
    await set_tenant_context(session, principal.tenant_id)
    row = (
        await session.execute(
            select(Alert, County)
            .outerjoin(County, County.id == Alert.county_id)
            .where(Alert.id == alert_id, Alert.tenant_id == principal.tenant_id)
            .with_for_update()
        )
    ).one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    alert, county = row
    now = datetime.now(UTC)
    if payload.action == "acknowledge":
        alert.status = "acknowledged"
        alert.acknowledged_by = principal.user_id
        alert.acknowledged_at = now
    elif payload.action == "resolve":
        alert.status = "resolved"
        alert.resolved_at = now
    else:
        alert.status = "open"
        alert.resolved_at = None
    await session.commit()
    response = _read(alert, county)
    await sse_broadcaster.publish(principal.tenant_id, "alert.updated", response.model_dump(mode="json"))
    return response

