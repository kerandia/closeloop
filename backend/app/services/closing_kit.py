"""Closing Kit agent — generates a buyer-tailored VISUAL (chart/infographic) for a
customer. Visual-first: numbers + short labels only, no prose.

Primary: OpenAI **Code Interpreter** (Assistants API) renders a PNG in OpenAI's
sandbox. Fallback: a deterministic, dependency-free **SVG** so it never fails on
stage (same DEMO-fallback philosophy as the rest of the system).
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
PAPER = "#F4F6F8"

HEADLINE = {
    "investor": "Ihre Rendite",
    "family": "Ihre Ersparnis",
    "environmentalist": "Ihr CO₂-Beitrag",
    "skeptic": "Die Zahlen im Überblick",
}
ACCENT = {"investor": SOLAR, "family": FLUX, "environmentalist": "#4caf7d", "skeptic": SOLAR}


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
    product_summary: str | None


async def build_context(db: AsyncSession, customer: models.Customer) -> KitContext:
    quote = await loaders.latest_quote(db, customer.id)
    profile = await loaders.current_profile(db, customer.id)

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
        product_summary=quote.product_summary if quote else None,
    )


def _metrics_for(ctx: KitContext) -> list[tuple[str, str]]:
    """Return (value, label) tiles, ordered by what persuades this buyer type."""
    m: dict[str, tuple[str, str] | None] = {
        "monthly": (f"{int(ctx.monthly_saving)} €", "pro Monat") if ctx.monthly_saving else None,
        "return": (f"{ctx.annual_return_pct:.0f} %", "Rendite p.a.") if ctx.annual_return_pct else None,
        "payback": (f"{ctx.payback_years:.0f} J", "Amortisation") if ctx.payback_years else None,
        "co2": (f"{int(ctx.co2_tons_25y)} t", "CO₂ / 25 J") if ctx.co2_tons_25y else None,
    }
    order = {
        "investor": ["return", "payback", "monthly", "co2"],
        "environmentalist": ["co2", "monthly", "payback", "return"],
        "family": ["monthly", "payback", "co2", "return"],
        "skeptic": ["payback", "monthly", "return", "co2"],
    }.get(ctx.buyer_type, ["monthly", "payback", "return", "co2"])
    return [m[k] for k in order if m.get(k)]


# --------------------------------------------------------------------------- #
# Deterministic SVG fallback (no dependencies) — guaranteed visual
# --------------------------------------------------------------------------- #


def _fallback_svg(ctx: KitContext) -> tuple[str, bytes, str]:
    metrics = _metrics_for(ctx)[:4]
    if not metrics:
        metrics = [("☀", "Solar")]
    accent = ACCENT.get(ctx.buyer_type, SOLAR)
    headline = HEADLINE.get(ctx.buyer_type, "Die Zahlen")
    hero_val, hero_lab = metrics[0]
    tiles = metrics[1:4]
    W, H = 760, 440

    tile_svg = ""
    tw = 210
    gap = 24
    start_x = 56
    for i, (val, lab) in enumerate(tiles):
        x = start_x + i * (tw + gap)
        tile_svg += f"""
    <g transform="translate({x},300)">
      <rect width="{tw}" height="96" rx="12" fill="{INK2}" stroke="#22323d"/>
      <text x="20" y="44" fill="{PAPER}" font-family="Space Grotesk, sans-serif" font-size="30" font-weight="700">{escape(val)}</text>
      <text x="20" y="72" fill="rgba(244,246,248,0.55)" font-family="IBM Plex Mono, monospace" font-size="13">{escape(lab)}</text>
    </g>"""

    sub = escape(ctx.product_summary or "Solar-Angebot")
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
  <rect width="{W}" height="{H}" rx="20" fill="{INK}"/>
  <text x="56" y="64" fill="{accent}" font-family="IBM Plex Mono, monospace" font-size="14" letter-spacing="2">{escape(headline.upper())}</text>
  <text x="56" y="92" fill="rgba(244,246,248,0.55)" font-family="IBM Plex Sans, sans-serif" font-size="15">{escape(ctx.name)} · {sub}</text>
  <text x="56" y="210" fill="{PAPER}" font-family="Space Grotesk, sans-serif" font-size="104" font-weight="700">{escape(hero_val)}</text>
  <text x="60" y="248" fill="{accent}" font-family="IBM Plex Mono, monospace" font-size="16">{escape(hero_lab)}</text>
  <rect x="56" y="120" width="64" height="6" rx="3" fill="{accent}"/>
  {tile_svg}
  <text x="56" y="416" fill="rgba(244,246,248,0.35)" font-family="IBM Plex Mono, monospace" font-size="12">CloseLoop · {escape(ctx.buyer_type)}</text>
</svg>"""
    title = f"{ctx.name} — {headline}"
    return "image/svg+xml", svg.encode("utf-8"), title


# --------------------------------------------------------------------------- #
# Code Interpreter (OpenAI sandbox) — the agent path
# --------------------------------------------------------------------------- #


def _code_interpreter_png(ctx: KitContext) -> tuple[str, bytes, str]:
    """Blocking — run via asyncio.to_thread. Asks Code Interpreter to render ONE
    persuasive matplotlib chart tailored to the buyer type and return the PNG."""
    from openai import OpenAI

    client = OpenAI(api_key=settings.openai_api_key)
    nums = (
        f"monthly_saving_eur={ctx.monthly_saving}, payback_years={ctx.payback_years}, "
        f"annual_return_pct={ctx.annual_return_pct}, co2_tons_25y={ctx.co2_tons_25y}, "
        f"price_eur={ctx.price_eur}"
    )
    prompt = (
        f"Create ONE clean, persuasive chart as a PNG for a German residential solar "
        f"customer named {ctx.name} (buyer type: {ctx.buyer_type}). Use matplotlib, ~1200x700, "
        f"dark background {INK}, accent {ACCENT.get(ctx.buyer_type, SOLAR)}. Use ONLY these "
        f"numbers: {nums}. Big bold numbers, German labels, MINIMAL text — no paragraphs, no legend "
        f"prose. Emphasis by buyer type: investor → annual return % and payback; family → €/month "
        f"saving; environmentalist → CO₂ tons over 25y; skeptic → side-by-side of all. Save the "
        f"figure as PNG and return the image file."
    )
    assistant = client.beta.assistants.create(
        model="gpt-4o",
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
        title = f"{ctx.name} — {HEADLINE.get(ctx.buyer_type, 'Visual')}"
        for m in msgs.data:
            for part in m.content:
                ptype = getattr(part, "type", None)
                # (a) inline image output
                if ptype == "image_file":
                    fid = getattr(part.image_file, "file_id", "") or ""
                    if fid:
                        return "image/png", client.files.content(fid).read(), title
                # (b) the model saved a file and linked it in a text annotation
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


async def generate(db: AsyncSession, customer: models.Customer) -> dict:
    """Returns {mime, content(bytes), title, buyer_type, source}. Tries the agent
    (Code Interpreter); falls back to the deterministic SVG on any failure."""
    ctx = await build_context(db, customer)
    if settings.closing_kit_enabled and settings.openai_api_key:
        try:
            mime, content, title = await asyncio.to_thread(_code_interpreter_png, ctx)
            return {"mime": mime, "content": content, "title": title,
                    "buyer_type": ctx.buyer_type, "source": "agent"}
        except Exception as err:  # noqa: BLE001
            logger.warning("Closing Kit agent failed (%s); using SVG fallback", err)
    mime, content, title = _fallback_svg(ctx)
    return {"mime": mime, "content": content, "title": title,
            "buyer_type": ctx.buyer_type, "source": "fallback"}
