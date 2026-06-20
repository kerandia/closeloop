"""Recommendation endpoints — the human-in-the-loop spine (03 §3)."""

from __future__ import annotations

import datetime as dt
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app import models, schemas
from app.db import get_db
from app.services import compose as compose_svc

router = APIRouter(prefix="/api/recommendations", tags=["recommendations"])


def _utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


@router.post("/{rec_id}/approve", response_model=schemas.MessageOut)
async def approve(
    rec_id: uuid.UUID,
    approved_by: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
):
    """One click → set approved, run COMPOSE, persist + return the draft."""
    rec = await db.get(models.Recommendation, rec_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="recommendation not found")
    customer = await db.get(models.Customer, rec.customer_id)
    if customer is None:
        raise HTTPException(status_code=404, detail="customer not found")

    rec.status = "composing"
    rec.approved_by = approved_by
    rec.approved_at = _utcnow()
    await db.flush()

    composed = await compose_svc.run_compose(db, customer, rec)

    message = models.Message(
        recommendation_id=rec.id,
        customer_id=customer.id,
        channel=composed.channel,
        subject=composed.subject,
        body=composed.body,
        language=composed.language,
        status="draft",
    )
    db.add(message)
    rec.status = "ready"
    await db.commit()
    await db.refresh(message)
    return schemas.MessageOut.model_validate(message)


@router.post("/{rec_id}/dismiss")
async def dismiss(rec_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    rec = await db.get(models.Recommendation, rec_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="recommendation not found")
    rec.status = "dismissed"
    rec.updated_at = _utcnow()
    await db.commit()
    return {"ok": True}
