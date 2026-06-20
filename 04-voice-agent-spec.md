# CloseLoop — Voice Agent Spec
**Owner: Data/Integration dev · ElevenLabs Conversational AI · unlocks the side challenge**

The voice agent is the **front door**: it makes a warm, low-pressure **re-engagement call** to a homeowner whose quote has gone quiet, fills the gaps in their profile, and hands off — before anything high-stakes — to a human and to the ANALYZE step. It is **not** a cold-lead qualifier and **never** closes or negotiates.

---

## 1. When it runs
On a stalled post-quote customer: triggered by `POST /api/customers/:id/call` (button or batch). The customer already received a quote (legitimate basis) and has `consent_voice = true`. Demo uses seeded/consented contacts.

## 2. Goals of the call (in priority order)
1. Re-establish warm contact, reference their quote naturally.
2. Surface **hesitations** (price, winter yield, comparing others, spouse, timing).
3. Learn their **motivation** (savings / environment / independence / peace of mind) and **timeline**.
4. Capture any **concrete ask** ("call me Tuesday after 5", "send me the financing breakdown").
5. Hand off gracefully; promise a human follow-up.

Hard rules: low pressure, no discounting, no commitments, no pricing renegotiation. If the customer wants to decide/buy now → "I'll have [rep] call you straight back" (hand off).

## 3. Dynamic variables passed in at call start
The agent is configured with these (from `customers` + latest `quote`):
```
{ customer_name, language ("de"|"en"),
  quote_product ("12 kWp + 10 kWh battery"),
  quote_price_eur, quote_monthly_saving_eur, quote_sent_days_ago,
  rep_name, known_gaps:["motivation","timeline"] }
```

## 4. System prompt (skeleton — German-first)
> You are {rep_name}'s friendly assistant from a solar installer, calling {customer_name} about the quote sent {quote_sent_days_ago} days ago ({quote_product}, about €{quote_monthly_saving_eur}/month saving). Speak {language}, warm and unhurried. Your job is to check in, understand any hesitations, and learn what matters to them — NOT to sell, discount, or close. Ask at most a few light questions. If they raise a concern, acknowledge it and note it — do not argue. If they want to move forward or push on price, tell them {rep_name} will call them back personally. Keep it under ~2–3 minutes. End warmly and confirm a human will follow up.

Conversational design: open with the check-in, one gap question at a time, reflect concerns back briefly, close with the hand-off promise.

## 5. Structured data the call MUST yield (ElevenLabs data-collection / evaluation fields)
Configure post-call extraction to emit:
```json
{
  "motivation_hint": "savings|environment|independence|peace_of_mind|unknown",
  "timeline": "e.g. 'deciding within a month' | 'unknown'",
  "hesitations": ["winter_yield","comparing_others","spouse","price","timing"],
  "comparing_competitors": true,
  "decision_makers_mentioned": ["wife"],
  "callback_request": { "wants_callback": true, "when": "Tue after 17:00" },
  "sentiment": "warm|neutral|cool",
  "handoff_reason": "wanted to negotiate price | none"
}
```
Also produce the **full transcript as markdown** (clean Q/A turns).

## 6. Handoff to backend
On call end, POST to the backend webhook (`02 §6`):
```
POST /api/webhooks/voice/transcript
{ customer_id, recording_url?, transcript_md, transcript_raw?, collected:{ ...§5 } }
```
Backend then: stores the interaction, creates `extracted_actions` from `callback_request`, and runs **ANALYZE** (which turns hesitations → objections with evidence, sets the score, and produces the recommendation). The voice agent does **no** profiling itself — it only collects.

## 7. Transcription → markdown
If using ElevenLabs' transcript, normalize to markdown:
```
**Agent:** Hi, is this {name}? Calling about your solar quote…
**Customer:** Yeah — honestly we're still comparing a couple of options.
...
```
Markdown because it's readable in the UI timeline and feeds ANALYZE cleanly. Recording URL stored on the interaction for playback (optional).

## 8. Guardrails / compliance
- Only call `consent_voice = true` customers; respect language.
- Identify as an assistant calling on behalf of {rep_name}/the installer.
- No pressure, no price/contract commitments — hand off instead.
- Offer an easy out ("now's not a good time" → apologize, offer callback, end).
- (Production note for the README: German B2C calling needs prior consent — UWG §7; the demo set is consented existing-quote customers.)

## 9. Levels
- **L1:** a **pre-recorded / seeded** call + transcript for the Müllers so the path is bulletproof, OR a single scripted outbound call. Either way the webhook → ANALYZE flow is real.
- **L2:** live outbound call on stage with the structured extraction firing into ANALYZE.
- **L3:** real two-way conversation that adapts, plus voice in the rep's own cloned tone (ElevenLabs) and multi-language.

## 10. Demo failure plan
Live telephony is the highest-variance thing on stage. **Always have the recorded Müller call + its transcript loaded** so you can fall back instantly without breaking the narrative ("here's a call we ran earlier") — the rest of the system runs identically off the stored transcript.
