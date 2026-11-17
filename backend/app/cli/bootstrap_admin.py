import asyncio
import os
import re
from uuid import UUID

from pydantic import EmailStr, TypeAdapter

from app.core.database import SessionFactory, engine
from app.core.security import hash_password
from app.models.domain import Tenant, User
from config import settings

ADMIN_USER_ID = UUID("20000000-0000-4000-8000-000000000001")
TENANT_SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def required_environment(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} is required")
    return value


async def bootstrap() -> None:
    tenant_id = UUID(settings.demo_tenant_id)
    tenant_name = required_environment("INITIAL_TENANT_NAME")
    tenant_slug = required_environment("INITIAL_TENANT_SLUG").lower()
    admin_name = required_environment("INITIAL_ADMIN_NAME")
    admin_email = str(TypeAdapter(EmailStr).validate_python(required_environment("INITIAL_ADMIN_EMAIL"))).lower()
    admin_password = required_environment("INITIAL_ADMIN_PASSWORD")

    if not TENANT_SLUG_PATTERN.fullmatch(tenant_slug):
        raise RuntimeError("INITIAL_TENANT_SLUG must contain lowercase letters, numbers and single hyphens only")
    if len(admin_password) < 16:
        raise RuntimeError("INITIAL_ADMIN_PASSWORD must be at least 16 characters")

    async with SessionFactory() as session:
        tenant = await session.get(Tenant, tenant_id)
        user = await session.get(User, ADMIN_USER_ID)
        if tenant is None or user is None:
            raise RuntimeError("The seeded tenant or administrator is missing; initialize PostgreSQL before bootstrapping")

        tenant.name = tenant_name
        tenant.slug = tenant_slug
        tenant.plan = "self-hosted"
        user.email = admin_email
        user.full_name = admin_name
        user.password_hash = hash_password(admin_password)
        user.role = "admin"
        user.is_active = True
        await session.commit()

    await engine.dispose()
    print(f"Administrator initialized for tenant '{tenant_slug}'.")


if __name__ == "__main__":
    asyncio.run(bootstrap())
