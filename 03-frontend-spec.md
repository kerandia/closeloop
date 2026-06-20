# CloseLoop — Frontend Spec
**Owner: Frontend dev · this is the demo surface — it wins or loses the room, so it gets the most polish.**

React. Talks to the backend in `02 §3`. **Before building, read the `frontend-design` skill** for the design-token / styling direction; carry the existing brand palette from the pitch deck — ink `#0D1B27`, solar `#F5A623`, flux `#14B5A6`, paper `#F4F6F8`, fonts Space Grotesk (headings) / IBM Plex Sans (body) / IBM Plex Mono (labels).

The whole UI exists to make the AI's reasoning **visible and trustable**, and the next action **one click away**. Two screens.

---

## Screen 1 — Dashboard (pipeline, ranked)
The opening shot. A table/list of customers **ranked by `sign_likelihood` desc**.

**Row:**
- Name + buyer-type chip (family / investor / environmentalist / skeptic — color-coded)
- **Sign-likelihood** as a number + horizontal bar (color by band: red <40, amber 40–70, green >70)
- **Ghost-risk** pill (low/med/high)
- Stage
- **Next action** — channel icon + timing label ("Visit · within 48h")
- Assigned rep (avatar/initials) — L2
- Last contact (relative: "6 days ago")

**Controls:** sort (default likelihood), filter by stage / ghost-risk, search. A subtle "🔴 N going quiet" counter (ghost radar) is a nice tension cue.

Click a row → Screen 2.

`GET /api/customers?sort=sign_likelihood&order=desc`

---

## Screen 2 — Customer detail (the heart of the demo)
Layout: left = who they are + what they said; right = what to do. Sections:

### Header
Name · buyer-type chip · sign-likelihood (with the `score.reason` on hover) · stage · ghost-risk · assigned rep + **assignment reason** (L2).

### A. Recommended action card — **the hero element, top-right, impossible to miss**
From `recommendation`:
- Big: **channel + timing** ("🏠 Home visit · within 48h")
- **Goal** line
- **Rationale** — rendered prominently as *the WHY* (this is the judged "explainable" moment; don't bury it in grey text)
- **[Approve & Compose]** primary button → calls `POST /recommendations/:id/approve` → opens the Compose drawer with the returned draft
- secondary: **Dismiss**

### B. Compose drawer (opens on Approve)
- Channel-appropriate editor: subject (email only) + body, prefilled from COMPOSE
- Editable (`PATCH /messages/:id` on blur/save)
- **[Send]** → `POST /messages/:id/send` → toast "Sent ✓", drawer closes, a new interaction appears in the timeline (L1: mocked send; the *visible* draft is what matters)

### C. Profile (the explainability) — **evidence-first**
Two labelled layers:
- **Motivation** (with confidence) — e.g. "Peace of mind (0.8)"
- **Negotiation** — chips: `multi-quote risk: HIGH`, `decision: husband + wife`, `blocker: spouse buy-in`, `winter-yield doubt`
- **Each chip/read shows its `evidence_quote` on hover or inline** ("…we want to check other companies"). This is the differentiator — labels are cheap, evidence is trust.
- One-line `summary` at the top.

### D. Call actions / callbacks — prominent
From `extracted_actions`: "📞 Call back Tue after 17:00" with status toggle (open/done). Don't bury these — they're concrete and judges love that the AI caught a specific ask.

### E. Co-pilot panel (Guide) — L2, but stub the UI in L1
- **Respond:** input "What did the customer just say?" → submit → card with **read · exact lines (copyable) · why** (`POST /copilot/respond`). This is a killer live moment — make the response render fast and clean.
- **Collect:** a "Suggest next question" button → shows the gap-filling question (`GET /copilot/collect/:id`).

### F. Interaction timeline
Reverse-chronological `interactions`: channel icon, time, summary/outcome, expandable transcript (markdown) for calls/visits. A **"+ Log visit / note"** action opens a small form (note + **gut-feel** field + outcome) → `POST /customers/:id/interactions` → the profile + recommendation visibly **update** (great demo beat: log "wife hesitant" → watch the next play change to spouse-targeted).

### G. Cadence / strategy board — L2
The full multi-touch sequence (from `kb_cadence_templates`, tailored): a horizontal timeline of touches (day, channel, goal). Each step editable; editing re-runs ANALYZE for the rest. In L1, the single Recommended-action card stands in for this.

`GET /api/customers/:id` populates B–F in one call.

---

## States (don't skip — they read as polish)
- **Loading:** skeleton rows / cards (no spinners on the main board).
- **Empty:** "No customers yet — import a list" CTA.
- **Analyzing:** when a call/interaction just landed, show the recommendation card in a "thinking…" state, then animate it in (sells the live reasoning).
- **Error:** inline, retryable; never a blank screen on stage.

## Demo polish that matters
- The **score bar animating** up/down after a logged interaction.
- The **rationale** typed/faded in, not just present.
- Buyer-type and risk **color system** consistent across both screens.
- A single, beautiful **golden customer (Müller)** fully populated so the path never breaks.

## Component inventory
`CustomerTable`, `ScoreBar`, `BuyerTypeChip`, `GhostRiskPill`, `RecommendationCard`, `ComposeDrawer`, `MessageEditor`, `ProfilePanel` (+ `SignalChip` w/ evidence tooltip), `CallActionsList`, `CopilotPanel` (`RespondCard`, `CollectPrompt`), `InteractionTimeline` (`LogNoteForm`), `CadenceBoard` (L2).

## Don't build (scope guard)
Login/multi-tenant, settings, KB editor UI (seed in DB), analytics dashboards, anything not on the two screens above. If it's not in the Müller path, it waits.
