# CloseLoop

**A post-quote deal-closer for solar installers.**

> Reonic Track · {Tech: Europe} Energy × AI Hackathon · Build Spec v1

CloseLoop re-engages homeowners whose solar quote went quiet, builds an
evidence-backed profile of each one, and hands the sales rep a **ranked
dashboard** with a **single explained next-best-action** they approve in one
click — which then writes the message.

We are **not** building a CRM (Reonic has one) and **not** building a lead
generator (Reonic scores cold leads already). CloseLoop owns the silent gap
between **quote sent → contract signed**.

---

## The golden path

```
[1] Customers + quotes imported (seeded / CSV)
[2] Voice AI calls a stalled customer            → ElevenLabs agent
        (warm re-engagement, fills profile gaps)
[3] Transcript + extracted data → backend webhook
[4] ANALYZE  (one LLM call)                       → profile + evidence + score + recommendation
[5] DASHBOARD — customers ranked by sign-likelihood
[6] HUMAN IN THE LOOP — rep clicks "Approve & Compose"
[7] COMPOSE  (one LLM call)                       → channel-specific message draft
[8] Rep edits → Send (mocked in L1, real in L2)
[9] Outcome captured → updates profile (feeds the brain, L3)
```

## Reasoning services

| Service | Trigger | In | Out | Model |
|---|---|---|---|---|
| **Voice Agent** | batch / button | customer + quote context | transcript + structured fields | ElevenLabs |
| **Analyze** (profiler **+** strategist, merged) | after a call / on demand | transcript + quote + profile + history + KB | profile, signals, score, **one recommendation** | OpenAI |
| **Compose** | human clicks Approve | recommendation + profile + KB tone | channel-specific message draft | OpenAI |
| **Respond** (live co-pilot) | rep pastes what customer said | utterance + profile | read + exact lines + why | OpenAI |

## Tech stack

- **DB:** Postgres (+ `pgvector` only if you do KB retrieval; optional in L1)
- **Backend:** Node/Express or Python/FastAPI — REST, JSON
- **Frontend:** React (brand palette: ink `#0D1B27`, solar `#F5A623`, flux `#14B5A6`, paper `#F4F6F8`; Space Grotesk / IBM Plex Sans / IBM Plex Mono)
- **Voice:** ElevenLabs Conversational AI
- **Reasoning:** OpenAI (structured JSON output / function-calling)
- **Channels:** mock adapter in L1; real email + WhatsApp in L2

## Scope — the cut-line

Each level is independently demo-able. **L1 is non-negotiable.** Everyone builds
the **Müller golden path** first.

- **L1 — must ship:** Seeded customers + quotes → ANALYZE → ranked dashboard →
  customer detail (summary, call actions, recommendation + WHY) → Approve →
  COMPOSE → review draft (send mocked). Voice can be a seeded transcript.
- **L2 — advanced:** Live ElevenLabs call · live RESPOND co-pilot · editable
  recommendation that re-reasons · Ghost Radar · real send · rep assignment.
- **L3 — going for it:** Visible learning loop · cross-customer brain · customer
  simulator · A/B variants · optional knowledge-graph visualization.

## Specs

| File | Owner | Contents |
|---|---|---|
| [`00-CloseLoop-overview.md`](./00-CloseLoop-overview.md) | everyone | system overview & architecture — **read first** |
| [`01-data-schema.md`](./01-data-schema.md) | Data/Backend | Postgres schema + knowledge base + seed data |
| [`02-backend-spec.md`](./02-backend-spec.md) | LLM/Backend | REST API + the LLM reasoning contracts |
| [`03-frontend-spec.md`](./03-frontend-spec.md) | Frontend | the two-screen demo surface |
| [`04-voice-agent-spec.md`](./04-voice-agent-spec.md) | Data/Integration | ElevenLabs voice re-engagement agent |

## Team mapping

- **Frontend dev** → `03` (the demo surface — most polish; this wins the room)
- **LLM/Backend dev** → `02 §4` reasoning contracts + `§3` API + `01` schema
- **Data/Integration dev** → `01` schema + `04` voice agent + the webhook (`02 §5`)
- **Business/sales** → seed the **knowledge base** (`01 §B`): buyer types,
  objection→response library, plays, cadence, talking points

## Glossary

- **Profile (2-layer):** *motivation* (why they want solar) + *negotiation* (how
  they'll behave). Every read carries an evidence quote.
- **Recommendation:** the one next-best-action — channel + timing + goal + rationale.
- **Knowledge Base (KB):** seeded sales intelligence the Analyze step reasons against.
- **Ghost Radar:** time-based risk that escalates the next move when a customer goes quiet.
- **Sign-likelihood:** 0–100 estimate of close probability (the dashboard rank key).
