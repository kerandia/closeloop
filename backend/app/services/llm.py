"""OpenAI structured-output helper.

All reasoning services call `structured()` with a Pydantic model as the schema.
We use the SDK's parse mode (JSON schema / structured output), validate against
the model, and retry once on a parse/validation failure — never returning
malformed JSON to the caller (02 §2).

If no OPENAI_API_KEY is configured we are in DEMO mode: services fall back to
deterministic stubs so the golden path is bulletproof on stage (00 §5, L1).
"""

from __future__ import annotations

import logging
from typing import TypeVar

from pydantic import BaseModel

from app.config import settings

logger = logging.getLogger("closeloop.llm")

T = TypeVar("T", bound=BaseModel)

DEMO_MODE = not bool(settings.openai_api_key)

_client = None


def _get_client():
    global _client
    if _client is None:
        from openai import AsyncOpenAI

        _client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _client


async def structured(
    *,
    system: str,
    user: str,
    schema: type[T],
    temperature: float = 0.3,
) -> T:
    """Call the model and return a validated instance of `schema`.

    Raises RuntimeError in DEMO mode — callers must provide their own fallback.
    """
    if DEMO_MODE:
        raise RuntimeError("LLM unavailable (DEMO mode — no OPENAI_API_KEY)")

    client = _get_client()
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]

    last_err: Exception | None = None
    for attempt in range(2):
        try:
            completion = await client.beta.chat.completions.parse(
                model=settings.openai_model,
                messages=messages,
                response_format=schema,
                temperature=temperature,
            )
            parsed = completion.choices[0].message.parsed
            if parsed is None:
                raise ValueError("model returned no parsed content")
            return parsed
        except Exception as err:  # noqa: BLE001 — retry once, then surface
            last_err = err
            logger.warning("structured() attempt %d failed: %s", attempt + 1, err)
            messages.append(
                {
                    "role": "user",
                    "content": "Your previous reply did not match the required JSON "
                    "schema. Return ONLY valid JSON matching the schema.",
                }
            )

    raise RuntimeError(f"LLM structured call failed after retry: {last_err}")
