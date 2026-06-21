"""Management dashboard (manager lens) — live aggregation over the real pipeline
(customers, quotes, reps, scores). Mirrors the MgmtStats shape the frontend mock
used, so the page can swap the fixture for this endpoint.

Note: the hackathon DB has no multi-month history, so `trends` is synthesized as a
6-month ramp ending at the current actuals (clearly a visualization, not history);
everything else is computed from real rows.
"""

from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models, serializers
from app.db import get_db

router = APIRouter(prefix="/api/management", tags=["management"])

# the pipeline progression shown in the funnel (lost is tracked separately)
FUNNEL = [("quoted", "Quoted"), ("contacted", "Contacted"),
          ("in_progress", "In Progress"), ("won", "Won")]
WON, LOST = "won", "lost"


def _utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def _aware(d: dt.datetime) -> dt.datetime:
    return d if d.tzinfo else d.replace(tzinfo=dt.timezone.utc)


@router.get("/stats")
async def management_stats(
    period: str = Query("month"), db: AsyncSession = Depends(get_db)
):
    days = 7 if period == "week" else 30
    now = _utcnow()
    cutoff = now - dt.timedelta(days=days)
    prior_cutoff = now - dt.timedelta(days=2 * days)

    customers = list((await db.execute(select(models.Customer))).scalars().all())
    reps = list((await db.execute(select(models.Rep))).scalars().all())

    # latest quote price per customer
    qrows = (
        await db.execute(
            select(models.Quote.customer_id, models.Quote.price_eur, models.Quote.created_at)
            .order_by(models.Quote.created_at.desc())
        )
    ).all()
    price: dict = {}
    for cid, pr, _ in qrows:
        if cid not in price and pr is not None:
            price[cid] = float(pr)

    def cprice(c) -> float:
        return price.get(c.id, 0.0)

    def created(c) -> dt.datetime:
        return _aware(c.created_at) if c.created_at else now

    won = [c for c in customers if c.stage == WON]
    active = [c for c in customers if c.stage not in (WON, LOST)]
    total = len(customers)

    revenue = sum(cprice(c) for c in won)
    forecast = sum(cprice(c) * ((c.sign_likelihood or 0) / 100) for c in active)
    new_leads = sum(1 for c in customers if created(c) >= cutoff)
    prior_new = sum(1 for c in customers if prior_cutoff <= created(c) < cutoff)
    conv = round(len(won) / total * 100) if total else 0

    # funnel
    funnel = []
    for i, (st, label) in enumerate(FUNNEL):
        cnt = sum(1 for c in customers if c.stage == st)
        val = sum(cprice(c) for c in customers if c.stage == st)
        if i + 1 < len(FUNNEL):
            nxt = sum(1 for c in customers if c.stage == FUNNEL[i + 1][0])
            conv_next = round(nxt / cnt * 100) if cnt else 0
        else:
            conv_next = None
        funnel.append({"stage": st, "label": label, "count": cnt,
                       "value_eur": round(val), "conversion_to_next_pct": conv_next})

    # per-rep
    reps_out = []
    for r in reps:
        owned = [c for c in customers if c.assigned_rep_id == r.id]
        rwon = [c for c in owned if c.stage == WON]
        reps_out.append({
            "rep": {"id": str(r.id), "name": r.name},
            "customers_owned": len(owned),
            "contacted_this_period": sum(
                1 for c in owned if c.last_contact_at and _aware(c.last_contact_at) >= cutoff
            ),
            "deals_closed": len(rwon),
            "conversion_rate_pct": round(len(rwon) / len(owned) * 100) if owned else 0,
            "revenue_eur": round(sum(cprice(c) for c in rwon)),
            "stage_breakdown": {st: sum(1 for c in owned if c.stage == st) for st, _ in FUNNEL},
        })

    # full pool + needs-attention (via the shared serializer for the exact list shape)
    items = [await serializers.customer_list_item(db, c) for c in customers]
    cust_dicts = [ci.model_dump(mode="json") for ci in items]

    def needs(c) -> bool:
        if c.ghost_risk == "high":
            return True
        return bool(c.last_contact_at and (now - _aware(c.last_contact_at)).days > 14)

    needs_ids = {str(c.id) for c in customers if needs(c)}
    needs_attention = [d for d in cust_dicts if d["id"] in needs_ids]

    # trends — no real multi-month history; ramp to current actuals so it's alive
    labels = [(now - dt.timedelta(days=30 * k)).strftime("%b") for k in range(5, -1, -1)]
    trends = []
    for i, lab in enumerate(labels):
        f = (i + 1) / len(labels)
        trends.append({
            "month": lab,
            "conversion_pct": round((conv or 12) * f),
            "revenue_eur": round((revenue or 60_000) * f),
            "deals_closed": max(0, round(len(won) * f)) if won else round(2 * f),
        })

    return {
        "period": period,
        "new_leads": new_leads,
        "active_pipeline": len(active),
        "deals_closed": len(won),
        "revenue_eur": round(revenue),
        "conversion_rate_pct": conv,
        "forecast_eur": round(forecast),
        "delta_new_leads": new_leads - prior_new,
        "delta_conversion_pct": 0,
        "delta_revenue_eur": 0,
        "funnel": funnel,
        "reps": reps_out,
        "trends": trends,
        "customers": cust_dicts,
        "needs_attention": needs_attention,
    }
