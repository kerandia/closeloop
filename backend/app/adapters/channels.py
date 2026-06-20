"""Channel adapters (02 §7).

Interface: send(channel, to, {subject?, body}) -> {provider_id, status}

L1 uses MockAdapter — it logs and returns ok so the demo can show the drafted
message + "sent ✓" without wiring real providers. L2 swaps in real email
(Resend/SendGrid) and WhatsApp (Cloud API / Twilio) behind the same interface.
"""

from __future__ import annotations

import logging
import re
import uuid
from typing import Protocol

import httpx

from app.config import settings

logger = logging.getLogger("closeloop.channels")


class ChannelAdapter(Protocol):
    async def send(
        self, channel: str, to: str | None, payload: dict
    ) -> dict: ...


class MockAdapter:
    async def send(self, channel: str, to: str | None, payload: dict) -> dict:
        provider_id = f"mock_{uuid.uuid4().hex[:12]}"
        logger.info(
            "MockAdapter send channel=%s to=%s subject=%r body=%r",
            channel,
            to,
            payload.get("subject"),
            (payload.get("body") or "")[:80],
        )
        return {"provider_id": provider_id, "status": "sent", "mock": True}


def to_whatsapp_addr(phone: str | None) -> str | None:
    """Normalise a stored phone (e.g. '+49 170 111 22 33') to Twilio's
    'whatsapp:+E164' form."""
    if not phone:
        return None
    if phone.startswith("whatsapp:"):
        return phone
    digits = re.sub(r"[^\d+]", "", phone)
    if not digits.startswith("+"):
        digits = "+" + digits
    return f"whatsapp:{digits}"


class TwilioWhatsAppAdapter:
    """Send a WhatsApp message via Twilio's REST API.

    Within the 24h customer-service window a freeform Body is allowed; outside it,
    WhatsApp requires a pre-approved template — pass payload['content_sid'] (a
    Twilio Content template) and optional payload['content_variables'] (dict)."""

    API = "https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"

    async def send(self, channel: str, to: str | None, payload: dict) -> dict:
        addr = to_whatsapp_addr(to)
        if addr is None:
            raise ValueError("no destination phone for WhatsApp send")

        data = {"From": settings.twilio_whatsapp_from, "To": addr}
        content_sid = payload.get("content_sid") or (
            settings.twilio_template_sid if payload.get("use_template") else None
        )
        if content_sid:
            data["ContentSid"] = content_sid
            cv = payload.get("content_variables")
            if cv:
                import json

                data["ContentVariables"] = json.dumps(cv)
        else:
            data["Body"] = payload.get("body") or ""

        url = self.API.format(sid=settings.twilio_account_sid)
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                url,
                data=data,
                auth=(settings.twilio_account_sid, settings.twilio_auth_token),
            )
        if resp.status_code >= 300:
            logger.warning("Twilio send failed %s: %s", resp.status_code, resp.text[:300])
            raise RuntimeError(f"Twilio send failed ({resp.status_code})")
        body = resp.json()
        return {"provider_id": body.get("sid"), "status": body.get("status", "queued")}


def get_adapter(channel: str | None = None) -> ChannelAdapter:
    """Pick the adapter for a channel. WhatsApp uses Twilio when configured +
    real_send is on; everything else (and the demo) uses the mock."""
    if channel == "whatsapp" and settings.real_send and settings.whatsapp_configured:
        return TwilioWhatsAppAdapter()
    return MockAdapter()
