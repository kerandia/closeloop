"""End-to-end smoke test of the golden path (DEMO mode, no OpenAI needed).

Run against a live DB that has been seeded:
    python -m app.seed
    python smoke_test.py

Uses FastAPI's in-process TestClient — no running server required.
"""

from __future__ import annotations

import sys

from fastapi.testclient import TestClient

from app.main import app


def main() -> int:
    with TestClient(app) as client:
        # 1. dashboard list, ranked
        r = client.get("/api/customers", params={"sort": "sign_likelihood", "order": "desc"})
        r.raise_for_status()
        rows = r.json()
        assert rows, "dashboard is empty — did you run `python -m app.seed`?"
        print(f"[1] dashboard: {len(rows)} customers, top = "
              f"{rows[0]['name']} ({rows[0]['sign_likelihood']})")

        muller = next((c for c in rows if "Müller" in c["name"]), rows[0])

        # 2. detail view
        r = client.get(f"/api/customers/{muller['id']}")
        r.raise_for_status()
        detail = r.json()
        rec = detail["recommendation"]
        assert rec, "no recommendation on the golden customer"
        print(f"[2] detail: buyer_type={detail['profile']['buyer_type']!r} "
              f"signals={len(detail['signals'])} actions={len(detail['extracted_actions'])}")
        print(f"    recommendation: {rec['channel']} · {rec['timing_label']} · "
              f"play={rec['play_key']}")

        # 3. approve → compose
        r = client.post(f"/api/recommendations/{rec['id']}/approve")
        r.raise_for_status()
        msg = r.json()
        print(f"[3] composed {msg['channel']} draft ({len(msg['body'])} chars), "
              f"status={msg['status']}")

        # 4. edit the draft
        r = client.patch(f"/api/messages/{msg['id']}", json={"body": msg["body"] + "\n\nP.S. demo edit"})
        r.raise_for_status()
        print(f"[4] edited draft, status={r.json()['status']}")

        # 5. send (mock adapter)
        r = client.post(f"/api/messages/{msg['id']}/send")
        r.raise_for_status()
        print(f"[5] sent ✓ provider={r.json()['provider']['provider_id']}")

        # 6. co-pilot respond
        r = client.post("/api/copilot/respond", json={
            "customer_id": muller["id"],
            "utterance": "it's a lot of money and we want to check other companies",
        })
        r.raise_for_status()
        resp = r.json()
        print(f"[6] copilot read: {resp['read']!r} ({len(resp['exact_lines'])} lines)")

        # 7. log a human interaction → score updates
        before = muller["sign_likelihood"]
        r = client.post(f"/api/customers/{muller['id']}/interactions", json={
            "channel": "visit", "direction": "outbound",
            "content": "Visited. Wife now on board, ready to move.",
            "rep_gut_feel": "very warm, close to signing",
            "outcome": "positive visit",
        })
        r.raise_for_status()
        after = r.json()["score"]["sign_likelihood"]
        print(f"[7] logged visit → score {before} → {after}, "
              f"new rec: {r.json()['recommendation']['channel']}")

    print("\n✅ golden path OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
