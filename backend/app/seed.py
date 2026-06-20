"""Seed the knowledge base, reps, and demo customers (01 §C).

Run:  python -m app.seed          (idempotent-ish: clears + reseeds)

Includes the fully-fleshed Müller golden path with a complete voice transcript
so the L1 demo works even if live voice fails (00 §5, 04 §10).
"""

from __future__ import annotations

import asyncio
import datetime as dt

from sqlalchemy import delete, select

from app import models
from app.db import SessionLocal, init_db
from app.services import analyze as analyze_svc


def _days_ago(n: int) -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=n)


# --------------------------------------------------------------------------- #
# Knowledge base
# --------------------------------------------------------------------------- #

BUYER_TYPES = [
    dict(
        key="family",
        name="The Family",
        description="Household decision, reassurance-driven, risk-averse, decides together.",
        fears=["surprise costs", "making the wrong call", "disruption to the home"],
        motivators=["predictable bills", "peace of mind", "a safe long-term home"],
        default_tone="warm, reassuring, no jargon",
        recommended_channels=["whatsapp", "visit"],
        talking_points=["frame as €/month not total", "emphasise warranty", "no pressure"],
    ),
    dict(
        key="investor",
        name="The Investor",
        description="Numbers-led, wants ROI/payback, fast to decide once the math is clear.",
        fears=["poor return", "hidden fees", "underperformance vs projection"],
        motivators=["annual return %", "short payback", "asset value"],
        default_tone="precise, data-forward, confident",
        recommended_channels=["email", "phone"],
        talking_points=["lead with annual_return_pct", "show payback_years", "cite financing rate"],
    ),
    dict(
        key="environmentalist",
        name="The Environmentalist",
        description="Values-led, motivated by CO2 impact and independence from fossil grid.",
        fears=["greenwashing", "low real impact"],
        motivators=["CO2 avoided", "energy independence", "doing the right thing"],
        default_tone="sincere, mission-aligned, concrete",
        recommended_channels=["email", "whatsapp"],
        talking_points=["lead with co2_tons_25y", "tie to independence", "avoid pure money framing"],
    ),
    dict(
        key="skeptic",
        name="The Skeptic",
        description="Distrustful of sales, comparing vendors, needs proof and no pressure.",
        fears=["being upsold", "new/unknown company", "performance claims"],
        motivators=["proof", "transparency", "control of the decision"],
        default_tone="straight, low-pressure, evidence-first",
        recommended_channels=["email", "visit"],
        talking_points=["arm them to compare quotes", "never discount", "show references/warranty"],
    ),
]

OBJECTIONS = [
    dict(
        key="price_too_high",
        customer_phrasings=["it's a lot of money", "that's expensive", "das ist teuer"],
        read="value gap, not price",
        reframe_strategy="shift total price → monthly saving and payback",
        do_list=["reframe to €/month", "compare to current bill"],
        dont_list=["don't discount — signals padded price"],
        exact_lines=[
            "I understand — most people find it easier as about €{saving} a month, less than the bill it replaces.",
            "The price reflects the equipment and warranty; the payback is around {payback} years, then it's saving you money.",
        ],
        applies_to=["family", "skeptic", "investor"],
    ),
    dict(
        key="winter_yield",
        customer_phrasings=["does it work in winter", "what about cloudy days", "im winter"],
        read="performance doubt, easily addressed with data",
        reframe_strategy="explain annual yield + grid offset, not daily winter output",
        do_list=["talk annual production", "mention the grid covers gaps"],
        dont_list=["don't overpromise winter output"],
        exact_lines=[
            "Great question — panels do produce less in winter, but the system is sized for the whole year, and the grid covers any gap automatically.",
        ],
        applies_to=["skeptic", "family", "environmentalist"],
    ),
    dict(
        key="need_other_quotes",
        customer_phrasings=["we want to check other companies", "comparing options", "andere angebote"],
        read="multi-quote risk — protect the deal, don't pressure",
        reframe_strategy="arm them to compare on equipment + warranty, not headline price",
        do_list=["name the multi-quote risk honestly", "tell them what to compare"],
        dont_list=["don't badmouth competitors", "don't discount to win the race"],
        exact_lines=[
            "Comparing is smart. The things to check across quotes are the panel/inverter brand and the warranty length — not just the headline price.",
        ],
        applies_to=["skeptic", "family", "investor"],
    ),
    dict(
        key="spouse",
        customer_phrasings=["check with my wife", "talk to my husband", "mit meiner frau"],
        read="second decision-maker not yet aligned",
        reframe_strategy="bring the absent partner into the conversation, reduce friction",
        do_list=["offer a joint call/visit", "send a one-pager they can share"],
        dont_list=["don't push for a decision now"],
        exact_lines=[
            "Of course — it's a joint decision. Would it help if I sent a short summary you could go through together, or joined a quick call with you both?",
        ],
        applies_to=["family"],
    ),
    dict(
        key="install_disruption",
        customer_phrasings=["how much mess", "how long does it take", "wie lange dauert"],
        read="fear of disruption, not of the product",
        reframe_strategy="set clear expectations on timeline and cleanup",
        do_list=["give a concrete install duration", "explain the process"],
        dont_list=["don't be vague about timing"],
        exact_lines=[
            "Most installs are done in a day or two, and the team leaves the site clean — I can walk you through exactly what the days look like.",
        ],
        applies_to=["family", "skeptic"],
    ),
    dict(
        key="trust_new_company",
        customer_phrasings=["never heard of you", "are you reputable", "kenne ich nicht"],
        read="trust gap with an unknown vendor",
        reframe_strategy="lead with references, warranty, and local install track record",
        do_list=["offer references", "highlight warranty and local installs"],
        dont_list=["don't get defensive"],
        exact_lines=[
            "Totally fair. We're happy to share local references and the full warranty terms up front — I'd rather you feel sure than rushed.",
        ],
        applies_to=["skeptic"],
    ),
]

PLAYS = [
    dict(
        key="home_visit_trust",
        name="Home visit to build trust",
        description="In-person visit to build rapport and bring all decision-makers in.",
        when_to_use="Family/skeptic with multi-quote risk and an unaligned spouse.",
        channel="visit",
        buyer_types=["family", "skeptic"],
        success_rate=0.62,
    ),
    dict(
        key="fast_lock",
        name="Fast lock before competitors",
        description="Move quickly with a clear, numbers-led nudge while interest is hot.",
        when_to_use="Investor with high engagement and few blockers.",
        channel="phone",
        buyer_types=["investor"],
        success_rate=0.55,
    ),
    dict(
        key="spouse_targeted",
        name="Spouse-targeted summary",
        description="Send a shareable one-pager or offer a joint call to align the partner.",
        when_to_use="Family where the second decision-maker isn't on board yet.",
        channel="whatsapp",
        buyer_types=["family"],
        success_rate=0.48,
    ),
    dict(
        key="impact_reframe",
        name="Impact reframe",
        description="Re-anchor on CO2 avoided and energy independence, not money.",
        when_to_use="Environmentalist who's gone quiet after a money-led quote.",
        channel="email",
        buyer_types=["environmentalist"],
        success_rate=0.5,
    ),
    dict(
        key="comparison_arming",
        name="Arm-the-comparison",
        description="Give the customer a checklist to compare quotes fairly (protects the deal).",
        when_to_use="Skeptic actively gathering other quotes.",
        channel="email",
        buyer_types=["skeptic", "family"],
        success_rate=0.44,
    ),
]

CHANNEL_PRIORS = [
    dict(buyer_type="family", stage="quoted", best_channel="whatsapp", best_timing="within 48h", notes="warm, low pressure"),
    dict(buyer_type="family", stage="contacted", best_channel="visit", best_timing="weekday evening", notes="bring spouse in"),
    dict(buyer_type="investor", stage="quoted", best_channel="email", best_timing="within 24h", notes="lead with ROI"),
    dict(buyer_type="environmentalist", stage="quoted", best_channel="email", best_timing="within 72h", notes="impact framing"),
    dict(buyer_type="skeptic", stage="quoted", best_channel="email", best_timing="within 72h", notes="comparison checklist"),
]

CADENCE_TEMPLATES = [
    dict(
        buyer_type="family",
        name="Family reassurance cadence",
        steps=[
            {"day_offset": 0, "channel": "whatsapp", "goal": "warm check-in", "play_key": None},
            {"day_offset": 2, "channel": "visit", "goal": "build trust, align spouse", "play_key": "home_visit_trust"},
            {"day_offset": 5, "channel": "email", "goal": "send summary to share", "play_key": "spouse_targeted"},
        ],
    ),
    dict(
        buyer_type="investor",
        name="Investor fast-lock cadence",
        steps=[
            {"day_offset": 0, "channel": "email", "goal": "ROI recap", "play_key": None},
            {"day_offset": 1, "channel": "phone", "goal": "close the math, lock", "play_key": "fast_lock"},
        ],
    ),
]

REPS = [
    dict(
        name="Lena Vogt",
        email="lena@solar.example",
        strengths={"buyer_types": ["family", "skeptic"], "note": "calm closer, great on home visits"},
        stats={"close_rate_by_type": {"family": 0.58, "skeptic": 0.41}},
    ),
    dict(
        name="Tom Becker",
        email="tom@solar.example",
        strengths={"buyer_types": ["investor"], "note": "numbers-led, fast"},
        stats={"close_rate_by_type": {"investor": 0.52}},
    ),
    dict(
        name="Sara Klein",
        email="sara@solar.example",
        strengths={"buyer_types": ["environmentalist", "family"], "note": "mission-aligned, warm"},
        stats={"close_rate_by_type": {"environmentalist": 0.49, "family": 0.45}},
    ),
]

MULLER_TRANSCRIPT = """\
**Agent:** Hallo, spreche ich mit Familie Müller? Ich rufe wegen Ihres Solar-Angebots an.
**Customer:** Ja, genau. Ehrlich gesagt vergleichen wir gerade noch ein paar andere Anbieter.
**Agent:** Das ist absolut verständlich — vergleichen ist klug. Darf ich fragen, was Ihnen bei der Entscheidung am wichtigsten ist?
**Customer:** Vor allem wollen wir bei den Stromkosten sparen. Aber meine Frau ist noch nicht ganz überzeugt.
**Agent:** Verstehe, das ist eine gemeinsame Entscheidung. Gibt es etwas Konkretes, das Sie noch unsicher macht?
**Customer:** Naja, funktioniert das im Winter überhaupt? Und der Preis ist schon eine Menge Geld.
**Agent:** Gute Fragen. Beides kann ich Ihnen gern in Ruhe erklären. Soll Sie {rep} dazu persönlich zurückrufen?
**Customer:** Ja, gern. Rufen Sie mich am Dienstag nach 17 Uhr an.
**Agent:** Mache ich. Vielen Dank, einen schönen Tag — wir melden uns!
"""


# --------------------------------------------------------------------------- #
# Demo customers
# --------------------------------------------------------------------------- #

CUSTOMERS = [
    dict(
        ref="muller",
        name="Familie Müller",
        email="mueller@example.de",
        phone="+49 170 1112233",
        address={"street": "Lindenweg 4", "zip": "79100", "city": "Freiburg"},
        consent_voice=True,
        consent_marketing=True,
        last_contact_at=_days_ago(2),
        quote=dict(
            system_size_kwp=12, battery_kwh=10, product_summary="12 kWp roof + 10 kWh battery",
            price_eur=18000, monthly_saving_eur=140, payback_years=9.5,
            annual_return_pct=11, co2_tons_25y=150,
            financing={"type": "kfw", "rate": 3.2, "monthly": 165}, sent_at=_days_ago(12),
        ),
        golden=True,
    ),
    dict(
        ref="schmidt", name="Herr Schmidt", email="schmidt@example.de", phone="+49 170 2223344",
        address={"city": "Stuttgart"}, consent_voice=True, last_contact_at=_days_ago(8),
        quote=dict(system_size_kwp=9, product_summary="9 kWp roof", price_eur=13500,
                   monthly_saving_eur=95, payback_years=8, annual_return_pct=13,
                   co2_tons_25y=110, sent_at=_days_ago(15)),
        seed_interaction="**Rep note:** Asked a lot about annual return and payback. Wants the numbers to add up.",
    ),
    dict(
        ref="weber", name="Frau Weber", email="weber@example.de", phone="+49 170 3334455",
        address={"city": "München"}, consent_voice=True, last_contact_at=_days_ago(11),
        quote=dict(system_size_kwp=8, battery_kwh=8, product_summary="8 kWp + 8 kWh",
                   price_eur=15000, monthly_saving_eur=110, payback_years=10,
                   co2_tons_25y=160, sent_at=_days_ago(20)),
        seed_interaction="**Rep note:** Really cares about the environment and CO2 impact, less about money.",
    ),
    dict(
        ref="fischer", name="Herr Fischer", email="fischer@example.de", phone="+49 170 4445566",
        address={"city": "Köln"}, consent_voice=True, last_contact_at=_days_ago(3),
        quote=dict(system_size_kwp=10, product_summary="10 kWp roof", price_eur=16000,
                   monthly_saving_eur=120, payback_years=9, co2_tons_25y=140, sent_at=_days_ago(6)),
        seed_interaction="**Rep note:** Never heard of us, wants to check other companies first. Quite guarded.",
    ),
    dict(
        ref="hoffmann", name="Familie Hoffmann", email="hoffmann@example.de", phone="+49 170 5556677",
        address={"city": "Hamburg"}, consent_voice=True, last_contact_at=_days_ago(1),
        quote=dict(system_size_kwp=11, battery_kwh=10, product_summary="11 kWp + 10 kWh",
                   price_eur=17500, monthly_saving_eur=135, payback_years=9, co2_tons_25y=150, sent_at=_days_ago(4)),
        seed_interaction="**Rep note:** Keen, asked about install dates. Wife on board. Warm.",
    ),
]


async def _clear(session) -> None:
    for model in (
        models.ScoreHistory, models.Outcome, models.Message, models.Recommendation,
        models.ExtractedAction, models.ProfileSignal, models.Profile,
        models.Interaction, models.Quote, models.Customer, models.Rep,
        models.KBCadenceTemplate, models.KBChannelPrior, models.KBPlay,
        models.KBObjection, models.KBBuyerType,
    ):
        await session.execute(delete(model))
    await session.commit()


async def seed() -> None:
    await init_db()
    async with SessionLocal() as session:
        await _clear(session)

        for bt in BUYER_TYPES:
            session.add(models.KBBuyerType(**bt))
        for o in OBJECTIONS:
            session.add(models.KBObjection(**o))
        for p in PLAYS:
            session.add(models.KBPlay(**p))
        for c in CHANNEL_PRIORS:
            session.add(models.KBChannelPrior(**c))
        for t in CADENCE_TEMPLATES:
            session.add(models.KBCadenceTemplate(**t))

        reps = [models.Rep(**r) for r in REPS]
        session.add_all(reps)
        await session.flush()

        # rep assignment by strength
        family_rep = reps[0]   # Lena — family/skeptic
        investor_rep = reps[1]  # Tom — investor
        env_rep = reps[2]       # Sara — environmentalist/family

        created: list[models.Customer] = []
        for spec in CUSTOMERS:
            rep = (
                investor_rep if spec["ref"] == "schmidt"
                else env_rep if spec["ref"] == "weber"
                else family_rep
            )
            c = models.Customer(
                name=spec["name"], email=spec.get("email"), phone=spec.get("phone"),
                address=spec.get("address", {}), language="de", stage="quoted",
                assigned_rep_id=rep.id,
                assignment_reason=f"{rep.name} — strongest close rate for this buyer type",
                consent_voice=spec.get("consent_voice", False),
                consent_marketing=spec.get("consent_marketing", False),
                last_contact_at=spec.get("last_contact_at"),
                source="seed",
            )
            session.add(c)
            await session.flush()
            created.append(c)

            q = spec["quote"]
            session.add(models.Quote(customer_id=c.id, **q))

            if spec.get("golden"):
                session.add(
                    models.Interaction(
                        customer_id=c.id, channel="voice_ai", direction="outbound",
                        transcript_md=MULLER_TRANSCRIPT.replace("{rep}", rep.name),
                        outcome="sentiment: warm; hesitations: winter_yield, comparing_others, spouse, price; "
                                "callback: Tue after 17:00",
                        recording_url="https://example.com/recordings/muller-demo.mp3",
                        created_by="voice_agent", occurred_at=spec["last_contact_at"],
                    )
                )
            elif spec.get("seed_interaction"):
                session.add(
                    models.Interaction(
                        customer_id=c.id, channel="phone", direction="outbound",
                        content=spec["seed_interaction"], created_by="rep",
                        occurred_at=spec["last_contact_at"],
                    )
                )

        await session.commit()

        # Run ANALYZE for every customer so the dashboard opens fully populated.
        for c in created:
            fresh = await session.get(models.Customer, c.id)
            await analyze_svc.run_analyze(session, fresh)

    print(f"Seeded {len(CUSTOMERS)} customers, {len(REPS)} reps, "
          f"{len(BUYER_TYPES)} buyer types, {len(OBJECTIONS)} objections, "
          f"{len(PLAYS)} plays. Golden path: Familie Müller.")


if __name__ == "__main__":
    asyncio.run(seed())
