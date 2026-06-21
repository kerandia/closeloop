/**
 * ProfilePanel — Step 3 agents implement the body; do NOT change prop signatures.
 *
 * Prop contract:
 *   profile  Profile | null
 *     The analyzed psychographic profile. null means ANALYZE hasn't run yet
 *     (or the customer was just created). Render an empty/placeholder state.
 *     Key fields to surface:
 *       profile.summary            — one-line context at the top
 *       profile.motivation         — e.g. "peace_of_mind" with motivation_conf
 *       profile.negotiation        — multi_quote_risk, price_sensitivity,
 *                                    decision_makers, blockers, buying_signals
 *       profile.objections[]       — { key, note } with evidence_quote on hover
 *       profile.completeness       — 0–100 fill indicator
 *
 *   signals  Signal[]
 *     Per-signal evidence from interactions. Each signal has:
 *       signal.layer               — 'motivation'|'negotiation'|'objection'|'buying_signal'
 *       signal.label               — human label ("multi_quote_risk: HIGH")
 *       signal.evidence_quote      — verbatim customer quote (show on hover/inline)
 *       signal.confidence          — 0.0–1.0
 *     Render as chips grouped by layer; evidence_quote is the differentiator.
 *
 *   quote  Quote | null
 *     The sent quote (system size, price, payback, financing). Summarise
 *     key numbers for context — "12 kWp · €28,900 · 9.5yr payback".
 */
import { useEffect, useRef, useState } from 'react'
import type { Profile, Signal, Quote, SignalLayer } from '../../api/types'
import { humanizeLabel, motivationLabel, confidencePct } from '../../lib/format'
import { SignalChip } from './SignalChip'
import './ProfilePanel.css'

export interface ProfilePanelProps {
  profile: Profile | null
  signals: Signal[]
  quote: Quote | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function groupByLayer(signals: Signal[]): Record<SignalLayer, Signal[]> {
  const grouped: Record<SignalLayer, Signal[]> = {
    motivation: [],
    negotiation: [],
    objection: [],
    buying_signal: [],
  }
  for (const s of signals) {
    // Be defensive: the LLM can emit a layer outside the known set — bucket any
    // unrecognised layer into 'negotiation' rather than crashing the page.
    ;(grouped[s.layer] ?? grouped.negotiation).push(s)
  }
  return grouped
}

interface QuoteStat {
  label: string
  value: string
}

function quoteStats(quote: Quote): QuoteStat[] {
  const stats: QuoteStat[] = []
  if (quote.system_size_kwp != null)
    stats.push({ label: 'System', value: `${quote.system_size_kwp} kWp` })
  if (quote.price_eur != null)
    stats.push({ label: 'Price', value: `€${quote.price_eur.toLocaleString('de-DE')}` })
  if (quote.payback_years != null)
    stats.push({ label: 'Payback', value: `${quote.payback_years} yrs` })
  return stats
}

// ── Objections: merge two sources into one list ───────────────────────────────
// An objection arrives twice: as profile.objections (key + note) AND as an
// objection-layer signal (label + the customer's own words). Showing both is the
// duplication the rep complained about — so we fold them into a single entry that
// carries the note for context and the quote as expandable evidence.

function normalizeKey(s: string): string {
  return s.replace(/[_\s-]+/g, ' ').trim().toLowerCase()
}

// Objection signals are phrased "<thing> surfaced"; drop that suffix for display.
function stripObjectionSuffix(label: string): string {
  return label.replace(/[\s_-]*surfaced\s*$/i, '').trim()
}

interface MergedObjection {
  id: string
  key: string
  name: string
  note: string | null
  evidence: string | null
}

function mergeObjections(
  objections: Profile['objections'],
  objectionSignals: Signal[],
): MergedObjection[] {
  const items: MergedObjection[] = []
  // Fuzzy match: "winter yield" (objection key) ⇄ "winter yield doubt" (signal).
  const findMatch = (key: string) =>
    items.find((it) => it.key.includes(key) || key.includes(it.key))

  // Seed from signals first — they carry the evidence quote.
  for (const s of objectionSignals) {
    const base = stripObjectionSuffix(s.label)
    const key = normalizeKey(base)
    const match = findMatch(key)
    if (match) {
      match.evidence = match.evidence ?? s.evidence_quote ?? null
      continue
    }
    items.push({
      id: s.id,
      key,
      name: humanizeLabel(base),
      note: null,
      evidence: s.evidence_quote ?? null,
    })
  }
  // Fold in profile objections — attach notes, or add ones the signals missed.
  for (const obj of objections) {
    const key = normalizeKey(obj.key)
    const match = findMatch(key)
    if (match) {
      if (obj.note && !match.note) match.note = obj.note
      continue
    }
    items.push({
      id: `obj-${obj.key}`,
      key,
      name: humanizeLabel(obj.key),
      note: obj.note ?? null,
      evidence: null,
    })
  }
  return items
}

// ── Layer section ─────────────────────────────────────────────────────────────

interface LayerSectionProps {
  heading: string
  chips: Signal[]
  expandedIds: Set<string>
  onToggle: (id: string) => void
  children?: React.ReactNode
}

function LayerSection({ heading, chips, expandedIds, onToggle, children }: LayerSectionProps) {
  if (chips.length === 0 && !children) return null
  return (
    <section className="profile-panel__layer">
      <h3 className="profile-panel__layer-label">{heading}</h3>
      {chips.length > 0 && (
        <div className="profile-panel__chips">
          {chips.map((signal) => (
            <SignalChip
              key={signal.id}
              signal={signal}
              expanded={expandedIds.has(signal.id)}
              onToggle={() => onToggle(signal.id)}
            />
          ))}
        </div>
      )}
      {children}
    </section>
  )
}

// ── ProfilePanel ─────────────────────────────────────────────────────────────

/** Stub — Step 3 replaces the body without changing the exported props type. */
export function ProfilePanel({ profile, signals, quote }: ProfilePanelProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  // cancelledRef tracks whether the user has interacted — if so, auto-demo won't run.
  const cancelledRef = useRef(false)

  // ── Auto-demo: expand first 2 negotiation chips with evidence ──────────────
  // On mount, stagger-expand chips at 600ms / 900ms so the feature self-demonstrates.
  // Cancel silently once cancelledRef.current is true (any toggle call sets it).
  useEffect(() => {
    const negoWithEvidence = signals.filter(
      (s) => s.layer === 'negotiation' && s.evidence_quote,
    )
    if (negoWithEvidence.length === 0) return

    const demoIds = negoWithEvidence.slice(0, 2).map((s) => s.id)
    const timers: ReturnType<typeof setTimeout>[] = []

    timers.push(
      setTimeout(() => {
        if (!cancelledRef.current) {
          setExpandedIds((prev) => new Set([...prev, demoIds[0]]))
        }
      }, 600),
    )

    if (demoIds[1]) {
      timers.push(
        setTimeout(() => {
          if (!cancelledRef.current) {
            setExpandedIds((prev) => new Set([...prev, demoIds[1]]))
          }
        }, 900),
      )
    }

    // Collapse all ~3 s after the last possible auto-expand
    timers.push(
      setTimeout(() => {
        if (!cancelledRef.current) {
          setExpandedIds(new Set())
        }
      }, 3900),
    )

    return () => timers.forEach(clearTimeout)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Toggle a chip and cancel any pending auto-demo
  function toggle(id: string) {
    cancelledRef.current = true
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ── Null / empty state ────────────────────────────────────────────────────
  if (!profile) {
    return (
      <div className="profile-panel profile-panel--empty" data-slot="profile-panel">
        <p className="profile-panel__empty-title">No profile yet</p>
        <p className="profile-panel__empty-hint">
          Log an interaction to run ANALYZE and surface motivation, objections, and buying signals.
        </p>
      </div>
    )
  }

  const layers = groupByLayer(signals)
  // The motivation badge doubles as its own evidence: the first motivation signal
  // that has a quote makes the badge expandable, so we don't render a twin chip.
  const motivationSignal =
    signals.find((s) => s.layer === 'motivation' && Boolean(s.evidence_quote)) ?? null
  const motivationConf = confidencePct(profile.motivation_conf)
  const mergedObjections = mergeObjections(profile.objections, layers.objection)

  return (
    <div className="profile-panel" data-slot="profile-panel">
      {/* ── Summary ─────────────────────────────────────────────────────── */}
      {profile.summary && (
        <p className="profile-panel__summary">{profile.summary}</p>
      )}

      {/* ── Motivation — one badge, expandable to the quote behind it ────── */}
      {profile.motivation && (
        <section className="profile-panel__layer">
          <h3 className="profile-panel__layer-label">Motivation</h3>
          <p className="profile-panel__motivation">
            {motivationSignal ? (
              <button
                type="button"
                className="profile-panel__motivation-value profile-panel__motivation-value--button"
                aria-expanded={expandedIds.has(motivationSignal.id)}
                onClick={() => toggle(motivationSignal.id)}
              >
                {motivationLabel(profile.motivation)}
                <span className="signal-chip__cue" aria-hidden="true">”</span>
              </button>
            ) : (
              <span className="profile-panel__motivation-value">
                {motivationLabel(profile.motivation)}
              </span>
            )}
            {motivationConf && <span className="profile-panel__conf">{motivationConf}</span>}
          </p>
          {motivationSignal && expandedIds.has(motivationSignal.id) && (
            <blockquote className="signal-chip__quote profile-panel__evidence">
              {motivationSignal.evidence_quote}
            </blockquote>
          )}
        </section>
      )}

      {/* ── Negotiation ─────────────────────────────────────────────────── */}
      <LayerSection
        heading="Negotiation"
        chips={layers.negotiation}
        expandedIds={expandedIds}
        onToggle={toggle}
      />

      {/* ── Objections — one merged list: note for context, quote on expand ─ */}
      {mergedObjections.length > 0 && (
        <section className="profile-panel__layer">
          <h3 className="profile-panel__layer-label">Objections</h3>
          <ul className="profile-panel__objection-list">
            {mergedObjections.map((obj) => {
              const hasEvidence = Boolean(obj.evidence)
              const isExpanded = expandedIds.has(obj.id)
              return (
                <li key={obj.id} className="profile-panel__objection">
                  <div className="profile-panel__objection-head">
                    {hasEvidence ? (
                      <button
                        type="button"
                        className="profile-panel__objection-row"
                        aria-expanded={isExpanded}
                        onClick={() => toggle(obj.id)}
                      >
                        <span className="profile-panel__objection-key">{obj.name}</span>
                        <span className="signal-chip__cue" aria-hidden="true">”</span>
                      </button>
                    ) : (
                      <span className="profile-panel__objection-key">{obj.name}</span>
                    )}
                    {obj.note && (
                      <span className="profile-panel__objection-note"> — {obj.note}</span>
                    )}
                  </div>
                  {hasEvidence && isExpanded && (
                    <blockquote className="signal-chip__quote profile-panel__evidence">
                      {obj.evidence}
                    </blockquote>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* ── Buying signals ──────────────────────────────────────────────── */}
      <LayerSection
        heading="Buying Signals"
        chips={layers.buying_signal}
        expandedIds={expandedIds}
        onToggle={toggle}
      />

      {/* ── Completeness ────────────────────────────────────────────────── */}
      <div className="profile-panel__completeness">
        <div className="profile-panel__completeness-head">
          <span className="profile-panel__completeness-label">Profile completeness</span>
          <span className="profile-panel__completeness-pct">{profile.completeness}%</span>
        </div>
        <div
          className="profile-panel__completeness-bar"
          style={{ '--fill': `${profile.completeness}%` } as React.CSSProperties}
          aria-label={`Profile ${profile.completeness}% complete`}
        />
      </div>

      {/* ── Quote summary ────────────────────────────────────────────────── */}
      {quote && (
        <div className="profile-panel__quote-summary">
          <span className="profile-panel__layer-label">Their quote</span>
          <div className="profile-panel__quote-stats">
            {quoteStats(quote).map((stat) => (
              <div key={stat.label} className="profile-panel__quote-stat">
                <span className="profile-panel__quote-stat-value">{stat.value}</span>
                <span className="profile-panel__quote-stat-label">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
