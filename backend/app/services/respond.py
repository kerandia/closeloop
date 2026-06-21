"""RESPOND — live co-pilot during a human call/visit (02 §4.3, objection-playbook.md).

Two layers + a stateful loop (Level 2):
  - LAYER 1/2: classify the utterance into a playbook category, apply that
    category's principle → exact lines + a fixed-template why-line.
  - PART 3 LOOP: every turn also produces an *advance hook* that becomes a
    Cadence to-do. Against the currently-open hook the model decides whether to
    advance, handle a new concern (drop & re-offer), or downgrade to a light
    to-do. State lives in the DB (interactions + extracted_actions) — no agent
    runtime; this is a stateful service across calls.

Keep latency low: pre-match the utterance to KB objection rows and pass only
those (plus the open hook) into the prompt, not the whole KB.
"""

from __future__ import annotations

import datetime as dt
import json
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models, schemas
from app.services import loaders, prompts
from app.services.llm import DEMO_MODE, structured

logger = logging.getLogger("closeloop.respond")


def _utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


# channel → extracted_actions.type (so the to-do reads correctly in the UI)
_CHANNEL_TO_TYPE = {
    "visit": "schedule_visit",
    "phone": "callback",
    "email": "send_info",
    "sms": "send_info",
    "whatsapp": "send_info",
}

# the model sometimes returns a localized/display channel ("E-Mail", "Anruf").
# Normalise to the canonical token set so the to-do maps cleanly.
_CHANNEL_ALIASES = {
    "e-mail": "email", "mail": "email", "email": "email",
    "whatsapp": "whatsapp", "whats app": "whatsapp",
    "sms": "sms", "text": "sms",
    "phone": "phone", "call": "phone", "anruf": "phone", "telefon": "phone",
    "visit": "visit", "besuch": "visit", "hausbesuch": "visit", "home visit": "visit",
}


def _normalize_channel(ch: str | None) -> str:
    if not ch:
        return "whatsapp"
    return _CHANNEL_ALIASES.get(ch.strip().lower(), ch.strip().lower())


def _compute_loop_action(
    out: schemas.RespondOutput,
    open_hook: models.ExtractedAction | None,
    matched: list[dict],
) -> str:
    """Authoritative state transition (Part 3) — the service decides, not the LLM.

    A concern present + a hook already open ⇒ they're not ready to move: drop &
    re-offer. A concern + no open hook ⇒ first hook. No concern ⇒ soften. Concern
    is read from any of: the keyword pre-match, the model's category, or a
    non-"other" type — so a single weak signal can't collapse the loop.
    """
    concern = bool(matched) or (out.category is not None) or (
        out.type and out.type != "other"
    )
    if not concern:
        return "downgrade"
    return "advance" if open_hook is None else "handle_new_concern"


async def run_respond(
    db: AsyncSession,
    customer: models.Customer,
    utterance: str,
    recent_context: str | None = None,
    channel: str = "phone",
) -> schemas.RespondOutput:
    profile = await loaders.current_profile(db, customer.id)
    matched = await _match_objections(db, utterance)
    open_hook = await _open_copilot_hook(db, customer.id)

    if DEMO_MODE:
        out = _demo_respond(matched, utterance, open_hook)
    else:
        # Send the playbook PRINCIPLE for guidance, but withhold the KB's ready-made
        # `exact_lines` — a small model just parrots them verbatim (wrong language,
        # leaked {saving}/{payback} placeholders). Forcing generation makes it write
        # fresh lines in the customer's actual language. (_demo_respond still gets the
        # full rows below.)
        matched_for_llm = [
            {k: v for k, v in m.items() if k != "exact_lines"} for m in matched
        ]
        default_lang = "English" if (customer.language or "de") == "en" else "German"
        reply_lang = loaders.detect_language(utterance) or default_lang
        payload = {
            "profile": loaders.profile_dict(profile),
            "utterance": utterance,
            "recent_context": recent_context,
            "matched_objections": matched_for_llm,
            "open_hook": _hook_brief(open_hook),
            "reply_in_language": reply_lang,
        }
        try:
            out = await structured(
                system=prompts.RESPOND_SYSTEM,
                user=json.dumps(payload, ensure_ascii=False, default=str),
                schema=schemas.RespondOutput,
                temperature=0.4,
            )
        except Exception as err:  # noqa: BLE001 — live co-pilot must never break on stage
            logger.warning("RESPOND LLM failed (%s); using DEMO fallback", err)
            out = _demo_respond(matched, utterance, open_hook)

    # The service owns the state transition (deterministic), the LLM owns the
    # language. Reconcile the loop decision + normalise the hook's channel.
    out.loop_action = _compute_loop_action(out, open_hook, matched)
    if out.todo is not None:
        out.todo.channel = _normalize_channel(out.todo.channel)

    await _apply_loop_and_persist(db, customer, out, utterance, channel, open_hook)
    return out


# --------------------------------------------------------------------------- #
# State: the currently-open advance hook (the live cadence step on the table)
# --------------------------------------------------------------------------- #


async def _open_copilot_hook(
    db: AsyncSession, customer_id
) -> models.ExtractedAction | None:
    res = await db.execute(
        select(models.ExtractedAction)
        .where(
            models.ExtractedAction.customer_id == customer_id,
            models.ExtractedAction.source == "copilot",
            models.ExtractedAction.status == "open",
        )
        .order_by(models.ExtractedAction.created_at.desc())
        .limit(1)
    )
    return res.scalar_one_or_none()


def _hook_brief(hook: models.ExtractedAction | None) -> dict | None:
    if hook is None:
        return None
    return {"detail": hook.detail, "channel": hook.channel, "why": hook.why}


# generic words that shouldn't, on their own, match an objection
_STOPWORDS = {"about", "other", "really", "would", "could", "there", "thing",
              "these", "those", "where", "which", "still", "right", "going"}


def _phrase_hit(utterance: str, phrasings: list[str]) -> bool:
    """Match a full phrasing as a substring OR any salient word (len>=6) from it.

    The substring check alone is brittle ("does it work in winter" misses "does
    it even work in winter"); the word check catches the same intent loosely.
    """
    for p in phrasings:
        pl = p.lower()
        if pl in utterance:
            return True
        for w in pl.split():
            w = w.strip("?.,!")
            if len(w) >= 6 and w not in _STOPWORDS and w in utterance:
                return True
    return False


async def _match_objections(db: AsyncSession, utterance: str) -> list[dict]:
    u = utterance.lower()
    rows = (await db.execute(select(models.KBObjection))).scalars().all()
    matched: list[dict] = []
    for o in rows:
        phrasings = o.customer_phrasings or []
        if _phrase_hit(u, phrasings) or o.key.replace("_", " ") in u:
            matched.append(
                {
                    "key": o.key,
                    "category": o.category,
                    "read": o.read,
                    "root_read": o.root_read,
                    "reframe_strategy": o.reframe_strategy,
                    "do_list": o.do_list,
                    "dont_list": o.dont_list,
                    "red_lines": o.red_lines,
                    "exact_lines": o.exact_lines,
                    "advance_hook": o.advance_hook,
                    "why_line": o.why_line,
                }
            )
    return matched


# --------------------------------------------------------------------------- #
# The loop + Cadence persistence (Part 3)
# --------------------------------------------------------------------------- #


async def _apply_loop_and_persist(
    db: AsyncSession,
    customer: models.Customer,
    out: schemas.RespondOutput,
    utterance: str,
    channel: str,
    open_hook: models.ExtractedAction | None,
) -> None:
    # 1. the customer utterance is a real inbound touch — log it to the timeline
    #    so the next ANALYZE sees it.
    db.add(
        models.Interaction(
            customer_id=customer.id,
            channel=channel,
            direction="inbound",
            content=utterance,
            outcome=f"co-pilot: {out.read}" if out.read else None,
            created_by="customer",
            occurred_at=_utcnow(),
        )
    )

    # 2. reconcile the open hook with the loop decision
    if open_hook is not None:
        if out.loop_action == "handle_new_concern":
            open_hook.status = "dismissed"  # superseded — a new concern jumped the queue
        elif out.loop_action == "advance":
            open_hook.status = "done"  # they took it; move on

    # 3. turn this turn's advance hook into a Cadence to-do.
    #    On downgrade we don't pile up to-dos if one is already open.
    make_todo = out.todo is not None and not (
        out.loop_action == "downgrade" and open_hook is not None
    )
    if make_todo:
        todo = out.todo
        db.add(
            models.ExtractedAction(
                customer_id=customer.id,
                type=_CHANNEL_TO_TYPE.get(todo.channel, "hook"),
                detail=todo.detail,
                due_at=todo.due_at,
                channel=todo.channel,
                why=todo.why,
                source="copilot",
                status="open",
            )
        )

    await db.commit()


# --------------------------------------------------------------------------- #
# DEMO fallback — deterministic, keeps the co-pilot alive without OpenAI
# --------------------------------------------------------------------------- #

# which channel each category's advance hook naturally lands on
_CATEGORY_HOOK_CHANNEL = {
    "spouse": "visit",
    "winter_yield": "visit",
    "install_disruption": "visit",
    "trust_new_company": "email",
    "policy_subsidy": "email",
    "price_too_high": "whatsapp",
    "need_other_quotes": "email",
    "timing_no_rush": "email",
}


def _demo_respond(
    matched: list[dict],
    utterance: str,
    open_hook: models.ExtractedAction | None,
) -> schemas.RespondOutput:
    if matched:
        m = matched[0]
        # a matched concern while a hook was already open = a new concern jumped in
        loop_action = "handle_new_concern" if open_hook is not None else "advance"
        channel = _CATEGORY_HOOK_CHANNEL.get(m["key"], "whatsapp")
        hook_text = m.get("advance_hook") or "Let me line up a clear next step and follow up."
        # Drop any KB lines still carrying unfilled template tokens ({saving}, …) —
        # the offline fallback has no quote to fill them.
        lines = [ln for ln in (m.get("exact_lines") or []) if "{" not in ln][:2] or [
            "I completely understand — let's look at what actually matters here.",
        ]
        return schemas.RespondOutput(
            read=m.get("read") or f"{m['key']} objection",
            type="objection",
            category=m["key"],
            tone="calm, confident, no discounting",
            exact_lines=lines,
            why=m.get("why_line")
            or (m.get("reframe_strategy") or "Reframe rather than discount to protect the deal."),
            advance_hook=hook_text,
            todo=schemas.CopilotTodo(
                detail=hook_text,
                channel=channel,
                why=m.get("reframe_strategy") or "Move the deal one step forward.",
                when_label="within 48h",
                due_at=_utcnow() + dt.timedelta(days=2),
            ),
            loop_action=loop_action,
        )

    # nothing matched → open the door; soften to a light to-do
    return schemas.RespondOutput(
        read="general hesitation, no specific objection matched",
        type="other",
        category=None,
        tone="warm, unhurried",
        exact_lines=[
            "That's a fair point — what's the main thing on your mind about it?",
        ],
        why="Open the door to the real concern before responding so you address the right thing.",
        advance_hook="I'll check in lightly next week — no pressure.",
        todo=schemas.CopilotTodo(
            detail="Light check-in — surface the real concern",
            channel="whatsapp",
            why="Non-committal, no concern surfaced yet; give space, keep the thread warm.",
            when_label="next week",
            due_at=_utcnow() + dt.timedelta(days=7),
        ),
        loop_action="downgrade",
    )
