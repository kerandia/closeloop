"""RESPOND — live co-pilot during a human call/visit (02 §4.3).

Keep latency low: pre-match the utterance to KB objection rows and pass only
those into the prompt, not the whole KB.
"""

from __future__ import annotations

import json

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models, schemas
from app.services import loaders, prompts
from app.services.llm import DEMO_MODE, structured


async def run_respond(
    db: AsyncSession,
    customer: models.Customer,
    utterance: str,
    recent_context: str | None = None,
) -> schemas.RespondOutput:
    profile = await loaders.current_profile(db, customer.id)
    matched = await _match_objections(db, utterance)

    if DEMO_MODE:
        return _demo_respond(customer, matched, utterance)

    payload = {
        "profile": loaders.profile_dict(profile),
        "utterance": utterance,
        "recent_context": recent_context,
        "matched_objections": matched,
        "language": customer.language,
    }
    return await structured(
        system=prompts.RESPOND_SYSTEM,
        user=json.dumps(payload, ensure_ascii=False, default=str),
        schema=schemas.RespondOutput,
        temperature=0.4,
    )


async def _match_objections(db: AsyncSession, utterance: str) -> list[dict]:
    u = utterance.lower()
    rows = (await db.execute(select(models.KBObjection))).scalars().all()
    matched: list[dict] = []
    for o in rows:
        phrasings = o.customer_phrasings or []
        if any(p.lower() in u for p in phrasings) or o.key.replace("_", " ") in u:
            matched.append(
                {
                    "key": o.key,
                    "read": o.read,
                    "reframe_strategy": o.reframe_strategy,
                    "exact_lines": o.exact_lines,
                    "do_list": o.do_list,
                    "dont_list": o.dont_list,
                }
            )
    return matched


def _demo_respond(
    customer: models.Customer, matched: list[dict], utterance: str
) -> schemas.RespondOutput:
    if matched:
        m = matched[0]
        lines = m.get("exact_lines") or []
        return schemas.RespondOutput(
            read=m.get("read") or f"{m['key']} objection",
            type="objection",
            tone="calm, confident, no discounting",
            exact_lines=lines[:2]
            or ["I completely understand — let's look at what actually matters here."],
            why=m.get("reframe_strategy") or "Reframe rather than discount to protect the deal.",
        )
    return schemas.RespondOutput(
        read="general hesitation, no specific objection matched",
        type="other",
        tone="warm, unhurried",
        exact_lines=[
            "That's a fair point — what's the main thing on your mind about it?",
        ],
        why="Open the door to the real concern before responding so you address the right thing.",
    )
