# CloseLoop — Deal Score: each customer's likelihood to close

**What this is:** a 0–100 score per customer that tells you at a glance **who's most likely to close, and who to push today.** It's not a static label — it moves in real time as things actually happen in the deal: the customer replies "okay" after you send docs, agrees to a home visit, no-shows a call, goes quiet for days… each event pushes the score up or down.

**Why it's worth building:**
- Hits Reonic's predictive-insight bonus head-on — it can say both "this customer's ready, push now" and "this one's going cold."
- With a pile of deals, it tells the rep **where to spend their energy** (sort the whole pipeline by score).
- On stage it's a **number that moves** — the moment the customer agrees to a home visit, the score jumps. Intuitive and persuasive.

**Relationship to Ghost Radar:** they're **two ends of the same score** — positive engagement pushes it up, silence and stalling pull it down; **Ghost Radar = the alert that fires when the score drops low or falls fast.** One score, not three competing predictive widgets.

**Scores are locked for the demo** — the point values below are fixed (no tuning needed). They're rough heuristics, not science, but enough to rank customers hot → cold.

---

## Part 1 — How to use it (not just a number)

**Starting score:** a new lead begins at **45** (neutral, unproven).

**① Bands → an action (turn the number into a move):**
- 🔥 **80–100 · Hot:** ready to sign — don't stall, push to close / book the final step.
- 🟢 **60–79 · Warm:** progressing — keep the rhythm, feed the next step on plan.
- 🟡 **40–59 · Cool:** stalled — needs an active nudge (a hook, a contact with a reason).
- 🔵 **0–39 · Cold:** ghost risk — escalate (email → home visit, change the person, change the angle).

**② Trend beats the absolute number:** a customer at 50 and rising is worth more than one at 60 and falling. **Show an arrow (↑ / ↓)**, not just the number.

**③ It must be explainable:** every move carries a one-line reason — "+18: agreed to a home visit," "−10: three days silent." Same "always explain why" spirit as the rest of the product, no black-box scoring. The rep doesn't just see the score move — they learn which moves work.

**④ What it drives:** sorts the whole pipeline (who to hit today) + triggers Cadence / Ghost actions (low / falling → escalate; high → "strike now, they're ready").

---

## Part 2 — Signals that push the score UP

> Core rule: **the more an action costs in time or commitment, the more it's worth** — talk is cheap, doing is expensive.

**Micro-commitments (the gold — every small "yes" predicts the big one):**
- Agrees to a **home visit** — **+18** (strong: a visit costs their time, a real commitment)
- Agrees to a **call / meeting** — **+12**
- **Takes the hook / agrees to a next step** ("sure, send it Wednesday") — **+8**
- **Acknowledges** docs received ("got it / okay / had a look") — **+6**
- **Actually shows up** to what they agreed (no no-show) — **+10**

**Buying signals (mentally past "whether," now on "how"):**
- Asks **"when can it be installed / how long does it take"** — **+15** (planning it in)
- Asks about **financing / payment / instalments** — **+12** (thinking about how to pay = intent)
- Asks **logistics** — install details, process, timeline — **+10** (from "evaluating" to "planning")
- **Brings the decision-maker in** ("my wife wants to sit in," "we'll look together this weekend") — **+15** (the blocker starts engaging)
- Talks in terms of **"when," not "whether"** — **+8**

**Engagement / responsiveness:**
- **Initiates** contact (asks you a question, reaches out) — **+10** (strong buying signal)
- Replies **promptly** (faster than expected) — **+3**
- Replies at all (vs silence) — **+2**
- **Opens / reads** the docs you sent — **+4**

**Sentiment / progress:**
- Positive language ("sounds good," "we're excited") — **+5**
- An old objection is resolved and not re-raised — **+5**
- **Moves up a stage** (quote → discussion → visit booked) — **+9** per stage

---

## Part 3 — Signals that push the score DOWN

**Disengagement / silence (this is the Ghost signal):**
- **No reply past the expected window, per day** — **−4 / day** (the longer, the more it drops)
- Replies slow down / keeps delaying — **−3**
- Stops opening your messages / docs — **−5**

**Stalling / resistance:**
- Keeps raising **new objections without resolving** them (esp. "let me think," "no rush") — **−6**
- **Re-raises an objection already handled** — **−5** (it didn't actually land last time)
- Repeated "still comparing" with no forward motion — **−5**
- Repeatedly pushes on price / wants a discount — **−4** (could be a real budget issue — check the profile)
- Mentions a competitor **more favorably** ("the other company quoted X / threw in Y") — **−10**
- The **decision-maker stays absent** ("I still need to ask my wife" on repeat) — **−5**

**Broken commitments (strong negatives — doing damage beats saying it):**
- **No-show** (missed an agreed call / visit) — **−20**
- Repeated **cancels / reschedules** — **−12**
- **Declines** a proposed next step — **−8**
- Says **"no rush / maybe next year"** — **−15** (timing stall)

**Hard stops (score crashes):**
- Says they **went with a competitor** — **set to 0**
- Says they're **no longer interested** — **set to 0**

**Time decay (passive cooling):**
- **Nothing happening, just time passing** — **−1 / day** (slow decay)
- Why: deals go cold over time even with no explicit bad news — the decay creates natural urgency and forces the system to nudge the rep. *(Don't stack with the silence penalty — if they owe a reply it's −4/day; if it's just quiet with nothing pending, −1/day.)*

---

## Part 4 — Design principles (for the engineers + to avoid the usual traps)

- **Trend + absolute, together:** store the last few changes and compute whether it's rising or falling — that predicts better than the current number alone.
- **The profile modulates the read:** a "commitment-shy family" is naturally slow — don't write them off for it. The same three days of silence is a bad sign for an impatient buyer and normal for this type. Set different "silence-tolerance windows" per profile type.
- **Every change must be explainable:** don't store a bare number — store "value + why it changed this time + timestamp," so the side panel can show the "why" and the demo can display it.
- **Cap / debounce:** clamp to 0–100; don't let a single event swing it to an extreme; don't double-count the same signal in a short window (three messages in a row isn't three "initiates contact").

---

## Part 5 — How it moves in the Müller demo (live on stage)

As the line runs, the score **moves in front of the jury** at the key beats, with the "why" beside it. Locked values:

- **After Step 0 (first call):** he talked and shared info = a base; but commitment-shy + comparing + winter doubt hold it down. → **50 (cool-warm).**
- **After Step 2 (objection handled):** price / comparison handled well + a hook offered → **+5 → 55** (why: objection resolved, next step offered).
- **At Step 3 ("wife not on board" logged):** a clear blocker identified → slight dip / risk flag → **−5 → 50** (why: decision blocker = wife not convinced).
- **At Step 4 (agrees to a home visit within 48h):** **strong positive +18 → 68, warm, arrow ↑** (why: agreeing to a visit = a big commitment, close-likelihood clearly up).

That curve — cool-warm → dips on the blocker → jumps when they agree to the visit — is exactly what brings the product's "reacts in real time" to life.

---

### Notes for the build
- **One score, not three:** Deal Score + Ghost Radar + "ready to close" are bands / trends of the same score — merge them.
- **Store:** the value + each change's "why" + a timestamp (for explainability + trend).
- **Drives:** pipeline sorting + Cadence / Ghost actions.
- **Weights are locked for the demo** — but keep them in one config block, not hard-coded across the codebase.
