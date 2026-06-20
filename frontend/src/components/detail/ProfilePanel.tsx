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

function formatQuoteSummary(quote: Quote): string {
  const parts: string[] = []
  if (quote.system_size_kwp != null) parts.push(`${quote.system_size_kwp} kWp`)
  if (quote.price_eur != null) parts.push(`€${quote.price_eur.toLocaleString('de-DE')}`)
  if (quote.payback_years != null) parts.push(`${quote.payback_years}yr payback`)
  return parts.join(' · ')
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
      <h3 className="mono profile-panel__layer-label">{heading}</h3>
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
        <p className="mono">No profile yet</p>
        <p className="profile-panel__empty-hint">
          Log an interaction to run ANALYZE and surface motivation, objections, and buying signals.
        </p>
      </div>
    )
  }

  const layers = groupByLayer(signals)

  return (
    <div className="profile-panel" data-slot="profile-panel">
      {/* ── Summary ─────────────────────────────────────────────────────── */}
      {profile.summary && (
        <p className="profile-panel__summary">{profile.summary}</p>
      )}

      {/* ── Motivation ──────────────────────────────────────────────────── */}
      <LayerSection
        heading="Motivation"
        chips={layers.motivation}
        expandedIds={expandedIds}
        onToggle={toggle}
      >
        {profile.motivation && (
          <p className="profile-panel__motivation">
            {profile.motivation}
            {profile.motivation_conf != null && (
              <span className="profile-panel__conf"> ({profile.motivation_conf})</span>
            )}
          </p>
        )}
      </LayerSection>

      {/* ── Negotiation ─────────────────────────────────────────────────── */}
      <LayerSection
        heading="Negotiation"
        chips={layers.negotiation}
        expandedIds={expandedIds}
        onToggle={toggle}
      />

      {/* ── Objections ──────────────────────────────────────────────────── */}
      <LayerSection
        heading="Objections"
        chips={layers.objection}
        expandedIds={expandedIds}
        onToggle={toggle}
      >
        {profile.objections.length > 0 && (
          <ul className="profile-panel__objection-list">
            {profile.objections.map((obj) => (
              <li key={obj.key} className="profile-panel__objection">
                <span className="mono">{obj.key}</span>
                {obj.note && <span className="profile-panel__objection-note"> — {obj.note}</span>}
              </li>
            ))}
          </ul>
        )}
      </LayerSection>

      {/* ── Buying signals ──────────────────────────────────────────────── */}
      <LayerSection
        heading="Buying Signals"
        chips={layers.buying_signal}
        expandedIds={expandedIds}
        onToggle={toggle}
      />

      {/* ── Completeness ────────────────────────────────────────────────── */}
      <div className="profile-panel__completeness">
        <div
          className="profile-panel__completeness-bar"
          style={{ '--fill': `${profile.completeness}%` } as React.CSSProperties}
          aria-label={`Profile ${profile.completeness}% complete`}
        />
        <span className="mono profile-panel__completeness-label">
          Profile {profile.completeness}% complete
        </span>
      </div>

      {/* ── Quote summary ────────────────────────────────────────────────── */}
      {quote && (
        <div className="profile-panel__quote-summary">
          <span className="mono profile-panel__layer-label">Quote</span>
          <p className="profile-panel__quote-line">{formatQuoteSummary(quote)}</p>
        </div>
      )}
    </div>
  )
}
