"""Integration test for the WhatsApp real-time round-trip (mock send).

Run against a seeded DB (the send is mocked unless REAL_SEND + Twilio are set):
    python -m app.seed
    python test_whatsapp.py

Simulates Twilio's inbound webhook form POST, checks the suggestion is persisted
and fetchable, sends a reply (mock), and confirms the suggestion is marked sent.
"""

from __future__ import annotations

import sys

from fastapi.testclient import TestClient

from app.main import app


def main() -> int:
    with TestClient(app) as c:
        rows = c.get("/api/customers").json()
        assert rows, "no customers — run `python -m app.seed`"
        cust = next((x for x in rows if "ller" in x["name"]), rows[0])
        cid = cust["id"]
        phone = c.get(f"/api/customers/{cid}").json()["customer"]["phone"]
        print(f"[setup] {cust['name']} ({phone})")

        # 1. inbound WhatsApp (Twilio posts form-encoded From/Body)
        r = c.post(
            "/api/webhooks/whatsapp",
            data={"From": f"whatsapp:{phone}", "Body": "honestly it's a lot of money"},
        )
        assert r.status_code == 200 and "Response" in r.text, r.text
        print(f"[1] inbound webhook → {r.status_code} (TwiML ack)")

        # 2. suggestion persisted + fetchable
        sugg = c.get(f"/api/copilot/suggestions/{cid}").json()
        assert sugg, "no suggestion persisted"
        s = sugg[0]
        assert s["exact_lines"], "suggestion has no reply lines"
        print(f"[2] suggestion: category={s['category']} lines={len(s['exact_lines'])} "
              f"hook={bool(s['advance_hook'])}")

        # 3. outbound send (mock) — closes the round-trip
        r = c.post("/api/whatsapp/send", json={
            "customer_id": cid, "body": s["exact_lines"][0], "suggestion_id": s["id"],
        })
        r.raise_for_status()
        out = r.json()
        print(f"[3] send → ok={out['ok']} within_window={out['within_window']} "
              f"provider={out['provider'].get('provider_id')}")

        # 4. suggestion marked sent
        again = c.get(f"/api/copilot/suggestions/{cid}").json()
        sent = next((x for x in again if x["id"] == s["id"]), None)
        assert sent and sent["status"] == "sent", "suggestion not marked sent"
        print(f"[4] suggestion status → {sent['status']}")

    print("\n✅ WhatsApp round-trip OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
