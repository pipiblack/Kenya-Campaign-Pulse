import base64
import hashlib
import hmac
import os
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

import jwt
from fastapi import Depends, Header, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError

from config import settings

bearer_scheme = HTTPBearer(auto_error=False)
PBKDF2_ITERATIONS = 390_000


@dataclass(frozen=True, slots=True)
class Principal:
    user_id: UUID
    tenant_id: UUID
    role: str
    email: str


def hash_password(password: str, *, salt: bytes | None = None) -> str:
    salt = salt or os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ITERATIONS)
    return "pbkdf2_sha256${}${}${}".format(
        PBKDF2_ITERATIONS,
        base64.urlsafe_b64encode(salt).decode().rstrip("="),
        base64.urlsafe_b64encode(digest).decode().rstrip("="),
    )


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, iterations_text, salt_text, digest_text = encoded.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        salt = base64.urlsafe_b64decode(salt_text + "=" * (-len(salt_text) % 4))
        expected = base64.urlsafe_b64decode(digest_text + "=" * (-len(digest_text) % 4))
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, int(iterations_text))
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def create_access_token(principal: Principal) -> tuple[str, int]:
    expires_delta = timedelta(minutes=settings.access_token_minutes)
    now = datetime.now(UTC)
    payload = {
        "sub": str(principal.user_id),
        "tenant_id": str(principal.tenant_id),
        "role": principal.role,
        "email": principal.email,
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm), int(expires_delta.total_seconds())


def decode_access_token(token: str) -> Principal:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return Principal(
            user_id=UUID(payload["sub"]),
            tenant_id=UUID(payload["tenant_id"]),
            role=str(payload.get("role", "viewer")),
            email=str(payload.get("email", "")),
        )
    except (InvalidTokenError, KeyError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired access token") from exc


def demo_principal() -> Principal:
    return Principal(
        user_id=UUID("20000000-0000-4000-8000-000000000001"),
        tenant_id=UUID(settings.demo_tenant_id),
        role="admin",
        email="demo@pulse.ke",
    )


async def get_current_principal(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    x_tenant_id: str | None = Header(default=None),
    access_token: str | None = Query(default=None, alias="token"),
) -> Principal:
    token = credentials.credentials if credentials else access_token
    if token:
        return decode_access_token(token)
    if settings.allow_demo_access:
        principal = demo_principal()
        if x_tenant_id and x_tenant_id != str(principal.tenant_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Demo mode is restricted to the demo tenant")
        return principal
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")


def require_operator(principal: Principal = Depends(get_current_principal)) -> Principal:
    if principal.role not in {"admin", "analyst", "operator"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Operator role required")
    return principal

