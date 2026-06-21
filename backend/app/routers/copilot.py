"""Live co-pilot endpoints (03 §E / 02 §4.3)."""

from __future__ import annotations

import asyncio
import json
import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models, schemas
from app.db import get_db
from app.routers.webhooks import process_inbound
from app.services import realtime
from app.services import respond as respond_svc

router = APIRouter(prefix="/api/copilot", tags=["copilot"])


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


@router.get("/suggestions/{customer_id}")
async def list_suggestions(customer_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Recent live co-pilot suggestions (so the panel has history on mount)."""
    rows = (
        await db.execute(
            select(models.CopilotSuggestion)
            .where(models.CopilotSuggestion.customer_id == customer_id)
            .order_by(models.CopilotSuggestion.created_at.desc())
            .limit(10)
        )
    ).scalars().all()
    return [_suggestion_dict(s) for s in rows]


@router.get("/stream/{customer_id}")
async def stream(customer_id: uuid.UUID):
    """Server-Sent Events: live co-pilot suggestions for one customer (pushed by
    the WhatsApp webhook). Heartbeats every 20s keep the connection open."""
    cid = str(customer_id)
    q = realtime.subscribe(cid)

    async def gen():
        try:
            yield ": connected\n\n"
            while True:
                try:
                    event = await asyncio.wait_for(q.get(), timeout=20)
                    yield f"data: {json.dumps(event)}\n\n"
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
        finally:
            realtime.unsubscribe(cid, q)

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/respond", response_model=schemas.RespondOutput)
async def respond(
    body: schemas.CopilotRespondRequest, db: AsyncSession = Depends(get_db)
):
    customer = await db.get(models.Customer, body.customer_id)
    if customer is None:
        raise HTTPException(status_code=404, detail="customer not found")
    return await respond_svc.run_respond(
        db, customer, body.utterance, body.recent_context, body.channel
    )


class SimulateInboundRequest(BaseModel):
    customer_id: uuid.UUID
    body: str
    channel: str = "whatsapp"


@router.post("/simulate-inbound")
async def simulate_inbound(
    req: SimulateInboundRequest, db: AsyncSession = Depends(get_db)
):
    """Demo only: play the customer. Runs the exact same inbound pipeline as the
    Twilio webhook (RESPOND → suggestion → Deal Score → ANALYZE → SSE push) by
    customer_id, so the live AI answer streams to the rep's screen without a
    phone. Returns the published suggestion + fresh score."""
    customer = await db.get(models.Customer, req.customer_id)
    if customer is None:
        raise HTTPException(status_code=404, detail="customer not found")
    return await process_inbound(db, customer, req.body, req.channel)


# Gap-filling questions ordered by what ANALYZE most needs next.
_GAP_QUESTIONS = {
    "motivation": "What's the main reason solar appeals to you — saving money, "
    "independence from the grid, or the environmental side?",
    "timeline": "Are you hoping to decide in the next few weeks, or is this more "
    "of a longer-term plan?",
    "decision_makers": "Is this a decision you'll make together with anyone else "
    "at home?",
    "budget": "Were you looking at paying upfront, or would financing options be "
    "helpful to see?",
}


@router.get("/collect/{customer_id}", response_model=schemas.CollectResponse)
async def collect(customer_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    customer = await db.get(models.Customer, customer_id)
    if customer is None:
        raise HTTPException(status_code=404, detail="customer not found")

    profile = (
        await db.execute(
            select(models.Profile).where(models.Profile.customer_id == customer_id)
        )
    ).scalar_one_or_none()

    if profile is None or not profile.motivation:
        return schemas.CollectResponse(question=_GAP_QUESTIONS["motivation"])
    neg = profile.negotiation or {}
    if not neg.get("decision_speed"):
        return schemas.CollectResponse(question=_GAP_QUESTIONS["timeline"])
    if not neg.get("decision_makers"):
        return schemas.CollectResponse(question=_GAP_QUESTIONS["decision_makers"])
    return schemas.CollectResponse(question=_GAP_QUESTIONS["budget"])
