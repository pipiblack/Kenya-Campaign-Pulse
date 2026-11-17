from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db, set_tenant_context
from app.core.security import Principal, create_access_token, demo_principal, verify_password
from app.models.domain import Tenant, User
from app.models.schemas import LoginRequest, TokenResponse
from config import settings

router = APIRouter()


def _token_response(principal: Principal, full_name: str) -> TokenResponse:
    token, expires_in = create_access_token(principal)
    return TokenResponse(
        access_token=token,
        expires_in=expires_in,
        tenant_id=principal.tenant_id,
        user={"id": str(principal.user_id), "email": principal.email, "name": full_name, "role": principal.role},
    )


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, session: AsyncSession = Depends(get_db)) -> TokenResponse:
    tenant = (await session.execute(select(Tenant).where(Tenant.slug == payload.tenant_slug, Tenant.is_active.is_(True)))).scalar_one_or_none()
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid tenant or credentials")
    await set_tenant_context(session, tenant.id)
    user = (
        await session.execute(
            select(User).where(User.tenant_id == tenant.id, User.email == payload.email.lower(), User.is_active.is_(True))
        )
    ).scalar_one_or_none()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid tenant or credentials")
    principal = Principal(user_id=user.id, tenant_id=tenant.id, role=user.role, email=user.email)
    return _token_response(principal, user.full_name)


@router.post("/demo-token", response_model=TokenResponse)
async def demo_token() -> TokenResponse:
    if not settings.allow_demo_access:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Demo access is disabled")
    return _token_response(demo_principal(), "Pulse Demo Operator")

