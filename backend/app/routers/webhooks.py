"""Voice agent webhook (02 §6 / 04 §6).

On call end: store the interaction, create extracted_actions from the callback
request, then run ANALYZE (which turns hesitations into evidence-backed
objections, sets the score, and produces the recommendation)."""

from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app import models, schemas
from app.db import get_db
from app.services import analyze as analyze_svc

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


def _utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


@router.post("/voice/transcript")
async def voice_transcript(body: schemas.VoiceWebhook, db: AsyncSession = Depends(get_db)):
    customer = await db.get(models.Customer, body.customer_id)
    if customer is None:
        raise HTTPException(status_code=404, detail="customer not found")

    interaction = models.Interaction(
        customer_id=customer.id,
        channel="voice_ai",
        direction="outbound",
        transcript_md=body.transcript_md,
        transcript_raw=body.transcript_raw,
        recording_url=body.recording_url,
        outcome=_summarise(body.collected),
        created_by="voice_agent",
    )
    db.add(interaction)
    await db.flush()

    cb = body.collected.callback_request or {}
    if cb.get("wants_callback"):
        db.add(
            models.ExtractedAction(
                customer_id=customer.id,
                interaction_id=interaction.id,
                type="callback",
                detail=f"Wants a callback: {cb.get('when', 'time unspecified')}",
            )
        )

    customer.last_contact_at = _utcnow()
    if customer.stage == "quoted":
        customer.stage = "contacted"
    await db.commit()

    await analyze_svc.run_analyze(db, customer)
    return {"ok": True}


def _summarise(collected: schemas.VoiceCollected) -> str:
    bits = []
    if collected.sentiment:
        bits.append(f"sentiment: {collected.sentiment}")
    if collected.hesitations:
        bits.append("hesitations: " + ", ".join(collected.hesitations))
    if collected.timeline:
        bits.append(f"timeline: {collected.timeline}")
    return "; ".join(bits) or "voice re-engagement call"
