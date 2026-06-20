"""In-process pub/sub for pushing live co-pilot events to the rep UI over SSE.

A WhatsApp message arrives → the webhook publishes a suggestion event → any
browser tab subscribed to that customer's stream receives it instantly. This is a
single-process broadcaster (fine for the demo / a single backend instance); a
multi-instance deploy would swap this for Redis pub/sub or Supabase Realtime
behind the same publish()/subscribe() interface.
"""

from __future__ import annotations

import asyncio
from collections import defaultdict

_subscribers: dict[str, set[asyncio.Queue]] = defaultdict(set)


def subscribe(customer_id: str) -> asyncio.Queue:
    q: asyncio.Queue = asyncio.Queue(maxsize=64)
    _subscribers[customer_id].add(q)
    return q


def unsubscribe(customer_id: str, q: asyncio.Queue) -> None:
    subs = _subscribers.get(customer_id)
    if subs:
        subs.discard(q)
        if not subs:
            _subscribers.pop(customer_id, None)


async def publish(customer_id: str, event: dict) -> None:
    """Fan an event out to every subscriber of this customer (drop if a queue is
    full rather than block the webhook)."""
    for q in list(_subscribers.get(customer_id, ())):
        try:
            q.put_nowait(event)
        except asyncio.QueueFull:
            pass
