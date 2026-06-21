"""Automatic call note-taking (Phase 3) — summarize a customer's latest call /
visit transcript into structured notes for the rep. Reuses transcripts; LLM with
a deterministic DEMO fallback so it always returns something."""

from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app import models, schemas
from app.services import loaders, prompts
from app.services.llm import DEMO_MODE, structured

logger = logging.getLogger("closeloop.notes")

_OBJECTION_HINTS = {
    "price": ["teuer", "expensive", "money", "preis", "kostet"],
    "winter": ["winter", "cloud", "sonne", "ertrag"],
    "comparing": ["andere", "vergleich", "other", "compare", "angebot"],
    "spouse": ["frau", "mann", "wife", "husband", "partner", "gemeinsam"],
    "trust": ["kenne", "referenz", "garantie", "warranty", "reputable"],
}
_SIGNAL_HINTS = ["installation", "wann", "termin", "finanzierung", "rate", "install", "ready", "weekend"]


def _source_interaction(rows: list[models.Interaction]) -> models.Interaction | None:
    # prefer a real call/visit with a transcript, else any with content
    for i in rows:
        if i.transcript_md:
            return i
    for i in rows:
        if i.content:
            return i
    return None


def _demo_notes(text: str) -> schemas.CallNotes:
    low = text.lower()
    lines = [ln.strip().lstrip("*-• ").strip() for ln in text.splitlines() if ln.strip()]
    objections = [k for k, kws in _OBJECTION_HINTS.items() if any(w in low for w in kws)]
    signals = [w for w in _SIGNAL_HINTS if w in low]
    return schemas.CallNotes(
        summary=(lines[0][:160] if lines else "Call logged."),
        key_points=lines[1:5],
        objections=objections,
        buying_signals=signals,
        next_steps=["Follow up on the open objection", "Confirm the next touch"] if objections else
        ["Confirm the next touch"],
    )


async def generate_call_notes(db: AsyncSession, customer: models.Customer) -> dict:
    rows = await loaders.recent_interactions(db, customer.id, limit=10)
    src = _source_interaction(rows)
    if src is None:
        return {
            "summary": "No call or transcript to summarize yet.",
            "key_points": [], "objections": [], "buying_signals": [], "next_steps": [],
            "source_interaction_id": None, "occurred_at": None,
        }
    text = src.transcript_md or src.content or ""

    if DEMO_MODE:
        notes = _demo_notes(text)
    else:
        try:
            notes = await structured(system=prompts.NOTES_SYSTEM, user=text, schema=schemas.CallNotes)
        except Exception as err:  # noqa: BLE001
            logger.warning("Notes LLM failed (%s); using DEMO fallback", err)
            notes = _demo_notes(text)

    return {
        **notes.model_dump(),
        "source_interaction_id": str(src.id),
        "channel": src.channel,
        "occurred_at": src.occurred_at.isoformat() if src.occurred_at else None,
    }
