from functools import lru_cache

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Pulse Kenya Intelligence API"
    app_version: str = "0.1.0"
    environment: str = "development"
    debug: bool = Field(default=False, validation_alias="PULSE_DEBUG")
    api_prefix: str = "/api/v1"
    database_url: str = "postgresql+asyncpg://pulse_app:pulse_dev_password@localhost:5432/pulse_kenya"
    redis_url: str = "redis://localhost:6379/0"
    jwt_secret: str = "local-development-secret-change-before-production"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 480
    allow_demo_access: bool = True
    demo_tenant_id: str = "10000000-0000-4000-8000-000000000001"
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])
    sse_heartbeat_seconds: int = 15

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_origins(cls, value: object) -> object:
        if isinstance(value, str) and not value.lstrip().startswith("["):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @model_validator(mode="after")
    def reject_unsafe_production_defaults(self) -> "Settings":
        if self.environment.lower() != "production":
            return self

        if self.allow_demo_access:
            raise ValueError("ALLOW_DEMO_ACCESS must be false in production")
        if len(self.jwt_secret) < 32 or self.jwt_secret == "local-development-secret-change-before-production":
            raise ValueError("JWT_SECRET must be a unique value of at least 32 characters in production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

