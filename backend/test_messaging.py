"""Integration test for the real-time SMS + WhatsApp round-trip (mock send).

Run against a seeded DB (sends are mocked unless REAL_SEND + Twilio are set):
    python -m app.seed
    python test_messaging.py

For each channel: simulate Twilio's inbound webhook, check the suggestion is
persisted with the right channel, send a reply (mock), confirm it's marked sent.
"""

from __future__ import annotations

import sys

from fastapi.testclient import TestClient

from app.main import app


def _check_channel(c: TestClient, cid: str, phone: str, channel: str) -> None:
    frm = f"whatsapp:{phone}" if channel == "whatsapp" else phone
    r = c.post(f"/api/webhooks/{channel}", data={"From": frm, "Body": "honestly it's a lot of money"})
    assert r.status_code == 200 and "Response" in r.text, r.text
    print(f"  [{channel}] inbound webhook → 200")

    sugg = c.get(f"/api/copilot/suggestions/{cid}").json()
    s = next((x for x in sugg if x["channel"] == channel), None)
    assert s and s["exact_lines"], f"no {channel} suggestion persisted"
    print(f"  [{channel}] suggestion: category={s['category']} lines={len(s['exact_lines'])}")

    r = c.post("/api/messaging/send", json={
        "customer_id": cid, "body": s["exact_lines"][0], "channel": channel, "suggestion_id": s["id"],
    })
    r.raise_for_status()
    out = r.json()
    print(f"  [{channel}] send → ok={out['ok']} within_window={out['within_window']} "
          f"provider={out['provider'].get('provider_id')}")

    again = c.get(f"/api/copilot/suggestions/{cid}").json()
    sent = next((x for x in again if x["id"] == s["id"]), None)
    assert sent and sent["status"] == "sent", f"{channel} suggestion not marked sent"


def main() -> int:
    with TestClient(app) as c:
        rows = c.get("/api/customers").json()
        assert rows, "no customers — run `python -m app.seed`"
        cust = next((x for x in rows if "ller" in x["name"]), rows[0])
        cid = cust["id"]
        phone = c.get(f"/api/customers/{cid}").json()["customer"]["phone"]
        print(f"[setup] {cust['name']} ({phone})")
        for channel in ("whatsapp", "sms"):
            _check_channel(c, cid, phone, channel)

    print("\n✅ SMS + WhatsApp round-trip OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
