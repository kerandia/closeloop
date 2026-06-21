"""CloseLoop backend — FastAPI app entrypoint."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import init_db
from app.routers import (
    copilot,
    customers,
    management,
    messaging,
    messages,
    notes,
    recommendations,
    webhooks,
)
from app.services.llm import DEMO_MODE

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("closeloop")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    if DEMO_MODE:
        logger.warning(
            "Running in DEMO mode (no OPENAI_API_KEY) — reasoning services use "
            "deterministic fallbacks."
        )
    yield


app = FastAPI(title="CloseLoop API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(customers.router)
app.include_router(recommendations.router)
app.include_router(messages.router)
app.include_router(copilot.router)
app.include_router(webhooks.router)
app.include_router(messaging.router)
app.include_router(management.router)
app.include_router(notes.router)


@app.get("/health", tags=["meta"])
async def health():
    return {"status": "ok", "demo_mode": DEMO_MODE}


@app.get("/", tags=["meta"])
async def root():
    return {"service": "CloseLoop API", "docs": "/docs"}
