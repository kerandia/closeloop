/**
 * Landing — the app's entry screen. Faithful React port of
 * closeloop-how-it-works.html: same markup, same classes. Styles live in
 * Landing.css, fully scoped under `.cl-landing` so they can't touch the
 * dashboard. One CTA ("Try the demo") enters the app at /app.
 */
import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import './Landing.css'

export function Landing() {
  const rootRef = useRef<HTMLDivElement>(null)

  // Scroll-reveal: fade each .reveal block in as it enters the viewport.
  useEffect(() => {
    const root = rootRef.current
    if (!root || !('IntersectionObserver' in window)) return
    const els = root.querySelectorAll('.reveal')
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            io.unobserve(e.target)
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -6% 0px' },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <div className="cl-landing" ref={rootRef}>
      {/* HERO */}
      <header className="hero">
        <div className="wrap">
          <p className="eyebrow">CloseLoop · how it thinks</p>
          <h1>
            We don't write emails. We give installers a <span className="accent">sales brain.</span>
          </h1>
          <p className="lede">
            Most solar deals don't die at the pitch. They die in the silent stretch between{' '}
            <strong>"quote sent"</strong> and <strong>"contract signed."</strong> CloseLoop reads
            each customer, coaches the rep in real time on every channel, and{' '}
            <em>explains its reasoning every single time</em> — so the strategy is something an
            installer can actually trust. This page opens the hood and shows exactly how it works.
          </p>
          <div className="pillrow">
            <span className="hpill">Reads the customer</span>
            <span className="hpill">
              Coaches in <b>real time</b>
            </span>
            <span className="hpill">
              Shows its <b>reasoning</b>
            </span>
            <span className="hpill">
              Gets <b>smarter</b> every deal
            </span>
          </div>
          <Link to="/app" className="cl-cta">
            Try the demo
          </Link>
        </div>
      </header>

      {/* THE GAP */}
      <section>
        <div className="wrap reveal">
          <p className="eyebrow">The problem</p>
          <div className="gap-grid">
            <p className="gap-line">
              Installers nail the pitch and the quote. Then momentum dies — the homeowner hesitates,
              gets distracted, collects a competing offer — and the deal quietly goes{' '}
              <em>cold.</em>
            </p>
            <div className="gap-rail">
              <p>
                Reps can't personalize follow-up at scale, and generic templates don't move the
                needle. There's never a clear answer to the only question that matters:{' '}
                <em>why this message, at this time, in this tone?</em> That silent gap is where most
                revenue leaks out.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* THE BET / PILLARS */}
      <section className="band-soft">
        <div className="wrap reveal">
          <div className="head">
            <p className="eyebrow">The idea</p>
            <h2>Strategy, not templates — and it shows its work.</h2>
            <p className="lead">
              We keep the salesperson in the loop and put a brain underneath. Three promises hold the
              whole thing together — and everything further down this page is just how we deliver
              them.
            </p>
          </div>
          <div className="pillars">
            <div className="pillar">
              <div className="pk">01 · Explainable</div>
              <h3>Every suggestion shows why</h3>
              <p>
                A one-line reason sits under each recommendation. Not a black-box label — advice a rep
                can trust, question, and learn from.
              </p>
            </div>
            <div className="pillar">
              <div className="pk">02 · Editable</div>
              <h3>You can change the plan</h3>
              <p>
                Move a step, change the tone, and the model re-reasons the rest. The strategy is yours
                to steer, not a fixed script.
              </p>
            </div>
            <div className="pillar">
              <div className="pk">03 · Learning</div>
              <h3>It compounds</h3>
              <p>
                Every outcome feeds one shared brain. A lesson one rep learns becomes everyone's — the
                next deal starts smarter.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* LIFECYCLE */}
      <section>
        <div className="wrap reveal">
          <div className="head">
            <p className="eyebrow">The shape of it</p>
            <h2>Five moves around a single customer.</h2>
            <p className="lead">
              Before the contact, during it, and between contacts — then the loop closes. Here's the
              sequence at a glance; the mechanics behind it come next.
            </p>
          </div>
          <div className="life">
            <div className="lifestep">
              <div className="ln">01 · Qualify</div>
              <h3>The first call</h3>
              <p>
                An AI voice agent calls a new lead: warm, low-pressure, gathers what matters. No
                selling, no quoting.
              </p>
            </div>
            <div className="lifestep">
              <div className="ln">02 · Identify</div>
              <h3>Read the buyer</h3>
              <p>
                Turns that call into a two-layer profile — every read backed by the customer's own
                words.
              </p>
            </div>
            <div className="lifestep">
              <div className="ln">03 · Guide</div>
              <h3>Coach live</h3>
              <p>
                Reads what the customer just said and tells the rep how to answer: the tone, the
                words, and why.
              </p>
            </div>
            <div className="lifestep">
              <div className="ln">04 · Record</div>
              <h3>Capture the read</h3>
              <p>
                The rep logs the outcome — including their gut feel — and the profile updates on the
                spot.
              </p>
            </div>
            <div className="lifestep">
              <div className="ln">05 · Cadence</div>
              <h3>Set the rhythm</h3>
              <p>
                Schedules the next step (when, which channel, why) and watches for deals going quiet.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT ACTUALLY WORKS */}
      <section className="band-soft">
        <div className="wrap">
          <div className="head reveal" style={{ marginBottom: '8px' }}>
            <p className="eyebrow">Open the hood</p>
            <h2>How it actually works.</h2>
            <p className="lead">
              Four mechanics do the real work: how we read what a customer means, how we build the
              profile, how we score the deal, and how the system learns.
            </p>
          </div>

          {/* MECHANIC 1 */}
          <div className="mech reveal">
            <div className="mech-tag">
              <span className="dot"></span>Mechanic 1 · Reading what the customer means
            </div>
            <h2>We don't let the AI freestyle. It works in two layers.</h2>
            <p className="intro">
              When a customer pushes back, the response can't be improvised — it has to be a real
              sales move. So the judgment is <b>split in two</b>: a fixed skeleton defined by
              salespeople, and the AI's live work on top of it.
            </p>

            <div className="layers">
              <div className="layer fixed">
                <div className="lk">◆ Layer 1 — fixed (sales-defined)</div>
                <h4>A dictionary of objection types</h4>
                <p>
                  Every objection a homeowner raises maps to one of a fixed set of categories. Each
                  carries what it <em>really</em> means underneath, and the principle for handling it.
                  Written by salespeople, not engineers — this is the part that never changes.
                </p>
              </div>
              <div className="layer live">
                <div className="lk">● Layer 2 — live (the AI)</div>
                <h4>Classify → apply → generate</h4>
                <p>
                  The AI takes what the customer said, <em>classifies</em> it into a category,{' '}
                  <em>applies</em> that category's principle, then <em>writes</em> the reply — adds a
                  specific next step, and shows the reasoning. It plays inside the frame, never
                  wandering.
                </p>
              </div>
            </div>

            <div className="dict">
              <div className="dcard">
                <div className="says">"It's too expensive." · "that's a lot of money."</div>
                <h4>Price / value gap</h4>
                <div className="rowline means">
                  <span className="rl">Really</span>
                  <span className="rt">Usually not about price — they just haven't seen the value yet.</span>
                </div>
                <div className="rowline move">
                  <span className="rl">The move</span>
                  <span className="rt">Don't discount. Reframe the one-off total as money saved every month.</span>
                </div>
              </div>
              <div className="dcard">
                <div className="says">"We want to shop around a couple more places."</div>
                <h4>Comparing quotes</h4>
                <div className="rowline means">
                  <span className="rl">Really</span>
                  <span className="rt">Normal, not a rejection — but it's a timer once a rival quote lands.</span>
                </div>
                <div className="rowline move">
                  <span className="rl">The move</span>
                  <span className="rt">Move the comparison off price onto warranty and long-term value.</span>
                </div>
              </div>
              <div className="dcard">
                <div className="says">"Let me think." · "I need to check with my wife."</div>
                <h4>Decision / "let me think"</h4>
                <div className="rowline means">
                  <span className="rl">Really</span>
                  <span className="rt">An unspoken hesitation — or the real decision-maker isn't in the room.</span>
                </div>
                <div className="rowline move">
                  <span className="rl">The move</span>
                  <span className="rt">Surface the real blocker; arm them to convince the spouse.</span>
                </div>
              </div>
              <div className="dcard">
                <div className="says">"Does it even work in winter?" · "what about cloudy days?"</div>
                <h4>Technical doubt — output</h4>
                <div className="rowline means">
                  <span className="rl">Really</span>
                  <span className="rt">They want reassurance, not a debate — wary of overblown claims.</span>
                </div>
                <div className="rowline move">
                  <span className="rl">The move</span>
                  <span className="rt">Honest, brief explanation; route the exact numbers to a site visit.</span>
                </div>
              </div>
            </div>

            {/* WORKED EXAMPLE */}
            <div className="ex">
              <div className="extag">Watch one go through the machine</div>
              <div className="said">
                The customer says <span className="q">"that's a lot of money."</span>
              </div>
              <div className="flow">
                <span className="chiplabel">classified as</span>
                <span className="arr">→</span>
                <span className="classified">Price / value gap</span>
              </div>
              <div className="reply">
                <div className="rlbl">Suggested reply — what the rep says</div>
                <div className="rtext">
                  "I hear you — as a one-off it's not small. But it turns that electricity bill that
                  keeps climbing into a fixed cost that only gets better over time. Let me put it in
                  monthly terms for you —{' '}
                  <span className="hook">
                    shall we walk through the breakdown Wednesday, and I'll send it over?
                  </span>
                  "
                </div>
              </div>
              <div className="whyline">
                <b>Why this</b>Read as a price objection — "a lot of money" usually isn't about
                price, it's unseen value. So re-frame the total as monthly savings, not a discount
                (discounting makes them think you padded the price). And it ends with a specific next
                step, so the conversation keeps moving.
              </div>
            </div>

            <div className="why-callout">
              <b>That grey line is the whole point.</b> Every suggestion carries its reasoning. It's
              the difference between a label the rep has to take on faith and a play they can trust —
              and learn.
            </div>
          </div>

          {/* MECHANIC 2 */}
          <div className="mech reveal">
            <div className="mech-tag">
              <span className="dot"></span>Mechanic 2 · Building the profile
            </div>
            <h2>Two layers, and every read carries the customer's own words.</h2>
            <p className="intro">
              From the qualifying call, the AI builds a profile in two layers. The{' '}
              <b>motivation layer</b> — why they want solar. The <b>negotiation layer</b> — how
              they'll behave in the deal. No black-box labels: each read ships with the exact words
              that triggered it.
            </p>

            <div className="profile">
              <div className="player mot">
                <div className="plk">● Motivation layer — why they want it</div>
                <div className="read">
                  <div className="rconc">
                    Wants predictable, lower bills
                    <span className="sub">savings + peace of mind, not an impulse buy</span>
                  </div>
                  <div className="rev">
                    our electricity bills just keep climbing — last month's bill genuinely gave us a
                    fright
                  </div>
                </div>
              </div>
              <div className="player neg">
                <div className="plk">◆ Negotiation layer — how they'll behave</div>
                <div className="read">
                  <div className="rconc">
                    Multi-quote risk: HIGH
                    <span className="sub">move before a competing quote lands</span>
                  </div>
                  <div className="rev">
                    we're also talking to one or two other companies, just to compare
                  </div>
                </div>
                <div className="read">
                  <div className="rconc">
                    Decision-makers: both spouses<span className="sub">the wife is part of the call</span>
                  </div>
                  <div className="rev">my wife's quite keen too / both of us are around after six</div>
                </div>
                <div className="read">
                  <div className="rconc">
                    Commitment-shy, no rush<span className="sub">slow the cadence, reassure more</span>
                  </div>
                  <div className="rev">we're not in a rush, really</div>
                </div>
              </div>
              <div className="player hes">
                <div className="plk">▲ Early hesitation</div>
                <div className="read">
                  <div className="rconc">Worried about winter output</div>
                  <div className="rev">a bit worried it won't do much when it's cold and grey</div>
                </div>
              </div>
            </div>
          </div>

          {/* MECHANIC 3 */}
          <div className="mech reveal">
            <div className="mech-tag">
              <span className="dot"></span>Mechanic 3 · Scoring the deal
            </div>
            <h2>One number per customer: how likely are they to close — moving in real time.</h2>
            <p className="intro">
              A score from 0–100 tells the rep at a glance{' '}
              <b>who's most likely to close, and who to push today.</b> It's not a static label — it
              moves as things actually happen in the deal. One simple rule sets every weight:
            </p>

            <p className="scorerule">
              The more an action <em>costs</em> in time or commitment, the more it's worth —{' '}
              <em>talk is cheap, doing is expensive.</em>
            </p>

            <div className="sigcols">
              <div className="sigbox up">
                <div className="sk">▲ Pushes the score up</div>
                <div className="sigrow">
                  <span className="sg">Agrees to a home visit</span>
                  <span className="sv">+18</span>
                </div>
                <div className="sigrow">
                  <span className="sg">Asks "when can it be installed?"</span>
                  <span className="sv">+15</span>
                </div>
                <div className="sigrow">
                  <span className="sg">Brings the decision-maker in</span>
                  <span className="sv">+15</span>
                </div>
                <div className="sigrow">
                  <span className="sg">Asks about financing / payment</span>
                  <span className="sv">+12</span>
                </div>
                <div className="sigrow">
                  <span className="sg">Takes the next step ("send it Wed")</span>
                  <span className="sv">+8</span>
                </div>
                <div className="sigrow">
                  <span className="sg">Acknowledges docs received</span>
                  <span className="sv">+6</span>
                </div>
              </div>
              <div className="sigbox down">
                <div className="sk">▼ Pulls the score down</div>
                <div className="sigrow">
                  <span className="sg">No-shows an agreed call / visit</span>
                  <span className="sv">−20</span>
                </div>
                <div className="sigrow">
                  <span className="sg">Says "maybe next year"</span>
                  <span className="sv">−15</span>
                </div>
                <div className="sigrow">
                  <span className="sg">Mentions a rival more favorably</span>
                  <span className="sv">−10</span>
                </div>
                <div className="sigrow">
                  <span className="sg">Re-raises a handled objection</span>
                  <span className="sv">−5</span>
                </div>
                <div className="sigrow">
                  <span className="sg">Goes silent past the window</span>
                  <span className="sv">−4/day</span>
                </div>
                <div className="sigrow">
                  <span className="sg">Chose a competitor</span>
                  <span className="sv">→ 0</span>
                </div>
              </div>
            </div>

            <div className="bands">
              <div className="bandcard hot">
                <div className="bn">80–100</div>
                <h4>Hot</h4>
                <p>Ready to sign — push to close.</p>
              </div>
              <div className="bandcard warm">
                <div className="bn">60–79</div>
                <h4>Warm</h4>
                <p>Progressing — keep the rhythm.</p>
              </div>
              <div className="bandcard cool">
                <div className="bn">40–59</div>
                <h4>Cool</h4>
                <p>Stalled — needs a nudge.</p>
              </div>
              <div className="bandcard cold">
                <div className="bn">0–39</div>
                <h4>Cold</h4>
                <p>Ghost risk — escalate.</p>
              </div>
            </div>

            <div className="journey">
              <div className="jtag">The same customer's score, live through the deal</div>
              <div className="jtrack">
                <div className="jstep">
                  <div className="jval">50</div>
                  <div className="jwhen">After the first call</div>
                  <div className="jwhy">
                    Engaged and shared info, but commitment-shy + comparing + a winter doubt hold it
                    down.
                  </div>
                </div>
                <div className="jconn">
                  <span className="jdelta pos">+5 →</span>
                </div>
                <div className="jstep">
                  <div className="jval">55</div>
                  <div className="jwhen">Objection handled</div>
                  <div className="jwhy">Price + comparison handled well, and a next step offered.</div>
                </div>
                <div className="jconn">
                  <span className="jdelta neg">−5 →</span>
                </div>
                <div className="jstep">
                  <div className="jval">50</div>
                  <div className="jwhen">"Wife not on board" logged</div>
                  <div className="jwhy">A clear blocker surfaces — the deal isn't unblocked yet.</div>
                </div>
                <div className="jconn">
                  <span className="jdelta pos">+18 →</span>
                </div>
                <div className="jstep">
                  <div className="jval">
                    68 <span className="up">↑</span>
                  </div>
                  <div className="jwhen">Agrees to a home visit</div>
                  <div className="jwhy">A visit is a real commitment — close-likelihood clearly up.</div>
                </div>
              </div>
              <div className="ghostnote">
                <b>Ghost Radar</b> isn't a separate widget — it's this same score <em>falling.</em>{' '}
                When a deal goes quiet, the number drops and the alert fires. One score, not three.
              </div>
            </div>
          </div>

          {/* MECHANIC 4 */}
          <div className="mech reveal">
            <div className="mech-tag">
              <span className="dot"></span>Mechanic 4 · How it learns
            </div>
            <h2>Every contact feeds one shared brain.</h2>
            <p className="intro">
              Two databases make the system compound instead of resetting each call: a{' '}
              <b>Central Brain</b> that holds what the whole team has learned, and a{' '}
              <b>living profile</b> for every customer. Each makes the other smarter.
            </p>

            <div className="db-grid">
              <div className="db brain">
                <div className="kicker">◆ The Central Brain</div>
                <h3>Shared intelligence</h3>
                <p>
                  Accumulates across every customer and every rep: which approach closes which buyer
                  type, the timing and channels that actually convert. It holds the priors — so a
                  brand-new customer benefits from everything the team already knows.
                </p>
              </div>
              <div className="db profile">
                <div className="kicker">● Customer profiles</div>
                <h3>One living record per deal</h3>
                <p>
                  Profile, every interaction, the rep's gut-feel notes, objections raised, current
                  stage, and deal score. The single source of truth for that one deal — and the thing
                  the rep actually looks at.
                </p>
              </div>
            </div>

            <div className="flywheel">
              <div className="ft">The loop — every outcome feeds back</div>
              <div className="brainbar">
                <div className="t">
                  ◆ CENTRAL <span>BRAIN</span>
                </div>
                <div className="sub">priors · benchmarks · best play · what closes which type</div>
              </div>
              <div className="fdown">↓</div>
              <div className="fflow">
                <div className="fstage">
                  <div className="n">01</div>
                  <div className="s">Qualify</div>
                </div>
                <span className="fconn"></span>
                <div className="fstage">
                  <div className="n">02</div>
                  <div className="s">Identify</div>
                </div>
                <span className="fconn"></span>
                <div className="fstage">
                  <div className="n">03</div>
                  <div className="s">Guide</div>
                </div>
                <span className="fconn"></span>
                <div className="fstage">
                  <div className="n">04</div>
                  <div className="s">Cadence</div>
                </div>
                <span className="fconn"></span>
                <div className="fstage fb">
                  <div className="n">05</div>
                  <div className="s">Record</div>
                </div>
              </div>
              <div className="freturn">
                ↺ every outcome feeds back into the <b>Central Brain</b> + the customer's profile —
                the more deals you run, the smarter every future deal gets
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WALKTHROUGH */}
      <section className="band-dark">
        <div className="wrap reveal">
          <div className="head">
            <p className="eyebrow">All four mechanics, one customer</p>
            <h2>See it on the Müllers.</h2>
            <p className="lead">
              A family quoted €18,000, then silence. Watch the profile, the coaching, and the score
              work together — end to end.
            </p>
          </div>
          <div className="walk">
            <div className="wstep">
              <div className="wchan">
                Phone<span className="wk">Qualify</span>
              </div>
              <div className="wbody">
                The AI voice agent makes the first call — warm, no quote — and draws out the
                situation: rising bills, gas heating, an EV next year, a winter doubt, both spouses
                deciding.
              </div>
              <div className="wscore">
                50<span className="lab">deal score</span>
              </div>
            </div>
            <div className="wstep">
              <div className="wchan">
                In-app<span className="wk">Identify</span>
              </div>
              <div className="wbody">
                That call becomes a profile: family, commitment-shy, spouses not aligned, comparing
                others, worried about winter — each read tied to a quote the customer actually said.
              </div>
              <div className="wscore">
                50<span className="lab">profiled</span>
              </div>
            </div>
            <div className="wstep">
              <div className="wchan">
                WhatsApp<span className="wk">Guide</span>
              </div>
              <div className="wbody">
                Customer:{' '}
                <span className="q">
                  "the price is higher than we expected, and we want to shop around."
                </span>{' '}
                The co-pilot reads price + comparison, drafts the reframe to monthly savings + a
                Wednesday next step, and shows why. One tap to send.
              </div>
              <div className="wscore">
                55<span className="arrow"> ↑</span>
                <span className="lab">+5 · next step set</span>
              </div>
            </div>
            <div className="wstep">
              <div className="wchan">
                In-app<span className="wk">Record</span>
              </div>
              <div className="wbody">
                The rep logs the gut read:{' '}
                <span className="q">"price loosened, but the wife isn't on board."</span> The profile
                updates live — a new blocker the AI couldn't have seen on its own.
              </div>
              <div className="wscore">
                50<span className="lab">−5 · blocker</span>
              </div>
            </div>
            <div className="wstep">
              <div className="wchan">
                Email + Visit<span className="wk">Cadence</span>
              </div>
              <div className="wbody">
                The Wednesday hook becomes a to-do and a tailored email. Then the system books a home
                visit in 48h — not another email — because the wife is the blocker and a visit builds
                trust. They agree.
              </div>
              <div className="wscore">
                68<span className="arrow"> ↑</span>
                <span className="lab">+18 · visit booked</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WHAT MAKES IT DIFFERENT */}
      <section>
        <div className="wrap reveal">
          <div className="head">
            <p className="eyebrow">Why it's different</p>
            <h2>Four things half the room won't have.</h2>
          </div>
          <div className="diff">
            <div className="df">
              <h3>
                <span>Explainable →</span> not a black box
              </h3>
              <p>
                Every output — a reply, a score change, a next step — carries a one-line reason. The
                installer can trust it, question it, and learn the trade from it.
              </p>
            </div>
            <div className="df">
              <h3>
                <span>Strategy →</span> not templates
              </h3>
              <p>
                Reasoning, timing, and tone an installer can understand and edit. Change a step and
                the model re-thinks the rest. Nobody needs another email generator.
              </p>
            </div>
            <div className="df">
              <h3>
                <span>It learns →</span> the whole team
              </h3>
              <p>
                A shared brain plus per-customer profiles, wired with feedback. The lesson one rep
                learns sharpens the next deal for everyone — it compounds.
              </p>
            </div>
            <div className="df">
              <h3>
                <span>One judgment →</span> every channel
              </h3>
              <p>
                Phone, WhatsApp, email all run on the same sales brain. "Too expensive" is read the
                same way wherever it lands — only the trigger differs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="wrap reveal">
          <div className="fn">
            Close<span>Loop</span>
          </div>
          <p className="fline">
            "We give installers a sales brain that reads the family, coaches the rep in real time, and
            gets smarter with every deal — and we close the Müllers."
          </p>
          <div className="meta">REONIC TRACK · {'{TECH: EUROPE}'} ENERGY × AI HACKATHON · BERLIN</div>
        </div>
      </footer>
    </div>
  )
}
