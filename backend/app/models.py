"""SQLAlchemy ORM models — mirror 01-data-schema.md exactly.

Status fields are plain text with allowed values documented in comments
(not native enums — easier to evolve in a hackathon).
"""

from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import (
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, TIMESTAMP, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base

PK = lambda: mapped_column(  # noqa: E731
    UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
)


def _now() -> Mapped[dt.datetime]:
    return mapped_column(TIMESTAMP(timezone=True), server_default=func.now())


# --------------------------------------------------------------------------- #
# A. OPERATIONAL TABLES
# --------------------------------------------------------------------------- #


class Rep(Base):
    __tablename__ = "reps"

    id: Mapped[uuid.UUID] = PK()
    name: Mapped[str] = mapped_column(Text, nullable=False)
    email: Mapped[str | None] = mapped_column(Text)
    strengths: Mapped[dict] = mapped_column(JSONB, server_default="{}")
    stats: Mapped[dict] = mapped_column(JSONB, server_default="{}")
    created_at: Mapped[dt.datetime] = _now()


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[uuid.UUID] = PK()
    name: Mapped[str] = mapped_column(Text, nullable=False)
    email: Mapped[str | None] = mapped_column(Text)
    phone: Mapped[str | None] = mapped_column(Text)
    address: Mapped[dict] = mapped_column(JSONB, server_default="{}")
    language: Mapped[str] = mapped_column(Text, server_default="de")
    # imported|quoted|contacted|in_progress|won|lost
    stage: Mapped[str] = mapped_column(Text, server_default="quoted")
    assigned_rep_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("reps.id")
    )
    assignment_reason: Mapped[str | None] = mapped_column(Text)
    sign_likelihood: Mapped[int | None] = mapped_column(Integer)  # 0..100
    ghost_risk: Mapped[str | None] = mapped_column(Text)  # low|medium|high
    last_contact_at: Mapped[dt.datetime | None] = mapped_column(TIMESTAMP(timezone=True))
    next_action_at: Mapped[dt.datetime | None] = mapped_column(TIMESTAMP(timezone=True))
    consent_voice: Mapped[bool] = mapped_column(server_default="false")
    consent_marketing: Mapped[bool] = mapped_column(server_default="false")
    source: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[dt.datetime] = _now()
    updated_at: Mapped[dt.datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (Index("ix_customers_sign_likelihood", sign_likelihood.desc()),)


class Quote(Base):
    __tablename__ = "quotes"

    id: Mapped[uuid.UUID] = PK()
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False
    )
    system_size_kwp: Mapped[float | None] = mapped_column(Numeric)
    battery_kwh: Mapped[float | None] = mapped_column(Numeric)
    product_summary: Mapped[str | None] = mapped_column(Text)
    price_eur: Mapped[float | None] = mapped_column(Numeric)
    monthly_saving_eur: Mapped[float | None] = mapped_column(Numeric)
    payback_years: Mapped[float | None] = mapped_column(Numeric)
    annual_return_pct: Mapped[float | None] = mapped_column(Numeric)
    co2_tons_25y: Mapped[float | None] = mapped_column(Numeric)
    financing: Mapped[dict | None] = mapped_column(JSONB)
    pdf_url: Mapped[str | None] = mapped_column(Text)
    sent_at: Mapped[dt.datetime | None] = mapped_column(TIMESTAMP(timezone=True))
    created_at: Mapped[dt.datetime] = _now()


class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[uuid.UUID] = PK()
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    # savings|environment|independence|peace_of_mind|mixed
    motivation: Mapped[str | None] = mapped_column(Text)
    motivation_conf: Mapped[float | None] = mapped_column(Numeric)  # 0..1
    negotiation: Mapped[dict] = mapped_column(JSONB, server_default="{}")
    # family|investor|environmentalist|skeptic
    buyer_type: Mapped[str | None] = mapped_column(Text)
    summary: Mapped[str | None] = mapped_column(Text)
    objections: Mapped[list] = mapped_column(JSONB, server_default="[]")
    completeness: Mapped[int] = mapped_column(Integer, server_default="0")  # 0..100
    updated_at: Mapped[dt.datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ProfileSignal(Base):
    __tablename__ = "profile_signals"

    id: Mapped[uuid.UUID] = PK()
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False
    )
    # motivation|negotiation|objection|buying_signal
    layer: Mapped[str] = mapped_column(Text, nullable=False)
    label: Mapped[str] = mapped_column(Text, nullable=False)
    evidence_quote: Mapped[str | None] = mapped_column(Text)
    source_interaction_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("interactions.id")
    )
    confidence: Mapped[float | None] = mapped_column(Numeric)
    created_at: Mapped[dt.datetime] = _now()


class Interaction(Base):
    __tablename__ = "interactions"

    id: Mapped[uuid.UUID] = PK()
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False
    )
    rep_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("reps.id")
    )  # null = AI / voice agent
    # voice_ai|phone|email|sms|whatsapp|visit|system
    channel: Mapped[str] = mapped_column(Text, nullable=False)
    direction: Mapped[str] = mapped_column(Text, nullable=False)  # inbound|outbound
    occurred_at: Mapped[dt.datetime] = _now()
    content: Mapped[str | None] = mapped_column(Text)
    transcript_md: Mapped[str | None] = mapped_column(Text)
    transcript_raw: Mapped[dict | None] = mapped_column(JSONB)
    recording_url: Mapped[str | None] = mapped_column(Text)
    outcome: Mapped[str | None] = mapped_column(Text)
    rep_gut_feel: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[str] = mapped_column(Text, server_default="system")
    created_at: Mapped[dt.datetime] = _now()

    __table_args__ = (
        Index("ix_interactions_customer_occurred", "customer_id", occurred_at.desc()),
    )


class ExtractedAction(Base):
    __tablename__ = "extracted_actions"

    id: Mapped[uuid.UUID] = PK()
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False
    )
    interaction_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("interactions.id")
    )
    type: Mapped[str] = mapped_column(Text, nullable=False)  # callback|send_info|schedule_visit|hook|other
    detail: Mapped[str] = mapped_column(Text, nullable=False)
    due_at: Mapped[dt.datetime | None] = mapped_column(TIMESTAMP(timezone=True))
    status: Mapped[str] = mapped_column(Text, server_default="open")  # open|done|dismissed
    # Cadence provenance (Part 3 of the objection playbook): a co-pilot "advance
    # hook" becomes a to-do here, carrying its channel + why so it feeds Cadence.
    source: Mapped[str] = mapped_column(Text, server_default="analyze")  # analyze|copilot
    channel: Mapped[str | None] = mapped_column(Text)  # the hook's channel
    why: Mapped[str | None] = mapped_column(Text)  # why this next step
    created_at: Mapped[dt.datetime] = _now()


class Recommendation(Base):
    __tablename__ = "recommendations"

    id: Mapped[uuid.UUID] = PK()
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False
    )
    channel: Mapped[str] = mapped_column(Text, nullable=False)  # email|sms|whatsapp|phone|visit
    timing_at: Mapped[dt.datetime | None] = mapped_column(TIMESTAMP(timezone=True))
    timing_label: Mapped[str | None] = mapped_column(Text)
    goal: Mapped[str | None] = mapped_column(Text)
    rationale: Mapped[str] = mapped_column(Text, nullable=False)  # the WHY
    play_key: Mapped[str | None] = mapped_column(Text)
    priority: Mapped[int] = mapped_column(Integer, server_default="0")
    # pending|approved|composing|ready|sent|dismissed|superseded
    status: Mapped[str] = mapped_column(Text, server_default="pending")
    created_by: Mapped[str] = mapped_column(Text, server_default="analyze")
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("reps.id")
    )
    approved_at: Mapped[dt.datetime | None] = mapped_column(TIMESTAMP(timezone=True))
    created_at: Mapped[dt.datetime] = _now()
    updated_at: Mapped[dt.datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        Index(
            "ix_recommendations_customer_status_priority",
            "customer_id",
            "status",
            priority.desc(),
        ),
    )


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = PK()
    recommendation_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("recommendations.id", ondelete="CASCADE")
    )
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False
    )
    channel: Mapped[str] = mapped_column(Text, nullable=False)
    subject: Mapped[str | None] = mapped_column(Text)  # email only
    body: Mapped[str] = mapped_column(Text, nullable=False)
    language: Mapped[str] = mapped_column(Text, server_default="de")
    status: Mapped[str] = mapped_column(Text, server_default="draft")  # draft|edited|sent
    sent_at: Mapped[dt.datetime | None] = mapped_column(TIMESTAMP(timezone=True))
    created_at: Mapped[dt.datetime] = _now()


class ScoreHistory(Base):
    __tablename__ = "score_history"

    id: Mapped[uuid.UUID] = PK()
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False
    )
    sign_likelihood: Mapped[int | None] = mapped_column(Integer)
    ghost_risk: Mapped[str | None] = mapped_column(Text)
    components: Mapped[dict | None] = mapped_column(JSONB)
    reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[dt.datetime] = _now()


class Outcome(Base):
    __tablename__ = "outcomes"

    id: Mapped[uuid.UUID] = PK()
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False
    )
    recommendation_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("recommendations.id")
    )
    # replied_positive|replied_negative|no_response|meeting_booked|won|lost
    result: Mapped[str] = mapped_column(Text, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[dt.datetime] = _now()


# --------------------------------------------------------------------------- #
# B. KNOWLEDGE BASE (seeded reference data)
# --------------------------------------------------------------------------- #


class KBBuyerType(Base):
    __tablename__ = "kb_buyer_types"

    id: Mapped[uuid.UUID] = PK()
    key: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    fears: Mapped[list | None] = mapped_column(JSONB)
    motivators: Mapped[list | None] = mapped_column(JSONB)
    default_tone: Mapped[str | None] = mapped_column(Text)
    recommended_channels: Mapped[list | None] = mapped_column(JSONB)
    talking_points: Mapped[list | None] = mapped_column(JSONB)


class KBObjection(Base):
    __tablename__ = "kb_objections"

    id: Mapped[uuid.UUID] = PK()
    key: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    customer_phrasings: Mapped[list | None] = mapped_column(JSONB)
    read: Mapped[str | None] = mapped_column(Text)
    reframe_strategy: Mapped[str | None] = mapped_column(Text)
    do_list: Mapped[list | None] = mapped_column(JSONB)
    dont_list: Mapped[list | None] = mapped_column(JSONB)
    exact_lines: Mapped[list | None] = mapped_column(JSONB)
    applies_to: Mapped[list | None] = mapped_column(JSONB)
    # Objection playbook (Layer 1 — the fixed sales skeleton RESPOND reasons against)
    category: Mapped[str | None] = mapped_column(Text)  # human label, e.g. "Price / value gap"
    root_read: Mapped[str | None] = mapped_column(Text)  # the deeper read behind the words
    advance_hook: Mapped[str | None] = mapped_column(Text)  # the next-step offer template
    red_lines: Mapped[list | None] = mapped_column(JSONB)  # trust-breaking moves to avoid
    why_line: Mapped[str | None] = mapped_column(Text)  # canonical why-line (fixed template)
    demo_core: Mapped[bool] = mapped_column(server_default="false")  # build-for-the-demo flag


class KBPlay(Base):
    __tablename__ = "kb_plays"

    id: Mapped[uuid.UUID] = PK()
    key: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    name: Mapped[str | None] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    when_to_use: Mapped[str | None] = mapped_column(Text)
    channel: Mapped[str | None] = mapped_column(Text)
    buyer_types: Mapped[list | None] = mapped_column(JSONB)
    success_rate: Mapped[float | None] = mapped_column(Numeric)


class KBChannelPrior(Base):
    __tablename__ = "kb_channel_priors"

    id: Mapped[uuid.UUID] = PK()
    buyer_type: Mapped[str | None] = mapped_column(Text)
    stage: Mapped[str | None] = mapped_column(Text)
    best_channel: Mapped[str | None] = mapped_column(Text)
    best_timing: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)


class KBCadenceTemplate(Base):
    __tablename__ = "kb_cadence_templates"

    id: Mapped[uuid.UUID] = PK()
    buyer_type: Mapped[str | None] = mapped_column(Text)
    name: Mapped[str | None] = mapped_column(Text)
    steps: Mapped[list | None] = mapped_column(JSONB)


# --------------------------------------------------------------------------- #
# C. REAL-TIME CO-PILOT (WhatsApp) — a persisted RESPOND suggestion for an
#    inbound customer message, so the rep UI can show + replay it.
# --------------------------------------------------------------------------- #


class CopilotSuggestion(Base):
    __tablename__ = "copilot_suggestions"

    id: Mapped[uuid.UUID] = PK()
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False
    )
    interaction_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("interactions.id")
    )
    utterance: Mapped[str | None] = mapped_column(Text)
    read: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(Text)
    exact_lines: Mapped[list | None] = mapped_column(JSONB)
    why: Mapped[str | None] = mapped_column(Text)
    advance_hook: Mapped[str | None] = mapped_column(Text)
    todo: Mapped[dict | None] = mapped_column(JSONB)
    channel: Mapped[str] = mapped_column(Text, server_default="whatsapp")
    status: Mapped[str] = mapped_column(Text, server_default="new")  # new|sent|dismissed
    created_at: Mapped[dt.datetime] = _now()
