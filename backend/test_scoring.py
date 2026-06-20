"""Unit tests for the event-sourced Deal Score (deal-score.md). Pure logic — no
DB or LLM. Run: python test_scoring.py"""

from __future__ import annotations

import sys

from app import models
from app.services import scoring as s


def _itx(**kw) -> models.Interaction:
    base = dict(channel="phone", direction="outbound", content=None,
                outcome=None, rep_gut_feel=None, transcript_md=None)
    base.update(kw)
    return models.Interaction(**base)


def main() -> int:
    # bands (Part 1)
    assert s.band(85) == "hot" and s.band(60) == "warm"
    assert s.band(40) == "cool" and s.band(39) == "cold"
    assert s.clamp(120) == 100 and s.clamp(-5) == 0

    # ghost radar = low/falling end of the score
    assert s.ghost_risk(30, "flat") == "high"
    assert s.ghost_risk(50, "down") == "high" and s.ghost_risk(50, "up") == "medium"
    assert s.ghost_risk(75, "flat") == "low"

    # micro-commitment: agreeing to a home visit
    e = s.detect_events(_itx(content="They agreed to a home visit on Friday"))
    keys = {k for k, _, _ in e}
    assert "agree_home_visit" in keys, keys
    assert dict((k, d) for k, _, d in e)["agree_home_visit"] == 18

    # buying signal + decision maker from a positive visit
    e = s.detect_events(_itx(channel="visit", content="Wife now on board, ready to move",
                             outcome="positive visit"))
    keys = {k for k, _, _ in e}
    assert "showed_up" in keys and "bring_decision_maker" in keys, keys

    # hard stop → delta 0 (score will be set to 0 by the engine)
    e = s.detect_events(_itx(content="We went with a competitor, sorry"))
    assert any(k == "went_competitor" for k, _, _ in e)
    assert s.DELTAS["no_show"] == -20 and s.START_SCORE == 45

    # inbound = initiates contact
    e = s.detect_events(_itx(direction="inbound", content="Quick question about timing"))
    assert any(k == "initiates_contact" for k, _, _ in e)

    # debounce: each event type fires at most once
    e = s.detect_events(_itx(content="home visit home visit hausbesuch"))
    assert sum(1 for k, _, _ in e if k == "agree_home_visit") == 1

    print("✅ scoring unit tests OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
