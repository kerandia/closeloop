# CloseLoop — Real-time WhatsApp co-pilot

Customer messages on WhatsApp → CloseLoop matches them to a customer, runs the
RESPOND co-pilot, and **pushes the recommended reply to the rep's screen live**.
The rep edits/approves → it goes back out on WhatsApp. One round-trip.

```
Customer texts ──▶ Twilio ──▶ POST /api/webhooks/whatsapp
                                 ├─ match phone → customer
                                 ├─ RESPOND → suggestion (read · reply lines · why · hook)
                                 ├─ persist + move Deal Score / Cadence
                                 └─ push over SSE  ──▶ rep UI (CopilotPanel, live)
Rep taps "Send" ──▶ POST /api/whatsapp/send ──▶ Twilio ──▶ customer
```

It runs in **mock mode** by default (no Twilio needed) — the webhook + SSE +
suggestion all work; sends are mocked. Flip on Twilio for real delivery.

## Endpoints
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/webhooks/whatsapp` | Twilio inbound (form: `From`, `Body`) → suggestion + SSE |
| GET | `/api/copilot/stream/{customer_id}` | SSE stream of live suggestions |
| GET | `/api/copilot/suggestions/{customer_id}` | recent suggestions (history) |
| POST | `/api/whatsapp/send` | `{customer_id, body, suggestion_id?}` → send a reply |

## Quick test (no Twilio, mock send)
```bash
cd backend && python -m app.seed && python test_whatsapp.py
```

## Going live with the Twilio WhatsApp Sandbox
1. **Twilio account** → Console → *Messaging → Try it out → Send a WhatsApp message*.
2. **Join the sandbox**: from your phone, send the given `join <word>` to the
   sandbox number (e.g. `+1 415 523 8886`). You can now exchange messages for 24h.
3. **Env** (`backend/.env`):
   ```
   TWILIO_ACCOUNT_SID=ACxxxx
   TWILIO_AUTH_TOKEN=xxxx
   TWILIO_WHATSAPP_FROM=whatsapp:+14155238886   # the sandbox number
   REAL_SEND=true                                # actually deliver (else mock)
   ```
4. **Expose the webhook** (Twilio must reach your machine):
   ```bash
   ngrok http 8000
   ```
   Copy the `https://…ngrok…` URL.
5. **Point Twilio at it**: Sandbox settings → *When a message comes in* →
   `https://<your-ngrok>/api/webhooks/whatsapp` (POST).
6. **Match a customer**: set a seeded customer's `phone` to the number you'll text
   from (the webhook matches by phone). Then text the sandbox from that phone and
   watch the suggestion appear live in the customer's detail page.

> ⚠️ **24-hour window:** WhatsApp only allows freeform replies within 24h of the
> customer's last message. Outside it you must use a pre-approved **template**
> (`TWILIO_TEMPLATE_SID`) — the send endpoint returns `409` if you try to send
> freeform outside the window. Since CloseLoop re-engages *quiet* customers, the
> first outreach is usually a template; replies during a live chat are freeform.

## Notes
- The SSE broadcaster is in-process (single backend instance — fine for the demo).
  For multi-instance, swap `services/realtime.py` for Redis pub/sub or Supabase
  Realtime behind the same `publish()/subscribe()` interface.
- Send is provider-agnostic via the channel adapter (`adapters/channels.py`);
  `MockAdapter` for the demo, `TwilioWhatsAppAdapter` when `REAL_SEND` + Twilio.
