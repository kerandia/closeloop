"""Shared loaders: pull the knowledge base and customer context out of the DB
and shape them into the dicts the reasoning prompts expect."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models


def _row_to_dict(obj, fields: list[str]) -> dict:
    return {f: getattr(obj, f) for f in fields}


async def load_knowledge_base(db: AsyncSession) -> dict:
    buyer_types = (await db.execute(select(models.KBBuyerType))).scalars().all()
    objections = (await db.execute(select(models.KBObjection))).scalars().all()
    plays = (await db.execute(select(models.KBPlay))).scalars().all()
    priors = (await db.execute(select(models.KBChannelPrior))).scalars().all()

    return {
        "buyer_types": [
            _row_to_dict(
                b,
                ["key", "name", "description", "fears", "motivators",
                 "default_tone", "recommended_channels", "talking_points"],
            )
            for b in buyer_types
        ],
        # ANALYZE only needs to recognise + reference objections by key; the full
        # playbook (phrasings, exact_lines, do/don't) is for RESPOND. Keeping this
        # lean avoids a large structured-output prompt that pushes the model into
        # repetition / length-limit failures.
        "objections": [
            _row_to_dict(o, ["key", "read", "applies_to"])
            for o in objections
        ],
        "plays": [
            _row_to_dict(
                p,
                ["key", "name", "description", "when_to_use", "channel",
                 "buyer_types", "success_rate"],
            )
            for p in plays
        ],
        "channel_priors": [
            _row_to_dict(
                c, ["buyer_type", "stage", "best_channel", "best_timing", "notes"]
            )
            for c in priors
        ],
    }


async def load_installer(db: AsyncSession) -> models.KBInstaller | None:
    """The installer's own facts (warranty, service SLA, equipment) — grounds the
    comparison / stakeholder visuals."""
    res = await db.execute(select(models.KBInstaller).limit(1))
    return res.scalar_one_or_none()


async def latest_quote(db: AsyncSession, customer_id: uuid.UUID) -> models.Quote | None:
    res = await db.execute(
        select(models.Quote)
        .where(models.Quote.customer_id == customer_id)
        .order_by(models.Quote.created_at.desc())
        .limit(1)
    )
    return res.scalar_one_or_none()


async def current_profile(
    db: AsyncSession, customer_id: uuid.UUID
) -> models.Profile | None:
    res = await db.execute(
        select(models.Profile).where(models.Profile.customer_id == customer_id)
    )
    return res.scalar_one_or_none()


async def recent_interactions(
    db: AsyncSession, customer_id: uuid.UUID, limit: int = 10
) -> list[models.Interaction]:
    res = await db.execute(
        select(models.Interaction)
        .where(models.Interaction.customer_id == customer_id)
        .order_by(models.Interaction.occurred_at.desc())
        .limit(limit)
    )
    return list(res.scalars().all())


def quote_dict(q: models.Quote | None) -> dict | None:
    if q is None:
        return None
    return {
        "price_eur": float(q.price_eur) if q.price_eur is not None else None,
        "monthly_saving_eur": float(q.monthly_saving_eur)
        if q.monthly_saving_eur is not None
        else None,
        "payback_years": float(q.payback_years) if q.payback_years is not None else None,
        "annual_return_pct": float(q.annual_return_pct)
        if q.annual_return_pct is not None
        else None,
        "co2_tons_25y": float(q.co2_tons_25y) if q.co2_tons_25y is not None else None,
        "product_summary": q.product_summary,
        "financing": q.financing,
    }


def profile_dict(p: models.Profile | None) -> dict | None:
    if p is None:
        return None
    return {
        "motivation": p.motivation,
        "motivation_conf": float(p.motivation_conf) if p.motivation_conf else None,
        "buyer_type": p.buyer_type,
        "negotiation": p.negotiation,
        "summary": p.summary,
        "objections": p.objections,
        "completeness": p.completeness,
    }


def interaction_dicts(rows: list[models.Interaction]) -> list[dict]:
    return [
        {
            "channel": i.channel,
            "direction": i.direction,
            "occurred_at": i.occurred_at.isoformat() if i.occurred_at else None,
            "transcript_md": i.transcript_md,
            "content": i.content,
            "outcome": i.outcome,
            "rep_gut_feel": i.rep_gut_feel,
        }
        for i in rows
    ]
