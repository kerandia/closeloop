"""Build API response objects (03 §3 contract) from ORM rows."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models, schemas
from app.services import scoring as scoring_svc

ACTIVE_REC_STATUSES = ("pending", "approved", "composing", "ready")


async def customer_list_item(
    db: AsyncSession, c: models.Customer
) -> schemas.CustomerListItem:
    rep = None
    if c.assigned_rep_id:
        r = await db.get(models.Rep, c.assigned_rep_id)
        if r:
            rep = schemas.RepBrief(id=r.id, name=r.name)

    profile = (
        await db.execute(
            select(models.Profile).where(models.Profile.customer_id == c.id)
        )
    ).scalar_one_or_none()

    rec = await current_recommendation(db, c.id)
    next_action = (
        schemas.NextAction(channel=rec.channel, timing_label=rec.timing_label)
        if rec
        else None
    )

    return schemas.CustomerListItem(
        id=c.id,
        name=c.name,
        buyer_type=profile.buyer_type if profile else None,
        sign_likelihood=c.sign_likelihood,
        score_trend=await scoring_svc.trend(db, c.id),
        ghost_risk=c.ghost_risk,
        stage=c.stage,
        next_action=next_action,
        assigned_rep=rep,
        last_contact_at=c.last_contact_at,
    )


async def current_recommendation(
    db: AsyncSession, customer_id: uuid.UUID
) -> models.Recommendation | None:
    """The active recommendation: not sent/dismissed/superseded, highest priority."""
    res = await db.execute(
        select(models.Recommendation)
        .where(
            models.Recommendation.customer_id == customer_id,
            models.Recommendation.status.in_(ACTIVE_REC_STATUSES),
        )
        .order_by(
            models.Recommendation.priority.desc(),
            models.Recommendation.created_at.desc(),
        )
        .limit(1)
    )
    return res.scalar_one_or_none()


async def customer_detail(
    db: AsyncSession, c: models.Customer
) -> schemas.CustomerDetail:
    quote = (
        await db.execute(
            select(models.Quote)
            .where(models.Quote.customer_id == c.id)
            .order_by(models.Quote.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()

    profile = (
        await db.execute(
            select(models.Profile).where(models.Profile.customer_id == c.id)
        )
    ).scalar_one_or_none()

    signals = (
        await db.execute(
            select(models.ProfileSignal)
            .where(models.ProfileSignal.customer_id == c.id)
            .order_by(models.ProfileSignal.created_at.asc())
        )
    ).scalars().all()

    interactions = (
        await db.execute(
            select(models.Interaction)
            .where(models.Interaction.customer_id == c.id)
            .order_by(models.Interaction.occurred_at.desc())
        )
    ).scalars().all()

    actions = (
        await db.execute(
            select(models.ExtractedAction)
            .where(
                models.ExtractedAction.customer_id == c.id,
                models.ExtractedAction.status != "dismissed",
            )
            .order_by(models.ExtractedAction.due_at.asc().nullslast())
        )
    ).scalars().all()

    rec = await current_recommendation(db, c.id)

    customer_out = schemas.CustomerOut.model_validate(c)
    customer_out.score_trend = await scoring_svc.trend(db, c.id)

    assignment = None
    if c.assigned_rep_id:
        r = await db.get(models.Rep, c.assigned_rep_id)
        if r:
            assignment = schemas.Assignment(
                rep=schemas.RepBrief(id=r.id, name=r.name),
                reason=c.assignment_reason,
            )

    return schemas.CustomerDetail(
        customer=customer_out,
        quote=schemas.QuoteOut.model_validate(quote) if quote else None,
        profile=schemas.ProfileOut.model_validate(profile) if profile else None,
        signals=[schemas.SignalOut.model_validate(s) for s in signals],
        interactions=[schemas.InteractionOut.model_validate(i) for i in interactions],
        extracted_actions=[schemas.ExtractedActionOut.model_validate(a) for a in actions],
        recommendation=schemas.RecommendationOut.model_validate(rec) if rec else None,
        assignment=assignment,
    )
