from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import Boolean, CheckConstraint, DateTime, Float, ForeignKey, Index, Integer, SmallInteger, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class Tenant(Base, TimestampMixin):
    __tablename__ = "tenants"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    slug: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    plan: Mapped[str] = mapped_column(String(40), default="pilot", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class User(Base, TimestampMixin):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("tenant_id", "email", name="uq_users_tenant_email"),)

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    tenant_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    full_name: Mapped[str] = mapped_column(String(160), nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(String(32), default="viewer", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class County(Base):
    __tablename__ = "counties"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True)
    code: Mapped[int] = mapped_column(SmallInteger, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    centroid_lat: Mapped[float | None] = mapped_column(Float)
    centroid_lng: Mapped[float | None] = mapped_column(Float)

    constituencies: Mapped[list["Constituency"]] = relationship(back_populates="county")


class Constituency(Base):
    __tablename__ = "constituencies"
    __table_args__ = (UniqueConstraint("county_id", "name", name="uq_constituencies_county_name"),)

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True)
    county_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("counties.id", ondelete="RESTRICT"), index=True)
    code: Mapped[int] = mapped_column(SmallInteger, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), nullable=False)

    county: Mapped[County] = relationship(back_populates="constituencies")
    wards: Mapped[list["Ward"]] = relationship(back_populates="constituency")


class Ward(Base):
    __tablename__ = "wards"
    __table_args__ = (UniqueConstraint("constituency_id", "name", name="uq_wards_constituency_name"),)

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True)
    constituency_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("constituencies.id", ondelete="RESTRICT"), index=True)
    code: Mapped[int] = mapped_column(SmallInteger, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(140), nullable=False)
    slug: Mapped[str] = mapped_column(String(140), nullable=False)

    constituency: Mapped[Constituency] = relationship(back_populates="wards")


class Mention(Base):
    __tablename__ = "mentions"
    __table_args__ = (
        Index("ix_mentions_tenant_collected", "tenant_id", "collected_at"),
        Index("ix_mentions_tenant_county_collected", "tenant_id", "county_id", "collected_at"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    tenant_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    county_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("counties.id", ondelete="SET NULL"), index=True)
    constituency_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("constituencies.id", ondelete="SET NULL"))
    ward_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("wards.id", ondelete="SET NULL"))
    source: Mapped[str] = mapped_column(String(32), nullable=False)
    external_id: Mapped[str | None] = mapped_column(String(200))
    author_handle: Mapped[str | None] = mapped_column(String(160))
    text: Mapped[str] = mapped_column(Text, nullable=False)
    language: Mapped[str] = mapped_column(String(16), default="en", nullable=False)
    sheng_detected: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    engagement_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    collected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    raw_payload: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)

    scores: Mapped[list["SentimentScore"]] = relationship(back_populates="mention", cascade="all, delete-orphan")


class SentimentScore(Base):
    __tablename__ = "sentiment_scores"
    __table_args__ = (
        CheckConstraint("score BETWEEN -1 AND 1", name="ck_sentiment_score_range"),
        CheckConstraint("confidence BETWEEN 0 AND 1", name="ck_sentiment_confidence_range"),
        UniqueConstraint("mention_id", "issue_axis", name="uq_sentiment_mention_axis"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    tenant_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    mention_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("mentions.id", ondelete="CASCADE"), index=True)
    issue_axis: Mapped[str] = mapped_column(String(48), nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    model_version: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    mention: Mapped[Mention] = relationship(back_populates="scores")


class BotCluster(Base, TimestampMixin):
    __tablename__ = "bot_clusters"
    __table_args__ = (
        CheckConstraint("coordination_score BETWEEN 0 AND 1", name="ck_bot_coordination_range"),
        CheckConstraint("threat_level BETWEEN 1 AND 4", name="ck_bot_threat_range"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    tenant_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    county_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("counties.id", ondelete="SET NULL"))
    label: Mapped[str] = mapped_column(String(180), nullable=False)
    narrative: Mapped[str] = mapped_column(Text, nullable=False)
    coordination_score: Mapped[float] = mapped_column(Float, nullable=False)
    threat_level: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    account_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    evidence: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)


class Alert(Base, TimestampMixin):
    __tablename__ = "alerts"
    __table_args__ = (
        CheckConstraint("severity BETWEEN 1 AND 4", name="ck_alert_severity_range"),
        Index("ix_alerts_tenant_status_created", "tenant_id", "status", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    tenant_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    county_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("counties.id", ondelete="SET NULL"))
    bot_cluster_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("bot_clusters.id", ondelete="SET NULL"))
    severity: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(String(240), nullable=False)
    narrative: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="open", nullable=False)
    playbook: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list, nullable=False)
    acknowledged_by: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class VoicePoll(Base, TimestampMixin):
    __tablename__ = "voice_polls"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    tenant_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    county_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("counties.id", ondelete="SET NULL"))
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="draft", nullable=False)
    target_sample: Mapped[int] = mapped_column(Integer, nullable=False)
    completed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    calls_attempted: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    active_agents: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # active_agents: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    average_handle_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    quotas: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)


class SurveyResponse(Base):
    __tablename__ = "survey_responses"
    __table_args__ = (Index("ix_survey_responses_tenant_poll", "tenant_id", "poll_id"),)

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    tenant_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    poll_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("voice_polls.id", ondelete="CASCADE"))
    county_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("counties.id", ondelete="SET NULL"))
    ward_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("wards.id", ondelete="SET NULL"))
    respondent_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    answers: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    weight: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

