"""COMPOSE — writes the channel-specific message on Approve (02 §4.2)."""

from __future__ import annotations

import json
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models, schemas
from app.services import loaders, prompts
from app.services.llm import DEMO_MODE, structured

logger = logging.getLogger("closeloop.compose")


async def run_compose(
    db: AsyncSession,
    customer: models.Customer,
    recommendation: models.Recommendation,
) -> schemas.ComposeOutput:
    profile = await loaders.current_profile(db, customer.id)
    quote = await loaders.latest_quote(db, customer.id)
    buyer_kb = await _buyer_type_kb(db, profile.buyer_type if profile else None)
    recent_msgs = await _recent_customer_messages(db, customer.id)

    if DEMO_MODE:
        return _demo_compose(customer, profile, quote, recommendation, buyer_kb)

    payload = {
        "recommendation": {
            "channel": recommendation.channel,
            "timing_label": recommendation.timing_label,
            "goal": recommendation.goal,
            "rationale": recommendation.rationale,
            "play_key": recommendation.play_key,
        },
        "profile": loaders.profile_dict(profile),
        "quote": loaders.quote_dict(quote),
        "buyer_type_kb": buyer_kb,
        # The language the customer actually used most recently wins over the
        # stored default — so a German-market lead who writes in English gets
        # an English opener.
        "recent_customer_messages": recent_msgs,
        "reply_in_language": (
            loaders.detect_language(recent_msgs[0] if recent_msgs else None)
            or ("English" if (customer.language or "de") == "en" else "German")
        ),
        "customer_name": customer.name,
    }
    try:
        return await structured(
            system=prompts.COMPOSE_SYSTEM,
            user=json.dumps(payload, ensure_ascii=False, default=str),
            schema=schemas.ComposeOutput,
            temperature=0.6,
        )
    except Exception as err:  # noqa: BLE001 — fall back to a clean templated draft
        logger.warning("COMPOSE LLM failed (%s); using DEMO fallback", err)
        return _demo_compose(customer, profile, quote, recommendation, buyer_kb)


async def _recent_customer_messages(db: AsyncSession, customer_id, limit: int = 3) -> list[str]:
    """The customer's most recent inbound messages (newest first) — used as the
    language signal for the opener."""
    rows = (
        await db.execute(
            select(models.Interaction.content)
            .where(
                models.Interaction.customer_id == customer_id,
                models.Interaction.direction == "inbound",
                models.Interaction.content.isnot(None),
            )
            .order_by(models.Interaction.occurred_at.desc())
            .limit(limit)
        )
    ).scalars().all()
    return [c for c in rows if c]


async def _buyer_type_kb(db: AsyncSession, key: str | None) -> dict | None:
    if not key:
        return None
    res = await db.execute(
        select(models.KBBuyerType).where(models.KBBuyerType.key == key)
    )
    bt = res.scalar_one_or_none()
    if bt is None:
        return None
    return {"default_tone": bt.default_tone, "talking_points": bt.talking_points}


def _demo_compose(
    customer: models.Customer,
    profile: models.Profile | None,
    quote: models.Quote | None,
    rec: models.Recommendation,
    buyer_kb: dict | None,
) -> schemas.ComposeOutput:
    lang = customer.language or "de"
    saving = None
    if quote and quote.monthly_saving_eur is not None:
        saving = int(quote.monthly_saving_eur)
    first = customer.name.split()[0] if customer.name else ""

    if lang == "de":
        greeting = f"Hallo Familie {customer.name.split()[-1]}," if " " in customer.name else f"Hallo {first},"
        saving_line = f" Ihr Angebot spart rund {saving} € im Monat." if saving else ""
        body = (
            f"{greeting}\n\n"
            f"ich wollte mich kurz zu Ihrem Solar-Angebot melden.{saving_line} "
            "Ich weiß, so eine Entscheidung will gut überlegt sein — kein Druck von uns. "
            f"{rec.goal or 'Gerne beantworte ich offene Fragen.'}\n\n"
            "Wann würde Ihnen ein kurzes Gespräch passen?\n\nBeste Grüße"
        )
        subject = "Ihr Solar-Angebot — kurze Rückmeldung" if rec.channel == "email" else None
    else:
        greeting = f"Hi {first},"
        saving_line = f" Your quote saves around €{saving}/month." if saving else ""
        body = (
            f"{greeting}\n\n"
            f"just checking in on your solar quote.{saving_line} "
            "No pressure at all — it's a big decision. "
            f"{rec.goal or 'Happy to answer anything still open.'}\n\n"
            "When would a quick chat suit you?\n\nBest"
        )
        subject = "Your solar quote — quick check-in" if rec.channel == "email" else None

    return schemas.ComposeOutput(
        channel=rec.channel, subject=subject, body=body, language=lang
    )
