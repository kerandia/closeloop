"""Call note-taking endpoint (Phase 3). Additive; isolated."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.db import get_db
from app.services import notes as notes_svc

router = APIRouter(prefix="/api/customers", tags=["notes"])


@router.post("/{customer_id}/call-notes")
async def call_notes(customer_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    customer = await db.get(models.Customer, customer_id)
    if customer is None:
        raise HTTPException(status_code=404, detail="customer not found")
    return await notes_svc.generate_call_notes(db, customer)
