# CloseLoop — Backend

FastAPI + SQLAlchemy (async) + Postgres + OpenAI structured output.
Implements the REST contract and the three reasoning services from
[`../02-backend-spec.md`](../02-backend-spec.md), over the schema in
[`../01-data-schema.md`](../01-data-schema.md).

## Quick start

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # then fill in DATABASE_URL + OPENAI_API_KEY

# Option A — local Postgres via Docker
docker compose up -d db

# Option B — Supabase (set DATABASE_URL to your project's connection string,
#            see "Database" below)

python -m app.seed              # creates tables + seeds KB, reps, demo customers
uvicorn app.main:app --reload   # http://localhost:8000  (docs at /docs)
```

> **DEMO mode:** with no `OPENAI_API_KEY` the reasoning services use
> deterministic fallbacks, so the seeded golden path (Familie Müller) runs
> end-to-end with no external calls. Add the key for real LLM reasoning.

## Database

Tables are created automatically on startup / seed (`Base.metadata.create_all`)
plus the `pgcrypto` extension for `gen_random_uuid()`.

- **Local:** `docker compose up -d db` → `postgresql+asyncpg://closeloop:closeloop@localhost:5432/closeloop`
- **Supabase:** use the **session pooler** connection string from
  *Project → Connect*, in async form:
  `postgresql+asyncpg://postgres.<ref>:<password>@<host>:5432/postgres`
  (swap the `postgresql://` scheme for `postgresql+asyncpg://`).

## API surface (03 §3)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/customers?sort=sign_likelihood&order=desc` | ranked dashboard list |
| GET | `/api/customers/{id}` | full detail view |
| POST | `/api/customers/import` | bulk import customers + quotes |
| POST | `/api/customers/{id}/call` | trigger voice agent (enqueue/mock) |
| POST | `/api/customers/{id}/reanalyze` | re-run ANALYZE |
| POST | `/api/customers/{id}/interactions` | log a human touch → reanalyze |
| POST | `/api/customers/{id}/outcomes` | record an outcome (L3 loop) |
| POST | `/api/recommendations/{id}/approve` | approve → run COMPOSE → draft |
| POST | `/api/recommendations/{id}/dismiss` | dismiss |
| PATCH | `/api/messages/{id}` | rep edits the draft |
| POST | `/api/messages/{id}/send` | send via channel adapter (mock in L1) |
| POST | `/api/copilot/respond` | live RESPOND co-pilot |
| GET | `/api/copilot/collect/{id}` | next gap-filling question |
| POST | `/api/webhooks/voice/transcript` | voice agent hands off → ANALYZE |

## Reasoning services (02 §4)

- **ANALYZE** (`services/analyze.py`) — profiler + strategist merged: profile +
  evidence signals + extracted actions + score + one recommendation. Persists
  everything and supersedes the prior pending recommendation.
- **COMPOSE** (`services/compose.py`) — channel-specific message on Approve.
- **RESPOND** (`services/respond.py`) — live co-pilot; pre-matches KB objections.

Each validates strict JSON against a Pydantic schema (`schemas.py`), retries once
on mismatch, and has a deterministic DEMO fallback.

## Layout

```
app/
  main.py            FastAPI app + router wiring
  config.py          env settings
  db.py              async engine / session / init
  models.py          SQLAlchemy ORM (mirrors 01-data-schema.md)
  schemas.py         Pydantic: LLM contracts + API shapes
  serializers.py     ORM → API response builders
  seed.py            KB + reps + demo customers (Müller golden path)
  routers/           customers, recommendations, messages, copilot, webhooks
  services/          llm, analyze, compose, respond, loaders, prompts
  adapters/          channel adapters (MockAdapter for L1)
```
