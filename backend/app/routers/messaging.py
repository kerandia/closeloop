"""Outbound messaging for the live co-pilot (SMS or WhatsApp). The rep approves a
suggested reply → it goes out on the same channel the customer used. Closes the
real-time round-trip."""

from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models, schemas
from app.adapters.channels import get_adapter
from app.config import settings
from app.db import get_db

router = APIRouter(prefix="/api/messaging", tags=["messaging"])

_WINDOW = dt.timedelta(hours=24)


def _utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


async def _last_inbound_at(db: AsyncSession, customer_id, channel: str) -> dt.datetime | None:
    return (
        await db.execute(
            select(models.Interaction.occurred_at)
            .where(
                models.Interaction.customer_id == customer_id,
                models.Interaction.channel == channel,
                models.Interaction.direction == "inbound",
            )
            .order_by(models.Interaction.occurred_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()


@router.post("/send")
async def send_message(body: schemas.MessagingSendRequest, db: AsyncSession = Depends(get_db)):
    customer = await db.get(models.Customer, body.customer_id)
    if customer is None:
        raise HTTPException(status_code=404, detail="customer not found")

    channel = body.channel
    real_send = settings.real_send and settings.channel_configured(channel)

    # WhatsApp 24h window: outside it, only a pre-approved template may be sent.
    # SMS has no such restriction.
    within_window = True
    use_template = False
    if channel == "whatsapp":
        last_in = await _last_inbound_at(db, customer.id, "whatsapp")
        within_window = bool(
            last_in
            and (_utcnow() - (last_in if last_in.tzinfo else last_in.replace(tzinfo=dt.timezone.utc)))
            < _WINDOW
        )
        use_template = not within_window
        if real_send and use_template and not settings.twilio_template_sid:
            raise HTTPException(
                status_code=409,
                detail="Outside the 24h WhatsApp window — a pre-approved template is "
                "required (set TWILIO_TEMPLATE_SID). Freeform send blocked.",
            )

    adapter = get_adapter(channel)
    result = await adapter.send(
        channel, customer.phone, {"body": body.body, "use_template": real_send and use_template}
    )

    now = _utcnow()
    interaction = models.Interaction(
        customer_id=customer.id,
        channel=channel,
        direction="outbound",
        content=body.body,
        outcome=f"sent via {channel} ({result.get('provider_id')})",
        created_by="rep",
    )
    db.add(interaction)
    customer.last_contact_at = now

    if body.suggestion_id:
        sug = await db.get(models.CopilotSuggestion, body.suggestion_id)
        if sug:
            sug.status = "sent"

    await db.commit()
    await db.refresh(interaction)
    return {
        "ok": True,
        "provider": result,
        "within_window": within_window,
        "interaction": schemas.InteractionOut.model_validate(interaction).model_dump(mode="json"),
    }
