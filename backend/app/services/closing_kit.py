"""Closing Kit agent — generates a buyer/objection-tailored VISUAL asset for a
customer (sales collateral, generated from the conversation). Visual-first:
numbers + short labels only, no prose.

`kind` picks the asset:
  auto        — a buyer-type summary card (default)
  spouse      — the "show your partner" / missing-stakeholder card
  comparison  — apples-to-apples vs a cheaper quote (grounded by kb_installer)
  winter      — winter-output reassurance
  etf         — ROI vs a savings plan

Primary: OpenAI **Code Interpreter** (Assistants API) renders a PNG in OpenAI's
sandbox. Fallback: a deterministic, dependency-free **SVG** so it never fails.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from html import escape

from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.config import settings
from app.services import loaders

logger = logging.getLogger("closeloop.closing_kit")

# brand palette
INK = "#0D1B27"
INK2 = "#13242f"
SOLAR = "#F5A623"
FLUX = "#14B5A6"
GREEN = "#4caf7d"
PAPER = "#F4F6F8"

# auto (buyer-type) cards
BT_HEADLINE = {"investor": "Ihre Rendite", "family": "Ihre Ersparnis",
               "environmentalist": "Ihr CO₂-Beitrag", "skeptic": "Die Zahlen im Überblick"}
BT_ACCENT = {"investor": SOLAR, "family": FLUX, "environmentalist": GREEN, "skeptic": SOLAR}
BT_ORDER = {
    "investor": ["return", "payback", "monthly", "co2"],
    "environmentalist": ["co2", "monthly", "payback", "return"],
    "family": ["monthly", "payback", "co2", "return"],
    "skeptic": ["payback", "monthly", "return", "co2"],
}

# objection/stakeholder cards
KIND_CONFIG: dict[str, dict] = {
    "spouse": {
        "headline": "Gemeinsam entscheiden", "accent": FLUX,
        "order": ["monthly", "payback", "warranty", "co2"],
        "hint": "A one-page card the buyer can SHOW THEIR PARTNER to win the decision at "
        "home: monthly savings (peace of mind), payback, the long warranty (risk down), CO₂. "
        "Warm, reassuring, family-friendly.",
    },
    "comparison": {
        "headline": "Angebote vergleichen", "accent": SOLAR,
        "order": ["warranty", "response", "battery", "monthly"],
        "hint": "Apples-to-apples comparison vs a cheaper quote: lead with WARRANTY length, "
        "service response time, battery size, monthly net. Frame as 'lowest price vs lowest risk'.",
    },
    "winter": {
        "headline": "Auch im Winter", "accent": FLUX,
        "order": ["monthly", "payback", "warranty"],
        "hint": "Reassure about winter output: the system is sized for the whole year and the "
        "grid covers gaps. Show monthly savings + payback so winter doubt isn't a blocker.",
    },
    "etf": {
        "headline": "Rendite vs. Sparplan", "accent": SOLAR,
        "order": ["return", "payback", "monthly"],
        "hint": "ROI framing for an investor: annual return %, payback years, monthly — compare "
        "favourably to an ETF/savings plan.",
    },
}


@dataclass
class KitContext:
    name: str
    buyer_type: str
    language: str
    monthly_saving: float | None
    payback_years: float | None
    annual_return_pct: float | None
    co2_tons_25y: float | None
    price_eur: float | None
    battery_kwh: float | None
    product_summary: str | None
    # installer facts (kb_installer)
    warranty_years: int | None
    response_time: str | None
    panel_brand: str | None
    inverter_brand: str | None
    references_count: int | None
    local_installs: int | None


async def build_context(db: AsyncSession, customer: models.Customer) -> KitContext:
    quote = await loaders.latest_quote(db, customer.id)
    profile = await loaders.current_profile(db, customer.id)
    inst = await loaders.load_installer(db)

    def f(v):
        return float(v) if v is not None else None

    return KitContext(
        name=customer.name,
        buyer_type=(profile.buyer_type if profile else None) or "family",
        language=customer.language or "de",
        monthly_saving=f(quote.monthly_saving_eur) if quote else None,
        payback_years=f(quote.payback_years) if quote else None,
        annual_return_pct=f(quote.annual_return_pct) if quote else None,
        co2_tons_25y=f(quote.co2_tons_25y) if quote else None,
        price_eur=f(quote.price_eur) if quote else None,
        battery_kwh=f(quote.battery_kwh) if quote else None,
        product_summary=quote.product_summary if quote else None,
        warranty_years=inst.warranty_years if inst else None,
        response_time=inst.response_time if inst else None,
        panel_brand=inst.panel_brand if inst else None,
        inverter_brand=inst.inverter_brand if inst else None,
        references_count=inst.references_count if inst else None,
        local_installs=inst.local_installs if inst else None,
    )


def _all_metrics(ctx: KitContext) -> dict:
    return {
        "monthly": (f"{int(ctx.monthly_saving)} €", "pro Monat") if ctx.monthly_saving else None,
        "return": (f"{ctx.annual_return_pct:.0f} %", "Rendite p.a.") if ctx.annual_return_pct else None,
        "payback": (f"{ctx.payback_years:.0f} J", "Amortisation") if ctx.payback_years else None,
        "co2": (f"{int(ctx.co2_tons_25y)} t", "CO₂ / 25 J") if ctx.co2_tons_25y else None,
        "warranty": (f"{ctx.warranty_years} J", "Garantie") if ctx.warranty_years else None,
        "response": (ctx.response_time, "Service") if ctx.response_time else None,
        "battery": (f"{int(ctx.battery_kwh)} kWh", "Speicher") if ctx.battery_kwh else None,
    }


def _resolve(ctx: KitContext, kind: str) -> tuple[str, str, list[tuple[str, str]], str]:
    """Return (headline, accent, ordered metric tiles, llm_hint) for a kind."""
    m = _all_metrics(ctx)
    if kind in KIND_CONFIG:
        cfg = KIND_CONFIG[kind]
        headline, accent, order, hint = cfg["headline"], cfg["accent"], cfg["order"], cfg["hint"]
    else:  # auto → buyer type
        headline = BT_HEADLINE.get(ctx.buyer_type, "Die Zahlen")
        accent = BT_ACCENT.get(ctx.buyer_type, SOLAR)
        order = BT_ORDER.get(ctx.buyer_type, ["monthly", "payback", "return", "co2"])
        hint = f"Summary card tailored to a {ctx.buyer_type} buyer."
    metrics = [m[k] for k in order if m.get(k)]
    return headline, accent, metrics, hint


# --------------------------------------------------------------------------- #
# Deterministic SVG fallback (no dependencies) — guaranteed visual
# --------------------------------------------------------------------------- #


def _fallback_svg(ctx: KitContext, headline: str, accent: str,
                  metrics: list[tuple[str, str]]) -> tuple[str, bytes, str]:
    metrics = metrics[:4] or [("☀", "Solar")]
    hero_val, hero_lab = metrics[0]
    tiles = metrics[1:4]
    W, H = 760, 440
    tile_svg = ""
    tw, gap, start_x = 210, 24, 56
    for i, (val, lab) in enumerate(tiles):
        x = start_x + i * (tw + gap)
        tile_svg += f"""
    <g transform="translate({x},300)">
      <rect width="{tw}" height="96" rx="12" fill="{INK2}" stroke="#22323d"/>
      <text x="20" y="44" fill="{PAPER}" font-family="Space Grotesk, sans-serif" font-size="28" font-weight="700">{escape(str(val))}</text>
      <text x="20" y="72" fill="rgba(244,246,248,0.55)" font-family="IBM Plex Mono, monospace" font-size="13">{escape(str(lab))}</text>
    </g>"""
    sub = escape(ctx.product_summary or "Solar-Angebot")
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
  <rect width="{W}" height="{H}" rx="20" fill="{INK}"/>
  <text x="56" y="64" fill="{accent}" font-family="IBM Plex Mono, monospace" font-size="14" letter-spacing="2">{escape(headline.upper())}</text>
  <text x="56" y="92" fill="rgba(244,246,248,0.55)" font-family="IBM Plex Sans, sans-serif" font-size="15">{escape(ctx.name)} · {sub}</text>
  <rect x="56" y="120" width="64" height="6" rx="3" fill="{accent}"/>
  <text x="56" y="210" fill="{PAPER}" font-family="Space Grotesk, sans-serif" font-size="104" font-weight="700">{escape(str(hero_val))}</text>
  <text x="60" y="248" fill="{accent}" font-family="IBM Plex Mono, monospace" font-size="16">{escape(str(hero_lab))}</text>
  {tile_svg}
  <text x="56" y="416" fill="rgba(244,246,248,0.35)" font-family="IBM Plex Mono, monospace" font-size="12">CloseLoop · {escape(ctx.name)}</text>
</svg>"""
    return "image/svg+xml", svg.encode("utf-8"), f"{ctx.name} — {headline}"


# --------------------------------------------------------------------------- #
# Code Interpreter (OpenAI sandbox) — the agent path
# --------------------------------------------------------------------------- #


def _code_interpreter_png(ctx: KitContext, kind: str, headline: str,
                          accent: str, hint: str) -> tuple[str, bytes, str]:
    from openai import OpenAI

    client = OpenAI(api_key=settings.openai_api_key)
    nums = (
        f"monthly_saving_eur={ctx.monthly_saving}, payback_years={ctx.payback_years}, "
        f"annual_return_pct={ctx.annual_return_pct}, co2_tons_25y={ctx.co2_tons_25y}, "
        f"battery_kwh={ctx.battery_kwh}, price_eur={ctx.price_eur}"
    )
    installer = (
        f"installer: {ctx.warranty_years}-year warranty, service {ctx.response_time}, "
        f"panels {ctx.panel_brand}, inverter {ctx.inverter_brand}, "
        f"{ctx.references_count} local references, {ctx.local_installs} local installs"
    )
    prompt = (
        f"Create ONE clean, persuasive sales card as a PNG (~1200x700, dark background {INK}, "
        f"accent {accent}) titled '{headline}' for a German residential solar customer "
        f"({ctx.name}, buyer type {ctx.buyer_type}). {hint} "
        f"Use ONLY these numbers: {nums}. Ground any warranty/service claims with: {installer}. "
        f"Big bold numbers, German labels, MINIMAL text — no paragraphs, no legend prose. "
        f"Save the figure as PNG and return the image file."
    )
    assistant = client.beta.assistants.create(
        model=settings.closing_kit_model,
        tools=[{"type": "code_interpreter"}],
        instructions="You are a sales data-viz designer. Output exactly one matplotlib PNG. "
        "Minimal text — numbers + short labels only.",
    )
    try:
        thread = client.beta.threads.create(messages=[{"role": "user", "content": prompt}])
        run = client.beta.threads.runs.create_and_poll(
            thread_id=thread.id, assistant_id=assistant.id, poll_interval_ms=2000
        )
        if run.status != "completed":
            raise RuntimeError(f"run status={run.status}")
        msgs = client.beta.threads.messages.list(thread_id=thread.id)
        title = f"{ctx.name} — {headline}"
        for m in msgs.data:
            for part in m.content:
                ptype = getattr(part, "type", None)
                if ptype == "image_file":
                    fid = getattr(part.image_file, "file_id", "") or ""
                    if fid:
                        return "image/png", client.files.content(fid).read(), title
                if ptype == "text":
                    for ann in getattr(part.text, "annotations", []) or []:
                        fp = getattr(ann, "file_path", None)
                        fid = getattr(fp, "file_id", "") if fp else ""
                        if fid:
                            return "image/png", client.files.content(fid).read(), title
        raise RuntimeError("no image file in response")
    finally:
        try:
            client.beta.assistants.delete(assistant.id)
        except Exception:  # noqa: BLE001
            pass


async def generate(db: AsyncSession, customer: models.Customer, kind: str = "auto") -> dict:
    """Returns {mime, content(bytes), title, buyer_type, kind, source}. Tries the
    agent (Code Interpreter); falls back to the deterministic SVG on any failure."""
    ctx = await build_context(db, customer)
    headline, accent, metrics, hint = _resolve(ctx, kind)
    if settings.closing_kit_enabled and settings.openai_api_key:
        try:
            mime, content, title = await asyncio.to_thread(
                _code_interpreter_png, ctx, kind, headline, accent, hint
            )
            return {"mime": mime, "content": content, "title": title,
                    "buyer_type": ctx.buyer_type, "kind": kind, "source": "agent"}
        except Exception as err:  # noqa: BLE001
            logger.warning("Closing Kit agent failed (%s); using SVG fallback", err)
    mime, content, title = _fallback_svg(ctx, headline, accent, metrics)
    return {"mime": mime, "content": content, "title": title,
            "buyer_type": ctx.buyer_type, "kind": kind, "source": "fallback"}
