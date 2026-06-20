# CloseLoop — Backend Spec
**Owner: LLM/Backend dev**

Stack: Node/Express or Python/FastAPI. REST + JSON. Schema in `01`. The **reasoning contracts in §4 are the most important thing in this doc** — they are the seam the frontend and data devs build against.

---

## 1. Responsibilities
- CRUD + REST API for the frontend (§3)
- Orchestrate the 3 LLM functions (§4)
- Compute / persist scores (§5)
- Receive the voice agent webhook (`§6`) → create interaction → run ANALYZE
- Send messages via a channel adapter (§7)

## 2. Conventions
- All IDs uuid. Times ISO-8601 UTC. Money in EUR numeric.
- LLM calls use **structured output / JSON mode** — validate against the schema, retry once on parse failure, never return malformed JSON to the client.
- Keep prompts + KB in version control; KB is loaded from DB and injected into prompts.

## 3. REST API (frontend contract)

```
GET    /api/customers?sort=sign_likelihood&order=desc
  → [{ id, name, buyer_type, sign_likelihood, ghost_risk, stage,
       next_action:{channel,timing_label}, assigned_rep:{id,name},
       last_contact_at }]                       # the dashboard list

GET    /api/customers/:id
  → { customer, quote, profile, signals[], interactions[],
      extracted_actions[], recommendation (current, status≠sent/dismissed),
      assignment:{rep,reason} }                 # the detail view

POST   /api/customers/import           body: {customers:[...], quotes:[...]}  → {imported:n}
POST   /api/customers/:id/call         → triggers voice agent (or enqueues)  → {call_id}
POST   /api/customers/:id/reanalyze    → re-runs ANALYZE (ghost radar / new info) → {recommendation, score}

# human-in-the-loop
POST   /api/recommendations/:id/approve
  → sets status=approved, runs COMPOSE, returns {message}   # one click → draft back
POST   /api/recommendations/:id/dismiss → {ok}
PATCH  /api/messages/:id                body:{subject?,body}  → {message}   # rep edits
POST   /api/messages/:id/send          → channel adapter; sets sent; logs interaction → {ok, interaction}

# logging a human touch (visit/call note + gut feel) → triggers reanalyze
POST   /api/customers/:id/interactions
  body:{channel,direction,content?,rep_gut_feel?,outcome?,transcript_md?}
  → {interaction, recommendation(updated), score(updated)}

# live co-pilot
POST   /api/copilot/respond            body:{customer_id, utterance}  → RESPOND output (§4.3)
GET    /api/copilot/collect/:customer_id → {question}   # next gap-filling question

# outcomes (L3 loop)
POST   /api/customers/:id/outcomes     body:{recommendation_id?,result,notes?} → {ok}
```

## 4. Reasoning service contracts (LLM I/O) — **build to these exactly**

### 4.1 ANALYZE  (profiler + strategist, merged for L1)
Runs after a call, after a logged human interaction, or on `/reanalyze`.

**Input**
```json
{
  "customer": { "name":"...", "language":"de", "stage":"quoted", "last_contact_at":"..." },
  "quote": { "price_eur":18000, "monthly_saving_eur":140, "payback_years":9.5,
             "annual_return_pct":11, "co2_tons_25y":150, "product_summary":"12 kWp + 10 kWh" },
  "existing_profile": { /* current profile or null */ },
  "interactions": [ { "channel":"voice_ai","occurred_at":"...","transcript_md":"...","outcome":"..." } ],
  "knowledge_base": { "buyer_types":[...], "objections":[...], "plays":[...],
                      "channel_priors":[...] }
}
```

**Output (strict)**
```json
{
  "profile": {
    "motivation": "peace_of_mind",
    "motivation_conf": 0.8,
    "buyer_type": "family",
    "negotiation": { "multi_quote_risk":"high", "price_sensitivity":"medium",
                     "decision_speed":"slow", "decision_makers":["husband","wife"],
                     "blockers":["spouse_buy_in"], "buying_signals":[] },
    "summary": "Family, reassurance-driven, comparing 2 other quotes, wife not yet aligned. Winter-yield doubt.",
    "objections": [ {"key":"winter_yield"}, {"key":"need_other_quotes"} ],
    "completeness": 70
  },
  "signals": [
    { "layer":"negotiation", "label":"multi_quote_risk: HIGH",
      "evidence_quote":"we want to check other companies", "confidence":0.9 },
    { "layer":"objection", "label":"winter_yield doubt",
      "evidence_quote":"does it even work in winter?", "confidence":0.85 }
  ],
  "extracted_actions": [
    { "type":"callback", "detail":"Call back Tue after 17:00", "due_at":"2026-..T17:00:00Z" }
  ],
  "score": {
    "sign_likelihood": 55,
    "ghost_risk": "medium",
    "components": { "engagement":0.6,"objection_severity":0.5,"buying_signals":0.2,"recency":0.7 },
    "reason": "Engaged on the call but actively comparing quotes; spouse not aligned."
  },
  "recommendation": {
    "channel": "visit",
    "timing_label": "within 48h",
    "timing_at": "2026-..",
    "goal": "Build trust and address spouse buy-in before competing quotes land",
    "rationale": "Family + commitment-shy + multi-quote risk HIGH → trust beats reach. A home visit converts this type better than email; speed matters because competing quotes are in play.",
    "play_key": "home_visit_trust",
    "priority": 90
  }
}
```
Persist: upsert `profiles`, insert new `profile_signals` + `extracted_actions`, insert `recommendation` (supersede prior pending one), update `customers.sign_likelihood/ghost_risk/next_action_at`, insert `score_history`.

**Prompt skeleton:** system = "You are a solar-sales strategist. Use ONLY the provided KB and quote. Every profile read MUST include the customer's own words as evidence. Output one recommendation with an explicit why. Return JSON matching the schema." user = the input JSON.

### 4.2 COMPOSE  (on Approve click)
**Input** `{ recommendation, profile, quote, buyer_type_kb, language }`
**Output**
```json
{ "channel":"whatsapp", "subject":null,
  "body":"Hallo Familie Müller, ... (warm, references €140/month saving, addresses winter yield, no pressure) ...",
  "language":"de" }
```
Tone comes from `kb_buyer_types.default_tone`. Respect `customer.language` (German by default). Keep it short for SMS/WhatsApp, structured for email.

### 4.3 RESPOND  (live co-pilot, during a human call/visit)
**Input** `{ profile, utterance:"it's a lot of money, and we want to check other companies", recent_context }`
**Output**
```json
{ "read":"value gap + multi-quote risk, not a price objection",
  "type":"objection",
  "tone":"calm, confident, no discounting",
  "exact_lines":[
    "I completely understand — it's a big decision. Most families find it easier to look at it as about €140 a month, less than ...",
    "Comparing is smart. The thing to check across quotes is the equipment and the warranty, not just the headline price — happy to show you what to look for."
  ],
  "why":"Discounting here signals the price was padded; reframing to monthly cost + arming them for the comparison protects the deal." }
```
Backed by `kb_objections`. This is the highest-impact live demo moment — keep latency low (small prompt, no KB dump, pass only matched objection rows if you pre-match).

## 5. Scoring
`sign_likelihood` (0–100) is produced by ANALYZE from components. Don't train a model. Components (each 0–1, weighted, documented in the `reason`):
- **engagement** (did they talk, answer, show interest)
- **objection_severity** (inverse — more/harder objections lower the score)
- **buying_signals** (asked about install date, financing, etc.)
- **recency** (decays with silence → also drives `ghost_risk`)

**Ghost Radar (L2):** a scheduled job (or manual `/reanalyze`) that, when `now - last_contact_at` exceeds a per-buyer-type threshold, lowers recency, raises `ghost_risk`, and makes ANALYZE escalate the next channel (e.g. email → visit).

## 6. Voice webhook
```
POST /api/webhooks/voice/transcript
body: { customer_id, recording_url?, transcript_md, transcript_raw?,
        collected:{ motivation_hint?, timeline?, hesitations?[], callback_request? } }
→ insert interaction(channel=voice_ai, created_by=voice_agent)
→ insert extracted_actions from collected.callback_request
→ run ANALYZE
→ 200 {ok}
```
See `04-voice-agent-spec.md` for the producing side.

## 7. Channel adapters
Interface: `send(channel, to, {subject?, body}) → {provider_id, status}`.
- **L1:** `MockAdapter` — logs, marks sent, returns ok (demo shows the drafted message + "sent ✓").
- **L2:** real **email** (Resend/SendGrid) + **WhatsApp** (WhatsApp Cloud API / Twilio). Inbound replies → `POST /api/customers/:id/interactions(direction=inbound)` → reanalyze (closes the loop visibly).

## 8. Env / config
`OPENAI_API_KEY`, `ELEVENLABS_API_KEY`, `DATABASE_URL`, channel keys (L2). Feature flags: `LIVE_VOICE`, `REAL_SEND`, `GHOST_RADAR`.
