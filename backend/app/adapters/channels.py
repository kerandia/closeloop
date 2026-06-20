"""Channel adapters (02 §7).

Interface: send(channel, to, {subject?, body}) -> {provider_id, status}

L1 uses MockAdapter — it logs and returns ok so the demo can show the drafted
message + "sent ✓" without wiring real providers. L2 swaps in real email
(Resend/SendGrid) and WhatsApp (Cloud API / Twilio) behind the same interface.
"""

from __future__ import annotations

import logging
import uuid
from typing import Protocol

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
        return {"provider_id": provider_id, "status": "sent"}


def get_adapter() -> ChannelAdapter:
    # L2: if settings.real_send, return a real provider adapter here.
    return MockAdapter()
