"""Voice agent webhook (02 §6 / 04 §6).

On call end: store the interaction, create extracted_actions from the callback
request, then run ANALYZE (which turns hesitations into evidence-backed
objections, sets the score, and produces the recommendation)."""

from __future__ import annotations

import datetime as dt
import re

from fastapi import APIRouter, Depends, Form, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models, schemas
from app.db import get_db
from app.services import analyze as analyze_svc
from app.services import realtime
from app.services import respond as respond_svc
from app.services import scoring as scoring_svc

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])

# Twilio expects a TwiML reply; an empty <Response/> means "don't auto-reply"
# (the rep sends the answer manually from the UI).
_EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'


def _utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def _digits(phone: str | None) -> str:
    return re.sub(r"\D", "", phone or "")


async def _match_customer_by_phone(db: AsyncSession, frm: str) -> models.Customer | None:
    want = _digits(frm)
    if not want:
        return None
    rows = (
        await db.execute(select(models.Customer).where(models.Customer.phone.isnot(None)))
    ).scalars().all()
    for c in rows:
        if _digits(c.phone) == want:
            return c
    return None


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


@router.post("/whatsapp")
async def whatsapp_inbound(
    From: str = Form(...),
    Body: str = Form(""),
    db: AsyncSession = Depends(get_db),
):
    """Twilio inbound WhatsApp message (form-encoded). See _handle_inbound."""
    return await _handle_inbound(db, From, Body, channel="whatsapp")


@router.post("/sms")
async def sms_inbound(
    From: str = Form(...),
    Body: str = Form(""),
    db: AsyncSession = Depends(get_db),
):
    """Twilio inbound SMS (same shape as WhatsApp; From is a plain +E164)."""
    return await _handle_inbound(db, From, Body, channel="sms")


async def _handle_inbound(db: AsyncSession, From: str, Body: str, channel: str):
    """Match the sender to a customer, run the RESPOND co-pilot (which also logs the
    inbound message + moves the Deal Score / Cadence), persist the suggestion, and
    push it live to the rep's screen over SSE. Returns empty TwiML (no auto-reply).
    """
    customer = await _match_customer_by_phone(db, From)
    if customer is None:
        # unknown number — ack so Twilio doesn't retry; nothing to suggest
        return Response(content=_EMPTY_TWIML, media_type="application/xml")

    out = await respond_svc.run_respond(db, customer, Body, channel=channel)

    # the inbound message run_respond just logged
    last_itx = (
        await db.execute(
            select(models.Interaction)
            .where(models.Interaction.customer_id == customer.id)
            .order_by(models.Interaction.occurred_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()

    suggestion = models.CopilotSuggestion(
        customer_id=customer.id,
        interaction_id=last_itx.id if last_itx else None,
        utterance=Body,
        read=out.read,
        category=out.category,
        exact_lines=out.exact_lines,
        why=out.why,
        advance_hook=out.advance_hook,
        todo=out.todo.model_dump(mode="json") if out.todo else None,
        channel=channel,
    )
    db.add(suggestion)
    customer.last_contact_at = _utcnow()
    if customer.stage == "quoted":
        customer.stage = "contacted"
    await db.commit()
    await db.refresh(suggestion)

    # the inbound message is a real engagement event → move the Deal Score
    # (ANALYZE owns profile/recommendation; scoring owns the number).
    if last_itx is not None:
        await scoring_svc.apply_interaction(db, customer, last_itx)
    # refresh profile + next-best-action off the new message
    await analyze_svc.run_analyze(db, customer)
    await db.refresh(customer)

    await realtime.publish(
        str(customer.id),
        {
            "type": "suggestion",
            "suggestion": _suggestion_dict(suggestion),
            "score": {
                "sign_likelihood": customer.sign_likelihood,
                "ghost_risk": customer.ghost_risk,
            },
        },
    )
    return Response(content=_EMPTY_TWIML, media_type="application/xml")


def _suggestion_dict(s: models.CopilotSuggestion) -> dict:
    return {
        "id": str(s.id),
        "customer_id": str(s.customer_id),
        "utterance": s.utterance,
        "read": s.read,
        "category": s.category,
        "exact_lines": s.exact_lines or [],
        "why": s.why,
        "advance_hook": s.advance_hook,
        "todo": s.todo,
        "channel": s.channel,
        "status": s.status,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


def _summarise(collected: schemas.VoiceCollected) -> str:
    bits = []
    if collected.sentiment:
        bits.append(f"sentiment: {collected.sentiment}")
    if collected.hesitations:
        bits.append("hesitations: " + ", ".join(collected.hesitations))
    if collected.timeline:
        bits.append(f"timeline: {collected.timeline}")
    return "; ".join(bits) or "voice re-engagement call"
