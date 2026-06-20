"""Outbound WhatsApp send for the live co-pilot (the rep approves a suggested
reply → it goes out on WhatsApp). Closes the real-time round-trip."""

from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models, schemas
from app.adapters.channels import get_adapter
from app.config import settings
from app.db import get_db

router = APIRouter(prefix="/api/whatsapp", tags=["whatsapp"])

_WINDOW = dt.timedelta(hours=24)


def _utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


async def _last_inbound_at(db: AsyncSession, customer_id) -> dt.datetime | None:
    row = (
        await db.execute(
            select(models.Interaction.occurred_at)
            .where(
                models.Interaction.customer_id == customer_id,
                models.Interaction.channel == "whatsapp",
                models.Interaction.direction == "inbound",
            )
            .order_by(models.Interaction.occurred_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    return row


@router.post("/send")
async def send_whatsapp(body: schemas.WhatsAppSendRequest, db: AsyncSession = Depends(get_db)):
    customer = await db.get(models.Customer, body.customer_id)
    if customer is None:
        raise HTTPException(status_code=404, detail="customer not found")

    # WhatsApp 24h window: outside it, a freeform message is not allowed — only a
    # pre-approved template. Guard so the rep gets a clear error, not a silent fail.
    last_in = await _last_inbound_at(db, customer.id)
    within_window = bool(
        last_in
        and (_utcnow() - (last_in if last_in.tzinfo else last_in.replace(tzinfo=dt.timezone.utc)))
        < _WINDOW
    )
    real_send = settings.real_send and settings.whatsapp_configured
    use_template = not within_window
    if real_send and use_template and not settings.twilio_template_sid:
        raise HTTPException(
            status_code=409,
            detail="Outside the 24h WhatsApp window — a pre-approved template is "
            "required (set TWILIO_TEMPLATE_SID). Freeform send blocked.",
        )

    adapter = get_adapter("whatsapp")
    payload = {"body": body.body, "use_template": real_send and use_template}
    result = await adapter.send("whatsapp", customer.phone, payload)

    now = _utcnow()
    interaction = models.Interaction(
        customer_id=customer.id,
        channel="whatsapp",
        direction="outbound",
        content=body.body,
        outcome=f"sent via whatsapp ({result.get('provider_id')})",
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
