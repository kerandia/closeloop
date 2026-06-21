"""Closing Kit agent endpoints — generate a buyer-tailored visual for a customer
and serve the stored artifact. Additive; isolated from the existing flow."""

from __future__ import annotations

import base64
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.db import get_db
from app.services import closing_kit

router = APIRouter(prefix="/api", tags=["agent"])


# the visual assets the agent can produce
_KINDS = {"auto", "spouse", "comparison", "winter", "etf"}


@router.post("/customers/{customer_id}/closing-kit")
async def generate_closing_kit(
    customer_id: uuid.UUID,
    kind: str = Query("auto"),
    db: AsyncSession = Depends(get_db),
):
    customer = await db.get(models.Customer, customer_id)
    if customer is None:
        raise HTTPException(status_code=404, detail="customer not found")
    if kind not in _KINDS:
        kind = "auto"

    result = await closing_kit.generate(db, customer, kind=kind)
    artifact = models.Artifact(
        customer_id=customer.id,
        kind=result["kind"],
        buyer_type=result["buyer_type"],
        title=result["title"],
        mime=result["mime"],
        content_b64=base64.b64encode(result["content"]).decode("ascii"),
        source=result["source"],
    )
    db.add(artifact)
    await db.commit()
    await db.refresh(artifact)
    return {
        "id": str(artifact.id),
        "title": artifact.title,
        "mime": artifact.mime,
        "buyer_type": artifact.buyer_type,
        "kind": artifact.kind,
        "source": artifact.source,  # 'agent' (Code Interpreter) or 'fallback' (SVG)
        "url": f"/api/artifacts/{artifact.id}",
    }


@router.get("/artifacts/{artifact_id}")
async def get_artifact(artifact_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    a = await db.get(models.Artifact, artifact_id)
    if a is None:
        raise HTTPException(status_code=404, detail="artifact not found")
    return Response(content=base64.b64decode(a.content_b64), media_type=a.mime)
