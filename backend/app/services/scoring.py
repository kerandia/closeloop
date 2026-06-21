"""Deal Score — event-sourced 0-100 close-likelihood (deal-score.md).

ONE score, not three: positive engagement pushes it up, silence/stalling pull it
down; Ghost Radar is just the low/falling end of the same score. The number
*moves* by fixed deltas as real events happen — it is not recomputed from
scratch. Every change is stored with its "why" (in `score_history`) so the UI can
explain it and show a trend.

All weights are LOCKED for the demo and live in this one config block (Part 4).
Event detection is rule-based (deterministic — demo-proof).
"""

from __future__ import annotations

import datetime as dt

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models

# --------------------------------------------------------------------------- #
# CONFIG (locked) — deal-score.md Parts 1-3
# --------------------------------------------------------------------------- #

START_SCORE = 45  # a new lead begins neutral, unproven

# event_key -> point delta. Positive = up (Part 2), negative = down (Part 3).
DELTAS: dict[str, int] = {
    # micro-commitments (the gold)
    "agree_home_visit": 18,
    "agree_call_meeting": 12,
    "take_hook": 8,
    "acknowledge_docs": 6,
    "showed_up": 10,
    # buying signals
    "ask_install_timeline": 15,
    "ask_financing": 12,
    "ask_logistics": 10,
    "bring_decision_maker": 15,
    "talks_when_not_whether": 8,
    # engagement / responsiveness
    "initiates_contact": 10,
    "replies_promptly": 3,
    "replies": 2,
    "opens_docs": 4,
    # sentiment / progress
    "positive_language": 5,
    "negative_language": -6,
    "objection_resolved": 5,
    "stage_up": 9,
    # disengagement / silence
    "silence_per_day": -4,
    "replies_slowing": -3,
    "stops_opening": -5,
    # stalling / resistance
    "new_objection_unresolved": -6,
    "reraise_objection": -5,
    "still_comparing": -5,
    "push_price_discount": -4,
    "competitor_favorable": -10,
    "decision_maker_absent": -5,
    # broken commitments
    "no_show": -20,
    "repeated_cancel": -12,
    "declines_next_step": -8,
    "no_rush": -15,
    # passive cooling
    "time_decay_per_day": -1,
}

# hard stops — the score crashes to 0 regardless of where it was
HARD_STOPS = {"went_competitor": "went with a competitor", "not_interested": "no longer interested"}

# bands → an action (Part 1 ①)
def band(score: int) -> str:
    if score >= 80:
        return "hot"
    if score >= 60:
        return "warm"
    if score >= 40:
        return "cool"
    return "cold"


# silence-tolerance windows per buyer type (Part 4): a commitment-shy family is
# naturally slower — don't write them off for the same silence as an investor.
SILENCE_TOLERANCE = {"family": 5, "investor": 2, "environmentalist": 4, "skeptic": 4}
DEFAULT_TOLERANCE = 3


def _utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def clamp(score: int) -> int:
    return max(0, min(100, score))


def ghost_risk(score: int, trend: str) -> str:
    """Ghost Radar = the alert end of the score. Low/falling → escalate."""
    b = band(score)
    if b == "cold":
        return "high"
    if b == "cool":
        return "high" if trend == "down" else "medium"
    return "low"


# --------------------------------------------------------------------------- #
# Event detection (rule-based, DE/EN) — deal-score.md Parts 2-3
# --------------------------------------------------------------------------- #

# ordered: hard stops first, then strong negatives, then the rest. Each entry:
# (event_key, why, [trigger keywords]). First matching keyword fires the event;
# each event type fires at most once per interaction (debounce, Part 4).
_RULES: list[tuple[str, str, list[str]]] = [
    # hard stops
    ("went_competitor", "went with a competitor",
     ["went with", "chose another", "signed with", "anderen anbieter", "competitor won"]),
    ("not_interested", "no longer interested",
     ["not interested", "no longer interested", "kein interesse", "nicht mehr interessiert"]),
    # broken commitments / strong negatives
    ("no_show", "no-show on an agreed call/visit",
     ["no-show", "no show", "didn't show", "did not show", "nicht erschienen"]),
    ("repeated_cancel", "cancelled / rescheduled",
     ["cancel", "reschedul", "verschoben", "abgesagt"]),
    ("no_rush", "timing stall — no rush / next year",
     ["no rush", "next year", "maybe later", "nächstes jahr", "kein eile", "keine eile"]),
    ("declines_next_step", "declined the proposed next step",
     ["declined", "doesn't want", "abgelehnt", "won't do"]),
    # resistance
    ("competitor_favorable", "spoke favorably about a competitor",
     ["quoted less", "cheaper elsewhere", "other company offered", "günstiger angeboten"]),
    ("push_price_discount", "pushing on price / wants a discount",
     ["discount", "too expensive", "rabatt", "günstiger", "come down on price"]),
    ("still_comparing", "still comparing, no forward motion",
     ["still comparing", "other quotes", "other companies", "andere angebote", "vergleich"]),
    ("decision_maker_absent", "decision-maker not yet aligned",
     ["not on board", "not convinced", "still need to ask", "hesitant", "nicht überzeugt", "zögert"]),
    # buying signals
    ("ask_install_timeline", "asked about install timing — planning it in",
     ["when can it be installed", "how long does it take", "install date", "wann installiert",
      "ready to move", "ready to sign", "let's do it", "want to proceed"]),
    ("ask_financing", "asked about financing — thinking how to pay",
     ["financing", "payment plan", "instalment", "installment", "finanzierung", "ratenzahlung"]),
    ("bring_decision_maker", "brought the decision-maker in",
     ["wife now on board", "husband on board", "we'll look together", "wife wants to sit in",
      "frau ist dabei", "gemeinsam ansehen", "wife on board", "both of us"]),
    # micro-commitments
    ("agree_home_visit", "agreed to a home visit — a real commitment",
     ["agreed to a visit", "agree to visit", "home visit", "site visit", "hausbesuch",
      "vorbeikommen", "komm vorbei"]),
    ("agree_call_meeting", "agreed to a call/meeting",
     ["agreed to a call", "book a call", "schedule a call", "termin vereinbart"]),
    ("acknowledge_docs", "acknowledged the docs we sent",
     ["got it", "received it", "had a look", "erhalten", "angeschaut"]),
    # sentiment / progress
    ("objection_resolved", "an objection was resolved",
     ["resolved", "convinced", "on board", "überzeugt", "sounds good", "klingt gut"]),
    ("negative_language", "negative sentiment / dissatisfaction",
     ["hate", "terrible", "awful", "useless", "frustrat", "angry", "annoyed",
      "disappointed", "not happy", "unhappy", "hasse", "schrecklich", "furchtbar",
      "enttäuscht", "wütend", "nervt", "ärgerlich", "schlecht", "mist", "blöd"]),
    ("positive_language", "positive sentiment",
     ["excited", "great", "perfect", "warm", "begeistert", "super", "freuen"]),
]

# events that already carry a sentiment polarity — used to decide whether the
# RESPOND read should add a fallback sentiment event (below).
_POS_EVENTS = {
    "positive_language", "objection_resolved", "ask_install_timeline", "ask_financing",
    "ask_logistics", "bring_decision_maker", "agree_home_visit", "agree_call_meeting",
    "acknowledge_docs", "talks_when_not_whether",
}
_NEG_EVENTS = {
    "negative_language", "new_objection_unresolved", "reraise_objection", "still_comparing",
    "push_price_discount", "competitor_favorable", "decision_maker_absent", "no_rush",
    "declines_next_step", "no_show", "repeated_cancel",
}


def detect_events(interaction: models.Interaction) -> list[tuple[str, str, int]]:
    """Return (event_key, why, delta) for an interaction. Deterministic."""
    text = " ".join(
        t for t in (
            interaction.content, interaction.outcome,
            interaction.rep_gut_feel, interaction.transcript_md,
        ) if t
    ).lower()

    events: list[tuple[str, str, int]] = []
    fired: set[str] = set()

    # a visit interaction means they actually showed up
    if interaction.channel == "visit" and "no_show" not in text:
        events.append(("showed_up", "showed up to the visit", DELTAS["showed_up"]))
        fired.add("showed_up")

    # the customer reached out themselves
    if interaction.direction == "inbound":
        events.append(("initiates_contact", "customer initiated contact", DELTAS["initiates_contact"]))
        fired.add("initiates_contact")

    for key, why, keywords in _RULES:
        if key in fired:
            continue
        if any(k in text for k in keywords):
            delta = 0 if key in HARD_STOPS else DELTAS[key]
            events.append((key, why, delta))
            fired.add(key)

    return events


# --------------------------------------------------------------------------- #
# Applying events → score + score_history (the explainable trail)
# --------------------------------------------------------------------------- #


async def _trend_from_history(db: AsyncSession, customer_id, lookback: int = 3) -> str:
    rows = (
        await db.execute(
            select(models.ScoreHistory)
            .where(models.ScoreHistory.customer_id == customer_id)
            .order_by(models.ScoreHistory.created_at.desc())
            .limit(lookback)
        )
    ).scalars().all()
    net = sum((r.components or {}).get("delta", 0) for r in rows)
    return "up" if net > 0 else "down" if net < 0 else "flat"


def _history_row(customer_id, score: int, ghost: str, key: str, why: str, delta: int):
    if key == "base":
        reason = f"start {score} — {why}"
    elif key in HARD_STOPS:
        reason = f"set to 0 — {why}"
    else:
        reason = f"{'+' if delta > 0 else ''}{delta}: {why}"
    return models.ScoreHistory(
        customer_id=customer_id,
        sign_likelihood=score,
        ghost_risk=ghost,
        components={"event": key, "delta": delta},
        reason=reason,
    )


async def _commit_events(
    db: AsyncSession, customer: models.Customer, score: int,
    events: list[tuple[str, str, int]],
) -> None:
    """Apply a sequence of (key, why, delta) to `score`, writing a trail."""
    rows = []
    for key, why, delta in events:
        score = 0 if key in HARD_STOPS else clamp(score + delta)
        # band is recomputed per step; trend is finalised after the loop
        rows.append(_history_row(customer.id, score, band(score), key, why, delta))
    customer.sign_likelihood = score
    for r in rows:
        db.add(r)
    await db.flush()
    trend = await _trend_from_history(db, customer.id)
    customer.ghost_risk = ghost_risk(score, trend)
    await db.commit()


def _days_silent(customer: models.Customer) -> int:
    if not customer.last_contact_at:
        return 0
    last = customer.last_contact_at
    if last.tzinfo is None:
        last = last.replace(tzinfo=dt.timezone.utc)
    return max(0, (_utcnow() - last).days)


def _tolerance(buyer_type: str | None) -> int:
    return SILENCE_TOLERANCE.get(buyer_type or "", DEFAULT_TOLERANCE)


async def initialize(db: AsyncSession, customer: models.Customer) -> None:
    """Set the score from scratch for a seeded customer: base 45, replay every
    interaction's events, then apply silence decay beyond the profile's window."""
    interactions = (
        await db.execute(
            select(models.Interaction)
            .where(models.Interaction.customer_id == customer.id)
            .order_by(models.Interaction.occurred_at.asc())
        )
    ).scalars().all()
    profile = (
        await db.execute(select(models.Profile).where(models.Profile.customer_id == customer.id))
    ).scalar_one_or_none()

    # the 'base' event seeds the absolute starting score (handled in _commit_initial)
    events: list[tuple[str, str, int]] = [("base", "new lead — neutral", START_SCORE)]
    for itx in interactions:
        events.extend(_cap_events(detect_events(itx)))

    # silence/decay beyond the profile-modulated tolerance window
    days = _days_silent(customer)
    tol = _tolerance(profile.buyer_type if profile else None)
    if days > tol:
        over = days - tol
        events.append(("silence_per_day", f"quiet {days} days (beyond {tol}d window)",
                       clamp_delta(DELTAS["silence_per_day"] * over)))

    await _commit_initial(db, customer, events)


def clamp_delta(d: int) -> int:
    """Bound a single accumulated penalty so one quiet streak can't nuke a score."""
    return max(-25, min(25, d))


# don't let one interaction swing the score to an extreme (Part 4): keep the
# strongest reasons in each direction up to this net cap.
PER_INTERACTION_CAP = 20


def _cap_events(
    events: list[tuple[str, str, int]], cap: int = PER_INTERACTION_CAP
) -> list[tuple[str, str, int]]:
    kept = [e for e in events if e[2] == 0]  # hard stops always kept
    tot = 0
    for e in sorted((e for e in events if e[2] > 0), key=lambda e: -e[2]):
        if tot + e[2] <= cap:
            kept.append(e)
            tot += e[2]
    tot = 0
    for e in sorted((e for e in events if e[2] < 0), key=lambda e: e[2]):
        if tot + e[2] >= -cap:
            kept.append(e)
            tot += e[2]
    return kept


async def _commit_initial(db, customer, events) -> None:
    """Like _commit_events but the first 'base' event seeds the absolute score."""
    score = 0
    rows = []
    for key, why, delta in events:
        if key == "base":
            score = clamp(delta)
            rows.append(_history_row(customer.id, score, band(score), "base", why, 0))
            continue
        score = 0 if key in HARD_STOPS else clamp(score + delta)
        rows.append(_history_row(customer.id, score, band(score), key, why, delta))
    customer.sign_likelihood = score
    for r in rows:
        db.add(r)
    await db.flush()
    trend = await _trend_from_history(db, customer.id)
    customer.ghost_risk = ghost_risk(score, trend)
    await db.commit()


async def _previous_interaction(
    db: AsyncSession, customer_id, interaction: models.Interaction
) -> models.Interaction | None:
    return (
        await db.execute(
            select(models.Interaction)
            .where(
                models.Interaction.customer_id == customer_id,
                models.Interaction.id != interaction.id,
                models.Interaction.occurred_at <= interaction.occurred_at,
            )
            .order_by(models.Interaction.occurred_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()


async def apply_interaction(db: AsyncSession, customer: models.Customer,
                            interaction: models.Interaction,
                            respond_type: str | None = None) -> None:
    """Move the score for one new interaction (the live, incremental path).

    `respond_type` is the co-pilot's read of the message ("objection" /
    "buying_signal" / ...). Keyword rules can't enumerate every way a customer
    sounds negative ("I hate it" matches nothing), so when no sentiment event
    fired we trust that read for the polarity.
    """
    raw = detect_events(interaction)
    # In an ongoing back-and-forth, an inbound is a REPLY, not a fresh initiation —
    # otherwise every message hands out the +10 initiation bonus and the score only
    # ever climbs (even on skepticism). Demote it to a small 'replies' nudge when the
    # customer is answering a message we just sent; keep +10 only for a true cold/
    # first inbound.
    if interaction.direction == "inbound":
        prev = await _previous_interaction(db, customer.id, interaction)
        if prev is not None and prev.direction == "outbound":
            raw = [
                ("replies", "replied in the conversation", DELTAS["replies"])
                if key == "initiates_contact" else (key, why, delta)
                for (key, why, delta) in raw
            ]

    # Fallback: if the keyword rules caught no sentiment but the co-pilot read the
    # message as a concern or a buying signal, register that polarity.
    fired = {key for key, _, _ in raw}
    if respond_type and not (fired & (_POS_EVENTS | _NEG_EVENTS)):
        if respond_type == "buying_signal":
            raw.append(("positive_language", "co-pilot read a buying signal",
                        DELTAS["positive_language"]))
        elif respond_type == "objection":
            raw.append(("new_objection_unresolved", "co-pilot read an unresolved concern",
                        DELTAS["new_objection_unresolved"]))

    events = _cap_events(raw)
    if not events:
        # still log a tiny 'replies' nudge so engagement registers
        events = [("replies", "replied / made contact", DELTAS["replies"])]
    base = customer.sign_likelihood if customer.sign_likelihood is not None else START_SCORE
    await _commit_events(db, customer, base, events)


async def apply_outcome(db: AsyncSession, customer: models.Customer, result: str) -> None:
    """Map a recorded outcome to score events (hard stops included)."""
    mapping: dict[str, tuple[str, str, int]] = {
        "won": ("agree_home_visit", "deal won", DELTAS["agree_home_visit"]),
        "lost": ("went_competitor", "deal lost", 0),
        "meeting_booked": ("agree_call_meeting", "meeting booked", DELTAS["agree_call_meeting"]),
        "replied_positive": ("positive_language", "replied positively", DELTAS["positive_language"]),
        "replied_negative": ("new_objection_unresolved", "replied negatively",
                             DELTAS["new_objection_unresolved"]),
        "no_response": ("silence_per_day", "no response", DELTAS["silence_per_day"]),
    }
    evt = mapping.get(result)
    if evt is None:
        return
    base = customer.sign_likelihood if customer.sign_likelihood is not None else START_SCORE
    await _commit_events(db, customer, base, [evt])


async def trend(db: AsyncSession, customer_id) -> str:
    return await _trend_from_history(db, customer_id)
