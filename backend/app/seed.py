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

# The objection playbook (objection-playbook.md) — Layer 1, the fixed sales
# skeleton RESPOND reasons against. 4 [demo-core] (the Müller path) + 4 extended.
# why_line uses the fixed template: "Read as <category> — <root read>. So
# <tactical direction>, not <the common mistake>."
OBJECTIONS = [
    dict(  # A · demo-core
        key="price_too_high",
        category="Price / value gap",
        customer_phrasings=["it's a lot of money", "that's expensive", "das ist teuer",
                            "a lot of money", "can you come down", "didn't expect it to cost"],
        read="value gap, not price",
        root_read="Usually not about price but an unseen value gap — they haven't connected "
                  "the spend to what they get. (If they keep pushing a hard budget ceiling, "
                  "it may be a real budget issue — then be honest about financing.)",
        reframe_strategy="shift total price → monthly saving and payback",
        do_list=["reframe to €/month", "compare to current bill", "tie to their motivation"],
        dont_list=["don't discount — signals padded price", "don't bury them in specs"],
        red_lines=["Don't discount (admits the price was padded; haggling + trust collapse)",
                   "Don't drown them in technical specs — that's not where they're stuck"],
        advance_hook="Let me put the monthly savings on one page and send it over — shall we walk through it together?",
        why_line="Read as a price objection — 'too expensive' usually isn't about price, it's "
                 "unseen value. So re-frame the total as monthly savings, not a discount "
                 "(discounting makes them think you padded the price).",
        exact_lines=[
            "I understand — most people find it easier as about €{saving} a month, less than the bill it replaces.",
            "The price reflects the equipment and warranty; the payback is around {payback} years, then it's saving you money.",
        ],
        applies_to=["family", "skeptic", "investor"],
        demo_core=True,
    ),
    dict(  # B · demo-core
        key="need_other_quotes",
        category="Shopping around / comparing quotes",
        customer_phrasings=["we want to check other companies", "comparing options", "andere angebote",
                            "talking to a few others", "want to compare", "other quotes"],
        read="multi-quote risk — protect the deal, don't pressure",
        root_read="Normal behaviour, not a rejection — but it's a timer. Once a competing "
                  "quote lands you lose the initiative; the real risk is losing on lowest "
                  "price and the deal going cold.",
        reframe_strategy="arm them to compare on equipment + warranty, not headline price",
        do_list=["name the multi-quote risk honestly", "move comparison to warranty/service/value",
                 "give a gentle real next step"],
        dont_list=["don't badmouth competitors", "don't discount to win the race", "don't show anxiety"],
        red_lines=["Don't trash competitors (reads as desperate, lifts them up)",
                   "Don't slash price to win", "Don't show anxiety — rushing drops your position"],
        advance_hook="Let me lay out the warranty and service comparison so you've got a clear basis — okay if I follow up Thursday?",
        why_line="Read as comparison shopping — normal, not a rejection, but time-pressured. "
                 "So move the comparison from price to warranty and long-term value, not a "
                 "discount or knocking the competition.",
        exact_lines=[
            "Comparing is smart. The things to check across quotes are the panel/inverter brand and the warranty length — not just the headline price.",
        ],
        applies_to=["skeptic", "family", "investor"],
        demo_core=True,
    ),
    dict(  # C · demo-core
        key="spouse",
        category="Decision authority / let me think",
        customer_phrasings=["check with my wife", "talk to my husband", "mit meiner frau",
                            "let me think about it", "need to check with my family", "no rush to decide"],
        read="second decision-maker not yet aligned, or an unspoken hesitation",
        root_read="'Let me think' is rarely literal — usually an unspoken hesitation or the "
                  "real decision-maker isn't in the room. (For Müller: the wife is part of "
                  "the decision.)",
        reframe_strategy="surface the real blocker; arm them to convince the absent partner",
        do_list=["gently surface what's not settled", "offer a joint call/visit",
                 "send a one-pager they can share"],
        dont_list=["don't push for a decision now", "don't treat 'let me think' as the end"],
        red_lines=["Don't use fake urgency to force it (families hate it most)",
                   "Don't let go after 'let me think'", "Don't just throw an ROI sheet — the blocker is a person, not a number"],
        advance_hook="I'll put together something simple your wife can glance through — shall we find a time you're both around for a quick 15-minute visit?",
        why_line="Read as decision / stalling — behind 'let me think' there's usually an "
                 "unspoken concern or an absent decision-maker. So surface the real blocker "
                 "and help them convince the spouse, not pressure or chase.",
        exact_lines=[
            "Of course — it's a joint decision. Would it help if I sent a short summary you could go through together, or joined a quick call with you both?",
        ],
        applies_to=["family"],
        demo_core=True,
    ),
    dict(  # D · demo-core
        key="winter_yield",
        category="Technical doubt: output",
        customer_phrasings=["does it work in winter", "what about cloudy days", "im winter",
                            "enough sun here", "will it really save that much"],
        read="performance doubt — seeking reassurance, not objecting",
        root_read="They want confirmation the thing actually works, often with a bit of "
                  "wariness about overblown claims. It's reassurance-seeking, not a real block.",
        reframe_strategy="explain annual yield + grid offset, then route precise numbers to an estimate",
        do_list=["talk annual production", "mention the grid covers gaps",
                 "route exact numbers to a site estimate"],
        dont_list=["don't overpromise winter output", "don't fob them off with 'it'll be fine'"],
        red_lines=["Don't overclaim ('full output all year' — one puncture and trust is gone)",
                   "Don't fob them off — empty reassurance reads as nervous"],
        advance_hook="How about we set a time to look at your roof and give you an actual production-and-savings estimate for your sun exposure?",
        why_line="Read as a technical doubt (output) — what they want is reassurance. So give "
                 "an honest, brief plain-language explanation, then route the precise numbers "
                 "to an estimate for their roof, not a vague promise or hype.",
        exact_lines=[
            "Great question — panels do produce less in winter, but the system is sized for the whole year, and the grid covers any gap automatically.",
        ],
        applies_to=["skeptic", "family", "environmentalist"],
        demo_core=True,
    ),
    dict(  # E · extended
        key="install_disruption",
        category="Roof / house & install concerns",
        customer_phrasings=["how much mess", "how long does it take", "wie lange dauert",
                            "will it leak", "will it damage the roof", "will it look bad"],
        read="fear of harming their own home, not of the product",
        root_read="A protective instinct about 'my house' — emotion outweighs logic. The fear "
                  "is that installing this will damage or disrupt their home.",
        reframe_strategy="acknowledge first, then give certainty with install craft + warranty",
        do_list=["acknowledge the concern is fair", "give a concrete install duration",
                 "explain waterproofing/mounting standards", "offer a reference case"],
        dont_list=["don't be vague about timing", "don't brush it off", "don't drown emotion in tech detail"],
        red_lines=["Don't brush it off ('it'll be fine' — they'll feel unheard)",
                   "Don't drown an emotional concern in technical detail"],
        advance_hook="Good moment for a site visit — the install lead can show you exactly how the waterproofing and mounting are done. What day this week works?",
        why_line="Read as a house concern — at root it's fear of harming their own home, "
                 "emotion over logic. So acknowledge first, then give certainty with install "
                 "craft and warranty, not a quick 'it'll be fine.'",
        exact_lines=[
            "That's a fair thing to care about — it's your home. Most installs are done in a day or two, the team waterproofs every mount and leaves the site clean. I can walk you through exactly what the days look like.",
        ],
        applies_to=["family", "skeptic"],
        demo_core=False,
    ),
    dict(  # F · extended
        key="trust_new_company",
        category="Long-term trust / after-sales",
        customer_phrasings=["never heard of you", "are you reputable", "kenne ich nicht",
                            "will the company go under", "who fixes it if it breaks",
                            "will you still be around"],
        read="assessing whether the company is reliable and won't disappear",
        root_read="A long-term commitment — they're judging whether you'll still be here in "
                  "20 years. At root it's trust in the company, not the product.",
        reframe_strategy="turn abstract trust into concrete warranty + after-sales + track record",
        do_list=["offer references", "highlight warranty and local installs",
                 "make 'who fixes it, how fast' concrete"],
        dont_list=["don't get defensive", "don't make empty guarantees", "don't dodge warranty details"],
        red_lines=["Don't make empty guarantees ('we'll never go under' — weaker the more you say it)",
                   "Don't dodge warranty details — dodging looks like hiding"],
        advance_hook="Let me send over the warranty and after-sales process — want me to add two customers near you we've installed for, as a reference?",
        why_line="Read as long-term trust — they're assessing the company's reliability; at "
                 "root it's trust, not the product. So give concrete evidence with warranty "
                 "and after-sales, not empty promises.",
        exact_lines=[
            "Totally fair. We're happy to share local references and the full warranty and after-sales terms up front — I'd rather you feel sure than rushed.",
        ],
        applies_to=["skeptic"],
        demo_core=False,
    ),
    dict(  # G · extended
        key="policy_subsidy",
        category="Policy / subsidy / process confusion",
        customer_phrasings=["how do i apply for the subsidy", "is the paperwork a hassle",
                            "grid connection complicated", "i don't get the policy", "förderung"],
        read="friction, not an objection — they feel it's a hassle",
        root_read="Not unwilling — put off by the complexity. The blocker is perceived hassle "
                  "around paperwork, subsidy applications and grid connection.",
        reframe_strategy="take the complexity off their shoulders — 'we handle all of this'",
        do_list=["stress 'we handle the paperwork for you'", "simplify to a one-pager",
                 "give certainty and peace of mind"],
        dont_list=["don't dump policy detail on them", "don't bluff if unsure — defer to the specialist"],
        red_lines=["Don't hand the friction back as a pile of policy detail",
                   "Don't bluff on policy — getting it wrong is costly; defer if unsure"],
        advance_hook="We take care of all the paperwork — let me send a simple one-pager, and what day works for me to get the first step done for you?",
        why_line="Read as process / policy confusion — not an objection, a hassle. So stress "
                 "'we handle this for you' and a sense of ease, not a pile of policy detail.",
        exact_lines=[
            "Good news — the subsidy and grid paperwork is the part we handle entirely for you. I'll send a simple one-pager so you can see exactly what's involved on your side (almost nothing).",
        ],
        applies_to=["family", "skeptic", "investor"],
        demo_core=False,
    ),
    dict(  # H · extended
        key="timing_no_rush",
        category="Timing / no rush",
        customer_phrasings=["no rush right now", "maybe next year", "wait for the tech to mature",
                            "leave it for now", "kein eile"],
        read="solar isn't a 'do it now' priority yet",
        root_read="Either no urgent pain, or waiting for a 'better moment' (often a "
                  "procrastination excuse). Not a no — just not yet on their radar.",
        reframe_strategy="give a real reason to act now with facts, not fake urgency",
        do_list=["cite electricity-price trend / subsidy window", "note earlier savings compound",
                 "tie back to their motivation", "leave a specific light next step"],
        dont_list=["don't invent fake deadlines", "don't accept 'next year' and hang up"],
        red_lines=["Don't invent fake deadlines/offers (caught = trust gone)",
                   "Don't accept 'next year' and drop it — leave a specific light next step"],
        advance_hook="No rush is fine — how about I work up the estimate and subsidy picture first so you've got the numbers, and you reach out whenever you want to move?",
        why_line="Read as timing / stalling — solar isn't their priority yet. So give a real "
                 "reason to act now (prices, subsidy window, earlier-is-cheaper), not fake urgency.",
        exact_lines=[
            "No pressure at all. Worth knowing electricity prices keep climbing and the current subsidy window won't stay open forever — every month earlier is money saved. I can put the numbers together so it's ready whenever you are.",
        ],
        applies_to=["family", "investor", "skeptic"],
        demo_core=False,
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
