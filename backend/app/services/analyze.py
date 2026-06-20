"""ANALYZE — profiler + strategist merged (02 §4.1).

Builds the input from the DB, runs the LLM (or a deterministic demo fallback),
then persists: upsert profile, insert signals + extracted_actions, supersede the
prior pending recommendation and insert the new one, update the customer's
score/ghost_risk/next_action_at, and append score_history.
"""

from __future__ import annotations

import datetime as dt
import json
import logging
import uuid

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app import models, schemas
from app.services import loaders, prompts
from app.services.llm import DEMO_MODE, structured

logger = logging.getLogger("closeloop.analyze")


def _utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


# the only layers the UI groups by — the LLM occasionally invents others
# ("engagement", "interaction"), so we clamp to keep the contract honest.
_SIGNAL_LAYERS = {"motivation", "negotiation", "objection", "buying_signal"}


def _norm_layer(layer: str | None) -> str:
    return layer if layer in _SIGNAL_LAYERS else "negotiation"


async def run_analyze(
    db: AsyncSession, customer: models.Customer
) -> models.Recommendation:
    quote = await loaders.latest_quote(db, customer.id)
    profile = await loaders.current_profile(db, customer.id)
    interactions = await loaders.recent_interactions(db, customer.id)
    kb = await load_kb_safe(db)

    if DEMO_MODE:
        out = _demo_analyze(customer, quote, interactions, kb)
    else:
        payload = {
            "customer": {
                "name": customer.name,
                "language": customer.language,
                "stage": customer.stage,
                "last_contact_at": customer.last_contact_at.isoformat()
                if customer.last_contact_at
                else None,
            },
            "quote": loaders.quote_dict(quote),
            "existing_profile": loaders.profile_dict(profile),
            "interactions": loaders.interaction_dicts(interactions),
            "knowledge_base": kb,
        }
        try:
            out = await structured(
                system=prompts.ANALYZE_SYSTEM,
                user=json.dumps(payload, ensure_ascii=False, default=str),
                schema=schemas.AnalyzeOutput,
            )
        except Exception as err:  # noqa: BLE001 — never let a flaky call break the path
            logger.warning("ANALYZE LLM failed (%s); using DEMO fallback", err)
            out = _demo_analyze(customer, quote, interactions, kb)

    return await _persist(db, customer, out, interactions)


async def load_kb_safe(db: AsyncSession) -> dict:
    try:
        return await loaders.load_knowledge_base(db)
    except Exception:  # noqa: BLE001
        return {"buyer_types": [], "objections": [], "plays": [], "channel_priors": []}


# --------------------------------------------------------------------------- #
# Persistence
# --------------------------------------------------------------------------- #


async def _persist(
    db: AsyncSession,
    customer: models.Customer,
    out: schemas.AnalyzeOutput,
    interactions: list[models.Interaction],
) -> models.Recommendation:
    last_interaction_id = interactions[0].id if interactions else None

    # 1. upsert profile
    profile = await loaders.current_profile(db, customer.id)
    if profile is None:
        profile = models.Profile(customer_id=customer.id)
        db.add(profile)
    profile.motivation = out.profile.motivation
    profile.motivation_conf = out.profile.motivation_conf
    profile.buyer_type = out.profile.buyer_type
    profile.negotiation = out.profile.negotiation.model_dump()
    profile.summary = out.profile.summary
    profile.objections = [o.model_dump(exclude_none=True) for o in out.profile.objections]
    profile.completeness = out.profile.completeness

    # 2. fresh signals (replace prior set so the dashboard shows the current read)
    await db.execute(
        models.ProfileSignal.__table__.delete().where(
            models.ProfileSignal.customer_id == customer.id
        )
    )
    for s in out.signals:
        db.add(
            models.ProfileSignal(
                customer_id=customer.id,
                layer=_norm_layer(s.layer),
                label=s.label,
                evidence_quote=s.evidence_quote,
                source_interaction_id=last_interaction_id,
                confidence=s.confidence,
            )
        )

    # 3. extracted actions (append new open ones)
    for a in out.extracted_actions:
        db.add(
            models.ExtractedAction(
                customer_id=customer.id,
                interaction_id=last_interaction_id,
                type=a.type,
                detail=a.detail,
                due_at=a.due_at,
            )
        )

    # 4. supersede the prior pending recommendation, insert the new one
    await db.execute(
        update(models.Recommendation)
        .where(
            models.Recommendation.customer_id == customer.id,
            models.Recommendation.status == "pending",
        )
        .values(status="superseded", updated_at=_utcnow())
    )
    rec = models.Recommendation(
        customer_id=customer.id,
        channel=out.recommendation.channel,
        timing_at=out.recommendation.timing_at,
        timing_label=out.recommendation.timing_label,
        goal=out.recommendation.goal,
        rationale=out.recommendation.rationale,
        play_key=out.recommendation.play_key,
        priority=out.recommendation.priority,
        status="pending",
        created_by="analyze",
    )
    db.add(rec)

    # 5. update customer score / ghost risk / next action
    customer.sign_likelihood = out.score.sign_likelihood
    customer.ghost_risk = out.score.ghost_risk
    customer.next_action_at = out.recommendation.timing_at

    # 6. score history
    db.add(
        models.ScoreHistory(
            customer_id=customer.id,
            sign_likelihood=out.score.sign_likelihood,
            ghost_risk=out.score.ghost_risk,
            components=out.score.components.model_dump(),
            reason=out.score.reason,
        )
    )

    await db.commit()
    await db.refresh(rec)
    return rec


# --------------------------------------------------------------------------- #
# DEMO fallback — deterministic, keeps the golden path alive without OpenAI
# --------------------------------------------------------------------------- #

_OBJECTION_KEYWORDS = {
    "winter_yield": ["winter", "cloud", "sun in winter", "im winter"],
    "need_other_quotes": ["other quote", "other compan", "compar", "andere angebote", "vergleich"],
    "price_too_high": ["expensive", "a lot of money", "cost", "teuer", "preis"],
    "spouse": ["wife", "husband", "spouse", "partner", "frau", "mann"],
}

_MOTIVATION_KEYWORDS = {
    "savings": ["save", "saving", "bill", "money", "sparen", "rechnung"],
    "environment": ["environment", "co2", "green", "climate", "umwelt", "klima"],
    "independence": ["independ", "grid", "self-suffic", "autark", "unabhängig"],
    "peace_of_mind": ["peace", "reliab", "worry", "secure", "sicher"],
}


def _all_text(interactions: list[models.Interaction]) -> str:
    parts: list[str] = []
    for i in interactions:
        parts += [i.transcript_md or "", i.content or "", i.outcome or "", i.rep_gut_feel or ""]
    return "\n".join(parts).lower()


def _find_quote(interactions: list[models.Interaction], needle: str) -> str | None:
    for i in interactions:
        text = i.transcript_md or i.content or ""
        for line in text.splitlines():
            if needle.lower() in line.lower():
                return line.strip().lstrip("*").strip().lstrip("-").strip()
    return None


def _demo_analyze(
    customer: models.Customer,
    quote: models.Quote | None,
    interactions: list[models.Interaction],
    kb: dict,
) -> schemas.AnalyzeOutput:
    text = _all_text(interactions)

    objections: list[schemas.ObjectionRef] = []
    signals: list[schemas.AnalyzeSignal] = []
    for key, kws in _OBJECTION_KEYWORDS.items():
        hit = next((kw for kw in kws if kw in text), None)
        if hit:
            objections.append(schemas.ObjectionRef(key=key))
            signals.append(
                schemas.AnalyzeSignal(
                    layer="objection",
                    label=f"{key} surfaced",
                    evidence_quote=_find_quote(interactions, hit),
                    confidence=0.8,
                )
            )

    motivation = next(
        (m for m, kws in _MOTIVATION_KEYWORDS.items() if any(k in text for k in kws)),
        "peace_of_mind",
    )

    multi_quote = "high" if any(o.key == "need_other_quotes" for o in objections) else "low"
    spouse_blocker = ["spouse_buy_in"] if any(o.key == "spouse" for o in objections) else []
    negotiation = schemas.Negotiation(
        multi_quote_risk=multi_quote,
        price_sensitivity="medium" if any(o.key == "price_too_high" for o in objections) else "low",
        decision_speed="slow" if spouse_blocker else "fast",
        decision_makers=["husband", "wife"] if spouse_blocker else [],
        blockers=spouse_blocker,
        buying_signals=[],
    )
    signals.insert(
        0,
        schemas.AnalyzeSignal(
            layer="motivation",
            label=f"motivation: {motivation}",
            evidence_quote=_find_quote(interactions, "save") or _find_quote(interactions, "winter"),
            confidence=0.7,
        ),
    )

    # buyer type heuristic
    if spouse_blocker:
        buyer_type = "family"
    elif "return" in text or "invest" in text:
        buyer_type = "investor"
    elif motivation == "environment":
        buyer_type = "environmentalist"
    elif objections:
        buyer_type = "skeptic"
    else:
        buyer_type = "family"

    # score: start mid, penalise objections, reward engagement (any interaction)
    engagement = 0.6 if interactions else 0.2
    objection_severity = max(0.2, 1 - 0.2 * len(objections))
    buying_signals = 0.2
    days_silent = 0
    if customer.last_contact_at:
        days_silent = (_utcnow() - customer.last_contact_at).days
    recency = max(0.1, 1 - days_silent / 14)
    raw = 0.35 * engagement + 0.25 * objection_severity + 0.2 * buying_signals + 0.2 * recency
    sign = int(round(raw * 100))
    ghost = "high" if days_silent >= 10 else "medium" if days_silent >= 5 else "low"

    # recommendation: trust play for family w/ multi-quote risk, else KB prior
    if buyer_type == "family" and multi_quote == "high":
        rec = schemas.AnalyzeRecommendation(
            channel="visit",
            timing_label="within 48h",
            timing_at=_utcnow() + dt.timedelta(days=2),
            goal="Build trust and address spouse buy-in before competing quotes land",
            rationale=(
                "Family + commitment-shy + multi-quote risk HIGH → trust beats reach. "
                "A home visit converts this type better than email; speed matters "
                "because competing quotes are in play."
            ),
            play_key="home_visit_trust",
            priority=90,
        )
    else:
        rec = schemas.AnalyzeRecommendation(
            channel="whatsapp",
            timing_label="within 48h",
            timing_at=_utcnow() + dt.timedelta(days=2),
            goal="Re-open the conversation and resolve the open objection",
            rationale=(
                f"{buyer_type} with {'an open objection' if objections else 'no hard blockers'}; "
                "a warm, low-pressure nudge on the channel they respond to keeps the deal moving "
                "without applying pressure."
            ),
            play_key=None,
            priority=60,
        )

    summary_bits = [buyer_type]
    if multi_quote == "high":
        summary_bits.append("comparing other quotes")
    if spouse_blocker:
        summary_bits.append("spouse not yet aligned")
    if any(o.key == "winter_yield" for o in objections):
        summary_bits.append("winter-yield doubt")
    summary = ", ".join(summary_bits).capitalize() + "."

    return schemas.AnalyzeOutput(
        profile=schemas.AnalyzeProfile(
            motivation=motivation,
            motivation_conf=0.7,
            buyer_type=buyer_type,
            negotiation=negotiation,
            summary=summary,
            objections=objections,
            completeness=70 if interactions else 30,
        ),
        signals=signals,
        extracted_actions=_demo_actions(interactions),
        score=schemas.AnalyzeScore(
            sign_likelihood=sign,
            ghost_risk=ghost,
            components=schemas.ScoreComponents(
                engagement=engagement,
                objection_severity=objection_severity,
                buying_signals=buying_signals,
                recency=recency,
            ),
            reason=(
                f"{'Engaged on the call' if interactions else 'No contact yet'}; "
                f"{len(objections)} open objection(s); "
                f"{'silent ' + str(days_silent) + 'd' if days_silent else 'recent contact'}."
            ),
        ),
        recommendation=rec,
    )


def _demo_actions(interactions: list[models.Interaction]) -> list[schemas.AnalyzeExtractedAction]:
    text = _all_text(interactions)
    actions: list[schemas.AnalyzeExtractedAction] = []
    if "call" in text and ("back" in text or "zurück" in text or "tue" in text or "5" in text):
        actions.append(
            schemas.AnalyzeExtractedAction(
                type="callback",
                detail="Customer asked for a callback — see transcript for timing",
                due_at=_utcnow() + dt.timedelta(days=1),
            )
        )
    return actions
