# CloseLoop — Demo Guide & Example Output

**CloseLoop** closes the gap between *"quote sent"* and *"contract signed."* It
re-engages homeowners whose solar quote went quiet, builds an **evidence-backed
profile** of each one, scores their **likelihood to close** in real time, and
hands the rep a **single explained next-best-action** they approve in one click —
which then writes (and sends) the message, on the channel that fits the customer.

Not a CRM, not a lead-gen tool. It owns the silent gap where deals die.

---

## 1. The 90-second live walkthrough

1. **Dashboard (pipeline, ranked).** Customers ranked by **Deal Score** (0–100)
   with a **trend arrow** and a **ghost-risk** pill. "Who do I push today?" at a
   glance. The score is **event-sourced** — it *moves* as things happen.
2. **Open a customer → the reasoning is visible.**
   - **Profile (2 layers):** *motivation* (why they want solar) + *negotiation*
     (how they'll behave) — every read backed by the customer's **own words**
     (evidence quote). Labels are cheap; evidence is trust.
   - **Recommended action — the hero:** channel + timing + goal, and the
     **WHY** rendered prominently (the judged "explainable" moment).
3. **Conversation surface (multi-channel).** Pick the channel — the AI's
   recommended one is highlighted. For chat (WhatsApp/SMS) the AI shows the
   **recommended opening message**; tap **Send**.
4. **Live co-pilot (the killer moment).** When the customer **messages back on
   WhatsApp**, their text appears live and the AI instantly suggests the **read +
   exact reply lines + why** (objection playbook). The rep edits and sends.
5. **The score reacts.** Log a visit / get a positive reply → the Deal Score
   **moves with a one-line reason** ("+18: agreed to a home visit"); ghost-risk
   updates. The pipeline re-ranks.

> **Stage-proof:** runs in DEMO mode (deterministic fallbacks, no external calls)
> *and* live (OpenAI + Twilio). Familie Müller is the seeded golden path.

---

## 2. Example output — two buyer types, two strategies

Same product and quote economics. The AI reads each customer differently and
produces a **coherent, distinct strategy** — not a templated email.

### A · The Family — *Familie Müller*
- **Read:** motivation = savings; spouse not yet aligned; winter-yield doubt;
  comparing other quotes → multi-quote risk.
- **Strategy:** warm, low-pressure, trust-first. **Channel: WhatsApp · within 48h.**
- **Why:** "Family with an open objection — a warm, low-pressure nudge on the
  channel they respond to keeps the deal moving without applying pressure."
- **Drafted message (de):** *"Hallo Familie Müller! 😊 Ich wollte kurz nachfragen,
  ob ihr noch Fragen habt. Ihr könnt 140 € im Monat sparen und mit 150 Tonnen
  CO₂-Einsparung über 25 Jahre viel für die Umwelt tun…"*

### B · The Investor — *Herr Schmidt*
- **Read:** ROI/payback-driven ("13% jährlich… verglichen mit meinem ETF?"),
  comparing options, **will decide fast if the numbers add up**.
- **Strategy:** lead with the math, move quickly. **Play: `fast_lock`. Channel:
  Email · within 24h.**
- **Why:** "Sending the requested financial breakdown addresses his ROI/payback
  concerns and helps him decide quickly."
- **Drafted message (de):** a structured financials email —
  *"Monatliche Einsparungen: 95 € · Amortisationszeit: 8 Jahre · Jährliche
  Rendite: 13 % · CO₂-Einsparung über 25 Jahre…"*

**The contrast is the point:** same engine, but the family gets reassurance over
WhatsApp and the investor gets numbers over email, fast. (The seed also includes
an **environmentalist** — CO₂/impact framing — and a **skeptic** —
comparison-arming — for more variety.)

---

## 3. Why this approach (the strategy)

- **Evidence-first profile.** Two layers (motivation + negotiation), every read
  tied to a quote from the customer. The rep can *trust and learn* the play.
- **One explained next-best-action**, not a wall of options — channel, timing,
  goal, and a legible WHY. Human-in-the-loop: the rep approves in one click.
- **Objection playbook co-pilot.** A fixed sales skeleton (8 objection
  categories) the AI classifies into, then applies live — read · exact lines ·
  why · an advance hook that becomes a Cadence to-do. Works the same across
  phone / WhatsApp / SMS.
- **Event-sourced Deal Score = Ghost Radar.** One number that moves by fixed,
  explainable deltas (micro-commitments up, silence/stalling down). Predictive:
  "this one's ready" vs "this one's going cold."
- **Multi-channel, real-time.** WhatsApp/SMS round-trip (Twilio): inbound →
  suggestion pushed live to the rep → approved reply sent back.

---

## 4. Running it

```bash
# backend
cd backend && python -m app.seed && uvicorn app.main:app --port 8000
# frontend
cd frontend && npm install && npm run dev          # http://localhost:5173 (live)
#                                                    add ?mock=1 for a no-backend demo
```

- **Live reasoning:** set `OPENAI_API_KEY` in `backend/.env`.
- **Live WhatsApp/SMS:** set Twilio creds + `REAL_SEND=true`, expose the webhook
  (`ngrok http 8000`), point Twilio's inbound webhook at `/api/webhooks/{sms,whatsapp}`.
  See [`WHATSAPP.md`](./WHATSAPP.md). Inbound (customer → suggestion) needs **no**
  number verification; outbound replies do (on a Twilio trial).
- **Add customers:** "+ Add customer" on the dashboard — manual, or upload
  JSON/CSV (a customers file + an optional quotes file matched by key).
