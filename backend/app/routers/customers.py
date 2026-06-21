"""Customer endpoints: dashboard list, detail, import, call, reanalyze,
interaction logging, outcomes (03 §3)."""

from __future__ import annotations

import datetime as dt
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models, schemas, serializers
from app.db import get_db
from app.services import analyze as analyze_svc

router = APIRouter(prefix="/api/customers", tags=["customers"])


def _utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


async def _get_customer(db: AsyncSession, customer_id: uuid.UUID) -> models.Customer:
    c = await db.get(models.Customer, customer_id)
    if c is None:
        raise HTTPException(status_code=404, detail="customer not found")
    return c


@router.get("", response_model=list[schemas.CustomerListItem])
async def list_customers(
    sort: str = Query("sign_likelihood"),
    order: str = Query("desc"),
    stage: str | None = None,
    ghost_risk: str | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(models.Customer)
    if stage:
        stmt = stmt.where(models.Customer.stage == stage)
    if ghost_risk:
        stmt = stmt.where(models.Customer.ghost_risk == ghost_risk)
    if search:
        stmt = stmt.where(models.Customer.name.ilike(f"%{search}%"))

    sort_col = getattr(models.Customer, sort, models.Customer.sign_likelihood)
    stmt = stmt.order_by(sort_col.desc().nullslast() if order == "desc" else sort_col.asc())

    rows = (await db.execute(stmt)).scalars().all()
    return [await serializers.customer_list_item(db, c) for c in rows]


@router.get("/{customer_id}", response_model=schemas.CustomerDetail)
async def get_customer(customer_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    c = await _get_customer(db, customer_id)
    return await serializers.customer_detail(db, c)


@router.post("/import", response_model=schemas.ImportResponse)
async def import_customers(
    body: schemas.ImportRequest, db: AsyncSession = Depends(get_db)
):
    ref_to_id: dict[str, uuid.UUID] = {}
    created_ids: list[uuid.UUID] = []

    for ic in body.customers:
        c = models.Customer(
            name=ic.name,
            email=ic.email,
            phone=ic.phone,
            address=ic.address or {},
            language=ic.language,
            stage=ic.stage,
            consent_voice=ic.consent_voice,
            consent_marketing=ic.consent_marketing,
            source=ic.source,
        )
        db.add(c)
        await db.flush()
        created_ids.append(c.id)
        if ic.ref:
            ref_to_id[ic.ref] = c.id

    for iq in body.quotes:
        cid = ref_to_id.get(iq.customer_ref) if iq.customer_ref else None
        if cid is None:
            continue
        db.add(
            models.Quote(
                customer_id=cid,
                system_size_kwp=iq.system_size_kwp,
                battery_kwh=iq.battery_kwh,
                product_summary=iq.product_summary,
                price_eur=iq.price_eur,
                monthly_saving_eur=iq.monthly_saving_eur,
                payback_years=iq.payback_years,
                annual_return_pct=iq.annual_return_pct,
                co2_tons_25y=iq.co2_tons_25y,
                financing=iq.financing,
                sent_at=iq.sent_at,
            )
        )

    await db.commit()

    # Run ANALYZE so each imported customer lands on the dashboard fully
    # populated (profile, signals, score, recommendation). Best-effort per
    # customer — a flaky LLM call shouldn't fail the whole import.
    for cid in created_ids:
        c = await db.get(models.Customer, cid)
        if c is not None:
            try:
                await analyze_svc.run_analyze(db, c)
            except Exception:  # noqa: BLE001
                pass

    return schemas.ImportResponse(imported=len(created_ids), customer_ids=created_ids)


@router.post("/{customer_id}/call")
async def trigger_call(customer_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Trigger the voice agent. In L1 this is enqueued/mocked; the real call and
    its webhook are owned by the Data/Integration workstream (04)."""
    c = await _get_customer(db, customer_id)
    if not c.consent_voice:
        raise HTTPException(status_code=409, detail="customer has not consented to voice")
    call_id = f"call_{uuid.uuid4().hex[:12]}"
    return {"call_id": call_id, "status": "enqueued"}


@router.post("/{customer_id}/reanalyze", response_model=schemas.ReanalyzeResponse)
async def reanalyze(customer_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    c = await _get_customer(db, customer_id)
    rec = await analyze_svc.run_analyze(db, c)
    await db.refresh(c)
    return _reanalyze_response(c, rec)


@router.post("/{customer_id}/interactions", response_model=schemas.InteractionLogResponse)
async def log_interaction(
    customer_id: uuid.UUID,
    body: schemas.InteractionCreate,
    db: AsyncSession = Depends(get_db),
):
    c = await _get_customer(db, customer_id)
    interaction = models.Interaction(
        customer_id=c.id,
        rep_id=body.rep_id,
        channel=body.channel,
        direction=body.direction,
        content=body.content,
        transcript_md=body.transcript_md,
        outcome=body.outcome,
        rep_gut_feel=body.rep_gut_feel,
        created_by="rep" if body.rep_id else "system",
    )
    db.add(interaction)
    c.last_contact_at = _utcnow()
    if c.stage == "quoted":
        c.stage = "contacted"
    await db.commit()
    await db.refresh(interaction)

    rec = await analyze_svc.run_analyze(db, c)
    await db.refresh(c)
    return schemas.InteractionLogResponse(
        interaction=schemas.InteractionOut.model_validate(interaction),
        recommendation=schemas.RecommendationOut.model_validate(rec) if rec else None,
        score=_score_out(c),
    )


@router.post("/{customer_id}/outcomes")
async def record_outcome(
    customer_id: uuid.UUID,
    body: schemas.OutcomeCreate,
    db: AsyncSession = Depends(get_db),
):
    c = await _get_customer(db, customer_id)
    db.add(
        models.Outcome(
            customer_id=c.id,
            recommendation_id=body.recommendation_id,
            result=body.result,
            notes=body.notes,
        )
    )
    if body.result == "won":
        c.stage = "won"
    elif body.result == "lost":
        c.stage = "lost"
    await db.commit()
    return {"ok": True}


def _score_out(c: models.Customer) -> schemas.ScoreOut:
    return schemas.ScoreOut(sign_likelihood=c.sign_likelihood, ghost_risk=c.ghost_risk)


def _reanalyze_response(
    c: models.Customer, rec: models.Recommendation
) -> schemas.ReanalyzeResponse:
    return schemas.ReanalyzeResponse(
        recommendation=schemas.RecommendationOut.model_validate(rec) if rec else None,
        score=_score_out(c),
    )
