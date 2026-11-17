from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db, set_tenant_context
from app.core.security import Principal, get_current_principal
from app.models.domain import VoicePoll
from app.models.schemas import VoiceMetrics

router = APIRouter()


@router.get("/metrics", response_model=VoiceMetrics)
async def live_metrics(
    principal: Principal = Depends(get_current_principal),
    session: AsyncSession = Depends(get_db),
) -> VoiceMetrics:
    await set_tenant_context(session, principal.tenant_id)
    poll = (
        await session.execute(
            select(VoicePoll)
            .where(VoicePoll.tenant_id == principal.tenant_id, VoicePoll.status == "active")
            .order_by(VoicePoll.updated_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if poll is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active voice poll")
    return VoiceMetrics(
        poll_id=poll.id,
        poll_name=poll.name,
        status=poll.status,
        target_sample=poll.target_sample,
        completed=poll.completed,
        completion_rate=round(poll.completed / max(1, poll.target_sample), 4),
        calls_attempted=poll.calls_attempted,
        contact_rate=round(poll.completed / max(1, poll.calls_attempted), 4),
        active_agents=poll.active_agents,
        average_handle_seconds=poll.average_handle_seconds,
        quotas=poll.quotas,
    )

