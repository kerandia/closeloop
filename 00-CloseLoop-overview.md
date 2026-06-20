# CloseLoop — System Overview & Architecture
**Reonic Track · {Tech: Europe} Energy × AI Hackathon · Build Spec v1**

> Read this first. Then go to your file:
> - **Data / Backend** → `01-data-schema.md`, `02-backend-spec.md`
> - **Frontend** → `03-frontend-spec.md` (+ schema & backend API contract)
> - **Voice / Integration** → `04-voice-agent-spec.md`

---

## 1. What we're building (one sentence)
A **post-quote deal-closer** for solar installers: it re-engages homeowners whose quote went quiet, builds an evidence-backed profile of each one, and hands the rep a **ranked dashboard** with a **single explained next-best-action** they approve in one click — which then writes the message.

We are **not** building a CRM (Reonic has one) and **not** building a lead generator (Reonic scores cold leads already). We own the silent gap between **quote sent → contract signed**.

## 2. The end-to-end flow (the golden path)
```
[1] Customers + quotes imported (seeded / CSV)
        │
[2] Voice AI calls a stalled customer  ──────────►  ElevenLabs agent
        │   (warm re-engagement, fills profile gaps)
        ▼
[3] Transcript + extracted data → backend webhook
        │
[4] ANALYZE  (one LLM call)  ──────────►  reads transcript + quote + KB + history
        │   writes: profile (2-layer + evidence), score, recommendation
        ▼
[5] DASHBOARD  — customers ranked by sign-likelihood
        │   click a customer → summary, call actions, recommended action + WHY
        ▼
[6] HUMAN IN THE LOOP — rep clicks "Approve & Compose"
        │
[7] COMPOSE  (one LLM call)  ──────────►  writes the channel-specific message
        │
[8] Rep edits → Send (mocked in L1, real in L2)
        │
[9] Outcome captured → updates profile (+ feeds the brain, L3)
```

Yes — step **[4] writes the customer to the DB** (profile, signals, score, recommendation all persist). Yes — we **need a knowledge base** (the seeded sales intelligence the ANALYZE step reasons against; schema in `01`).

## 3. The reasoning services (how many "agents," and why)
You described ~4 agents. They are **not one fragile chain** — they fire at **different moments**, so we keep them as **3 distinct LLM functions** plus the voice agent. **Decision: for L1 we merge profiling + strategy into ONE call** to cut latency and failure points; split later if needed.

| Service | Trigger | In | Out | Model |
|---|---|---|---|---|
| **Voice Agent** | batch / button | customer + quote context | transcript + structured fields | ElevenLabs |
| **Analyze** (profiler **+** strategist, merged) | after a call / on demand | transcript + quote + profile + history + KB | profile, signals, score, **one recommendation** | OpenAI |
| **Compose** | human clicks Approve | recommendation + profile + KB tone | channel-specific message draft | OpenAI |
| **Respond** (live co-pilot) | rep pastes what customer said | utterance + profile | read + exact lines + why | OpenAI |

Full I/O contracts (strict JSON) are in `02-backend-spec.md §4`. Build to those contracts — they are the seam between the LLM dev and everyone else.

## 4. Tech stack (pragmatic, hackathon)
- **DB:** Postgres (+ `pgvector` only if you do KB retrieval; optional in L1)
- **Backend:** your call (Node/Express or Python/FastAPI) — REST, JSON
- **Frontend:** React + the design direction in `03`
- **Voice:** ElevenLabs Conversational AI (unlocks the side challenge)
- **Reasoning:** OpenAI (structured JSON output / function-calling mode)
- **Channels:** mock adapter in L1; real email + WhatsApp in L2 (`02 §6`)

## 5. Scope — the cut-line (do not skip this)
Each level is independently demo-able. **L1 is non-negotiable. Decide on the day how high you climb.** Everyone builds the **Müller golden path** first.

**L1 — must ship**
Seeded customers + quotes → ANALYZE (profile + evidence + score + one recommendation) → ranked dashboard → customer detail (summary, call actions, recommendation + WHY) → Approve → COMPOSE → review draft (send mocked). Voice call can be **pre-recorded/seeded transcript** if live is risky. Knowledge base is **seeded content**.

**L2 — advanced**
Live ElevenLabs call on stage · live RESPOND co-pilot · editable recommendation that re-reasons · Ghost Radar re-evaluation · real send (email/WhatsApp) · rep assignment.

**L3 — going for it**
Visible learning loop (record an outcome → a future recommendation changes on screen) · cross-customer brain · customer simulator · A/B variants · optional knowledge-graph visualization.

## 6. What I added / changed (flag for your veto)
These fill gaps in the flow you gave me:
1. **Merged profiler + strategist into one ANALYZE call** for L1 (latency, fewer break points). Split is trivial later.
2. **`extracted_actions` table** — your "call me at 5pm" needs to be parsed, stored, and surfaced on the dashboard. Added.
3. **Recommendation lifecycle states** (`pending → approved → composing → ready → sent → dismissed → superseded`) — the human-in-the-loop spine needs explicit status. Added.
4. **Scoring is LLM-estimated**, not a trained model (no data in a weekend). `sign_likelihood` 0–100 + component sub-scores + a reason string. Reframed as **deal-closing likelihood (post-quote)** to differentiate from Reonic's existing lead scoring.
5. **Import step + quote as first-class data** — the quote is the persuasion fuel (€/month, payback, CO₂). It gets its own table and the agent must cite it as evidence.
6. **Channel adapter interface** (mock default, real later) so "send" doesn't block L1.
7. **Consent fields** (`consent_voice`, `consent_marketing`) — these are *existing customers with a prior quote* (legitimate basis); calls still need consent. Keep it real for the German market; the demo uses seeded/consented contacts.
8. **Knowledge graph: deferred to L3, and only as a *visual*.** For L1/L2 the evidence-linked profile **is** the explainability. A graph DB in the backend would be a night spent on plumbing the jury can't see — build it only if you'll put it on screen.
9. **Voice agent reframed as post-quote re-engagement** (calling a stalled quote), not cold intake — that's where the prize money is, and it matches your demo.

## 7. Team mapping
- **Frontend dev** → `03` (the demo surface — most polish; this wins the room)
- **LLM/Backend dev** → `02 §4` reasoning contracts + `§3` API + `01` schema
- **Data/Integration dev** → `01` schema + `04` voice agent + the webhook (`02 §5`)
- **You (business/sales)** → seed the **knowledge base** (`01 §KB`): the 4 buyer types, the objection→response library, the cadence per type, the talking points. This is the *judgment* in the product — engineers build the frame, you fill it.

## 8. Glossary
- **Profile (2-layer):** *motivation* (why they want solar) + *negotiation* (how they'll behave). Every read carries an evidence quote.
- **Recommendation:** the one next-best-action — channel + timing + goal + rationale.
- **Knowledge Base (KB):** seeded sales intelligence the Analyze step reasons against.
- **Ghost Radar:** time-based risk that escalates the next move when a customer goes quiet.
- **Sign-likelihood:** 0–100 estimate of close probability (the dashboard rank key).
