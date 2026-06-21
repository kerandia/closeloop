"""Pydantic v2 schemas.

Two groups:
  - LLM contracts  (§4 of 02-backend-spec.md) — the strict JSON the reasoning
    services must produce. These are validated; the model retries on mismatch.
  - API schemas    — request bodies and response shapes for the REST layer (§3).
"""

from __future__ import annotations

import datetime as dt
import uuid

from pydantic import BaseModel, ConfigDict, Field

# --------------------------------------------------------------------------- #
# LLM CONTRACTS — ANALYZE (02 §4.1)
# --------------------------------------------------------------------------- #


class Negotiation(BaseModel):
    multi_quote_risk: str | None = None  # high|medium|low
    price_sensitivity: str | None = None  # high|medium|low
    decision_speed: str | None = None  # fast|slow
    decision_makers: list[str] = Field(default_factory=list)
    blockers: list[str] = Field(default_factory=list)
    buying_signals: list[str] = Field(default_factory=list)


class ObjectionRef(BaseModel):
    key: str
    note: str | None = None


class AnalyzeProfile(BaseModel):
    motivation: str | None = None  # savings|environment|independence|peace_of_mind|mixed
    motivation_conf: float | None = None
    buyer_type: str | None = None  # family|investor|environmentalist|skeptic
    negotiation: Negotiation = Field(default_factory=Negotiation)
    summary: str | None = None
    objections: list[ObjectionRef] = Field(default_factory=list)
    completeness: int = 0


class AnalyzeSignal(BaseModel):
    layer: str  # motivation|negotiation|objection|buying_signal
    label: str
    evidence_quote: str | None = None
    confidence: float | None = None


class AnalyzeExtractedAction(BaseModel):
    type: str  # callback|send_info|schedule_visit|other
    detail: str
    due_at: dt.datetime | None = None


class ScoreComponents(BaseModel):
    engagement: float | None = None
    objection_severity: float | None = None
    buying_signals: float | None = None
    recency: float | None = None


class AnalyzeScore(BaseModel):
    sign_likelihood: int  # 0..100
    ghost_risk: str  # low|medium|high
    components: ScoreComponents = Field(default_factory=ScoreComponents)
    reason: str


class AnalyzeRecommendation(BaseModel):
    channel: str  # email|sms|whatsapp|phone|visit
    timing_label: str | None = None
    timing_at: dt.datetime | None = None
    goal: str | None = None
    rationale: str
    play_key: str | None = None
    priority: int = 0


class AnalyzeOutput(BaseModel):
    """Strict ANALYZE result (profiler + strategist, merged)."""

    model_config = ConfigDict(extra="ignore")

    profile: AnalyzeProfile
    signals: list[AnalyzeSignal] = Field(default_factory=list)
    extracted_actions: list[AnalyzeExtractedAction] = Field(default_factory=list)
    score: AnalyzeScore
    recommendation: AnalyzeRecommendation


# --------------------------------------------------------------------------- #
# LLM CONTRACTS — COMPOSE (02 §4.2) & RESPOND (02 §4.3)
# --------------------------------------------------------------------------- #


class ComposeOutput(BaseModel):
    model_config = ConfigDict(extra="ignore")

    channel: str
    subject: str | None = None
    body: str
    language: str = "de"


class CopilotTodo(BaseModel):
    """The advance hook turned into a Cadence to-do (when · channel · why)."""

    detail: str  # the next-step line, e.g. "Send the monthly-savings one-pager"
    channel: str  # email|sms|whatsapp|phone|visit
    why: str  # why this next step now
    when_label: str | None = None  # "Wednesday", "within 48h"
    due_at: dt.datetime | None = None


class CallNotes(BaseModel):
    """Structured notes auto-extracted from a call transcript (Phase 3)."""

    model_config = ConfigDict(extra="ignore")

    summary: str
    key_points: list[str] = Field(default_factory=list)
    objections: list[str] = Field(default_factory=list)
    buying_signals: list[str] = Field(default_factory=list)
    next_steps: list[str] = Field(default_factory=list)


class RespondOutput(BaseModel):
    model_config = ConfigDict(extra="ignore")

    read: str
    type: str  # objection|buying_signal|question|other
    category: str | None = None  # matched playbook category key (kb_objections.key)
    tone: str
    exact_lines: list[str]
    why: str  # the why-line — fixed template: "Read as <cat> — <root read>. So <dir>, not <mistake>."
    # Part 3 of the playbook — handle the objection AND move the deal forward:
    advance_hook: str | None = None  # the next step to offer right after handling
    todo: CopilotTodo | None = None  # the hook persisted into Cadence
    # The stateful loop decision (vs the currently-open hook):
    #   advance            — they took the hook / are ready to move
    #   handle_new_concern — a new concern surfaced; drop the open hook, handle this, re-offer
    #   downgrade          — silence / non-committal; soften to a light to-do
    loop_action: str = "advance"


# --------------------------------------------------------------------------- #
# API — shared response fragments
# --------------------------------------------------------------------------- #


class ApiBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class RepBrief(ApiBase):
    id: uuid.UUID
    name: str


class NextAction(BaseModel):
    channel: str
    timing_label: str | None = None


class CustomerListItem(BaseModel):
    """Row in the ranked dashboard (GET /api/customers)."""

    id: uuid.UUID
    name: str
    buyer_type: str | None = None
    sign_likelihood: int | None = None
    score_trend: str | None = None  # up|down|flat — show as ↑/↓ (deal-score.md ②)
    ghost_risk: str | None = None
    stage: str
    next_action: NextAction | None = None
    assigned_rep: RepBrief | None = None
    last_contact_at: dt.datetime | None = None


class QuoteOut(ApiBase):
    id: uuid.UUID
    system_size_kwp: float | None = None
    battery_kwh: float | None = None
    product_summary: str | None = None
    price_eur: float | None = None
    monthly_saving_eur: float | None = None
    payback_years: float | None = None
    annual_return_pct: float | None = None
    co2_tons_25y: float | None = None
    financing: dict | None = None
    pdf_url: str | None = None
    sent_at: dt.datetime | None = None


class ProfileOut(ApiBase):
    id: uuid.UUID
    motivation: str | None = None
    motivation_conf: float | None = None
    negotiation: dict = {}
    buyer_type: str | None = None
    summary: str | None = None
    objections: list = []
    completeness: int = 0
    updated_at: dt.datetime | None = None


class SignalOut(ApiBase):
    id: uuid.UUID
    layer: str
    label: str
    evidence_quote: str | None = None
    source_interaction_id: uuid.UUID | None = None
    confidence: float | None = None


class InteractionOut(ApiBase):
    id: uuid.UUID
    rep_id: uuid.UUID | None = None
    channel: str
    direction: str
    occurred_at: dt.datetime | None = None
    content: str | None = None
    transcript_md: str | None = None
    recording_url: str | None = None
    outcome: str | None = None
    rep_gut_feel: str | None = None
    created_by: str


class ExtractedActionOut(ApiBase):
    id: uuid.UUID
    interaction_id: uuid.UUID | None = None
    type: str
    detail: str
    due_at: dt.datetime | None = None
    status: str
    source: str = "analyze"  # analyze|copilot
    channel: str | None = None
    why: str | None = None


class RecommendationOut(ApiBase):
    id: uuid.UUID
    channel: str
    timing_at: dt.datetime | None = None
    timing_label: str | None = None
    goal: str | None = None
    rationale: str
    play_key: str | None = None
    priority: int
    status: str


class CustomerOut(ApiBase):
    id: uuid.UUID
    name: str
    email: str | None = None
    phone: str | None = None
    address: dict = {}
    language: str
    stage: str
    sign_likelihood: int | None = None
    score_trend: str | None = None  # up|down|flat
    ghost_risk: str | None = None
    last_contact_at: dt.datetime | None = None
    next_action_at: dt.datetime | None = None
    consent_voice: bool
    consent_marketing: bool


class Assignment(BaseModel):
    rep: RepBrief | None = None
    reason: str | None = None


class CustomerDetail(BaseModel):
    """GET /api/customers/:id — the detail view payload."""

    customer: CustomerOut
    quote: QuoteOut | None = None
    profile: ProfileOut | None = None
    signals: list[SignalOut] = []
    interactions: list[InteractionOut] = []
    extracted_actions: list[ExtractedActionOut] = []
    recommendation: RecommendationOut | None = None
    assignment: Assignment | None = None


class MessageOut(ApiBase):
    id: uuid.UUID
    recommendation_id: uuid.UUID | None = None
    customer_id: uuid.UUID
    channel: str
    subject: str | None = None
    body: str
    language: str
    status: str
    sent_at: dt.datetime | None = None


# --------------------------------------------------------------------------- #
# API — request bodies
# --------------------------------------------------------------------------- #


class ImportQuote(BaseModel):
    customer_ref: str | None = None  # match key to a customer in the same import
    system_size_kwp: float | None = None
    battery_kwh: float | None = None
    product_summary: str | None = None
    price_eur: float | None = None
    monthly_saving_eur: float | None = None
    payback_years: float | None = None
    annual_return_pct: float | None = None
    co2_tons_25y: float | None = None
    financing: dict | None = None
    sent_at: dt.datetime | None = None


class ImportCustomer(BaseModel):
    ref: str | None = None  # optional client key for matching quotes
    name: str
    email: str | None = None
    phone: str | None = None
    address: dict | None = None
    language: str = "de"
    stage: str = "quoted"
    consent_voice: bool = False
    consent_marketing: bool = False
    source: str | None = None


class ImportRequest(BaseModel):
    customers: list[ImportCustomer] = []
    quotes: list[ImportQuote] = []


class ImportResponse(BaseModel):
    imported: int
    customer_ids: list[uuid.UUID] = []


class InteractionCreate(BaseModel):
    channel: str  # voice_ai|phone|email|sms|whatsapp|visit|system
    direction: str = "outbound"  # inbound|outbound
    content: str | None = None
    rep_gut_feel: str | None = None
    outcome: str | None = None
    transcript_md: str | None = None
    rep_id: uuid.UUID | None = None


class ScoreOut(BaseModel):
    sign_likelihood: int | None = None
    ghost_risk: str | None = None
    band: str | None = None  # cold|cool|warm|hot (deal-score.md Part 1)
    trend: str | None = None  # up|down|flat (Part 1 ②)
    components: dict | None = None
    reason: str | None = None


class ReanalyzeResponse(BaseModel):
    recommendation: RecommendationOut | None = None
    score: ScoreOut | None = None


class InteractionLogResponse(BaseModel):
    interaction: InteractionOut
    recommendation: RecommendationOut | None = None
    score: ScoreOut | None = None


class MessagePatch(BaseModel):
    subject: str | None = None
    body: str | None = None


class CopilotRespondRequest(BaseModel):
    customer_id: uuid.UUID
    utterance: str
    recent_context: str | None = None
    channel: str = "phone"  # the live channel this is happening on (call/visit)


class CollectResponse(BaseModel):
    question: str


class MessagingSendRequest(BaseModel):
    customer_id: uuid.UUID
    body: str
    channel: str = "whatsapp"  # whatsapp|sms
    suggestion_id: uuid.UUID | None = None  # mark this suggestion as sent


class MessagingDraftRequest(BaseModel):
    customer_id: uuid.UUID
    channel: str = "whatsapp"  # whatsapp|sms — compose the AI's opener for this channel


class OutcomeCreate(BaseModel):
    recommendation_id: uuid.UUID | None = None
    result: str  # replied_positive|replied_negative|no_response|meeting_booked|won|lost
    notes: str | None = None


# --------------------------------------------------------------------------- #
# Voice webhook (02 §6 / 04)
# --------------------------------------------------------------------------- #


class VoiceCollected(BaseModel):
    motivation_hint: str | None = None
    timeline: str | None = None
    hesitations: list[str] = Field(default_factory=list)
    comparing_competitors: bool | None = None
    decision_makers_mentioned: list[str] = Field(default_factory=list)
    callback_request: dict | None = None  # {wants_callback, when}
    sentiment: str | None = None
    handoff_reason: str | None = None


class VoiceWebhook(BaseModel):
    customer_id: uuid.UUID
    recording_url: str | None = None
    transcript_md: str
    transcript_raw: dict | None = None
    collected: VoiceCollected = Field(default_factory=VoiceCollected)
