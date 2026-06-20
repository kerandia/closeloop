"""Message endpoints: rep edits the draft, then sends via the channel adapter."""

from __future__ import annotations

import datetime as dt
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app import models, schemas
from app.adapters.channels import get_adapter
from app.db import get_db

router = APIRouter(prefix="/api/messages", tags=["messages"])


def _utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


@router.patch("/{message_id}", response_model=schemas.MessageOut)
async def edit_message(
    message_id: uuid.UUID,
    body: schemas.MessagePatch,
    db: AsyncSession = Depends(get_db),
):
    msg = await db.get(models.Message, message_id)
    if msg is None:
        raise HTTPException(status_code=404, detail="message not found")
    if body.subject is not None:
        msg.subject = body.subject
    if body.body is not None:
        msg.body = body.body
    if msg.status == "draft":
        msg.status = "edited"
    await db.commit()
    await db.refresh(msg)
    return schemas.MessageOut.model_validate(msg)


@router.post("/{message_id}/send")
async def send_message(message_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    msg = await db.get(models.Message, message_id)
    if msg is None:
        raise HTTPException(status_code=404, detail="message not found")
    customer = await db.get(models.Customer, msg.customer_id)

    adapter = get_adapter()
    to = None
    if customer:
        to = customer.email if msg.channel == "email" else customer.phone
    result = await adapter.send(msg.channel, to, {"subject": msg.subject, "body": msg.body})

    now = _utcnow()
    msg.status = "sent"
    msg.sent_at = now

    interaction = models.Interaction(
        customer_id=msg.customer_id,
        channel=msg.channel,
        direction="outbound",
        content=msg.body,
        outcome=f"sent via {msg.channel} ({result.get('provider_id')})",
        created_by="system",
    )
    db.add(interaction)

    if customer:
        customer.last_contact_at = now

    # advance the recommendation to sent
    if msg.recommendation_id:
        rec = await db.get(models.Recommendation, msg.recommendation_id)
        if rec:
            rec.status = "sent"
            rec.updated_at = now

    await db.commit()
    await db.refresh(interaction)
    return {
        "ok": True,
        "provider": result,
        "interaction": schemas.InteractionOut.model_validate(interaction).model_dump(mode="json"),
    }
