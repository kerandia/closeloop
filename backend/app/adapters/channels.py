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


def to_e164(phone: str | None) -> str | None:
    """Normalise a stored phone (e.g. '+49 170 111 22 33') to '+E164'."""
    if not phone:
        return None
    digits = re.sub(r"[^\d+]", "", phone.replace("whatsapp:", ""))
    if not digits.startswith("+"):
        digits = "+" + digits
    return digits


def to_whatsapp_addr(phone: str | None) -> str | None:
    e164 = to_e164(phone)
    return f"whatsapp:{e164}" if e164 else None


class TwilioAdapter:
    """Send an SMS or WhatsApp message via Twilio's REST API.

    SMS goes from the trial/SMS number; WhatsApp from the sandbox number. For
    WhatsApp outside the 24h window a freeform Body is rejected — pass
    payload['use_template'] (uses TWILIO_TEMPLATE_SID) or payload['content_sid']."""

    API = "https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"

    async def send(self, channel: str, to: str | None, payload: dict) -> dict:
        if channel == "whatsapp":
            sender, addr = settings.twilio_whatsapp_from, to_whatsapp_addr(to)
        else:  # sms
            sender, addr = settings.twilio_sms_from, to_e164(to)
        if addr is None:
            raise ValueError(f"no destination phone for {channel} send")

        data = {"From": sender, "To": addr}
        content_sid = payload.get("content_sid") or (
            settings.twilio_template_sid
            if channel == "whatsapp" and payload.get("use_template")
            else None
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
    """Pick the adapter for a channel. SMS/WhatsApp use Twilio when that channel is
    configured + real_send is on; everything else (and the demo) uses the mock."""
    if (
        channel in ("whatsapp", "sms")
        and settings.real_send
        and settings.channel_configured(channel)
    ):
        return TwilioAdapter()
    return MockAdapter()
