from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

IssueAxis = Literal[
    "economy",
    "healthcare",
    "infrastructure",
    "corruption",
    "education",
    "youth_employment",
    "security",
    "local_leadership",
    "agriculture",
]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    tenant_slug: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    tenant_id: UUID
    user: dict[str, str]


class CountyRead(ORMModel):
    id: UUID
    code: int
    name: str
    slug: str


class ConstituencyRead(ORMModel):
    id: UUID
    county_id: UUID
    code: int
    name: str
    slug: str


class WardRead(ORMModel):
    id: UUID
    constituency_id: UUID
    code: int
    name: str
    slug: str


class MentionRead(BaseModel):
    id: UUID
    source: str
    author_handle: str | None
    text: str
    language: str
    sheng_detected: bool
    engagement_count: int
    collected_at: datetime
    county_code: int | None
    county_name: str | None
    constituency_code: int | None = None
    constituency_name: str | None = None
    ward_code: int | None = None
    ward_name: str | None = None
    score: float
    sentiment: Literal["positive", "neutral", "negative"]
    issue_axis: str


class AxisSummary(BaseModel):
    axis: str
    score: float
    volume: int


class SentimentSummary(BaseModel):
    total_mentions: int
    net_sentiment: float
    positive: int
    neutral: int
    negative: int
    window_hours: int
    axes: list[AxisSummary]


class CountySentiment(BaseModel):
    county: CountyRead
    mentions: int
    net_sentiment: float
    threat_level: int


class AlertRead(BaseModel):
    id: UUID
    county_code: int | None
    county_name: str | None
    severity: int
    category: str
    title: str
    narrative: str
    status: str
    playbook: list[dict[str, Any]]
    created_at: datetime


class AlertActionRequest(BaseModel):
    action: Literal["acknowledge", "resolve", "reopen"]


class VoiceMetrics(BaseModel):
    poll_id: UUID
    poll_name: str
    status: str
    target_sample: int
    completed: int
    completion_rate: float
    calls_attempted: int
    contact_rate: float
    active_agents: int
    average_handle_seconds: int
    quotas: dict[str, Any]


class CrisisInjectionRequest(BaseModel):
    county_code: int = Field(ge=1, le=47)
    constituency_code: int | None = Field(default=None, ge=1, le=290)
    ward_code: int | None = Field(default=None, ge=1, le=1450)
    scenario: Literal["cost_of_living", "healthcare_outage", "security_incident", "leadership_scandal"] = "cost_of_living"
    intensity: int = Field(default=75, ge=10, le=100)


class CrisisInjectionResponse(BaseModel):
    alert: AlertRead
    mentions_created: int
    event_id: UUID


class StreamEvent(BaseModel):
    id: UUID
    type: str
    tenant_id: UUID
    occurred_at: datetime
    data: dict[str, Any]


class NLPResult(BaseModel):
    language: Literal["en", "sw", "sheng"]
    sheng_detected: bool
    issue_axis: IssueAxis
    score: float = Field(ge=-1, le=1)
    confidence: float = Field(ge=0, le=1)
    matched_terms: list[str]

