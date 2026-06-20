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
import type { Profile, Signal, Quote } from '../../api/types'

export interface ProfilePanelProps {
  profile: Profile | null
  signals: Signal[]
  quote: Quote | null
}

/** Stub — Step 3 replaces the body without changing the exported props type. */
export function ProfilePanel({ profile }: ProfilePanelProps) {
  return (
    <div className="detail-stub" data-slot="profile-panel">
      <p className="mono">Profile Panel</p>
      {profile && <p>{profile.summary}</p>}
    </div>
  )
}
