"""Live co-pilot endpoints (03 §E / 02 §4.3)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models, schemas
from app.db import get_db
from app.services import respond as respond_svc

router = APIRouter(prefix="/api/copilot", tags=["copilot"])


@router.post("/respond", response_model=schemas.RespondOutput)
async def respond(
    body: schemas.CopilotRespondRequest, db: AsyncSession = Depends(get_db)
):
    customer = await db.get(models.Customer, body.customer_id)
    if customer is None:
        raise HTTPException(status_code=404, detail="customer not found")
    return await respond_svc.run_respond(
        db, customer, body.utterance, body.recent_context
    )


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
