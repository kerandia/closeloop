/**
 * RecommendationCard — Step 3 agents implement the body; do NOT change prop signatures.
 *
 * Prop contract:
 *   recommendation  Recommendation | null
 *     The current active recommendation. null while re-analyzing (right column shows
 *     the analyzing overlay instead of this card).
 *
 *   customer  Customer
 *     Full customer record. Used for channel-specific executor logic:
 *     channel === 'visit' is always rep-executed (the AI can't knock on a door).
 *     Also drives the "who makes the next touch" executor control.
 *
 *   onApprove  (recId: string) => void
 *     Rep clicked "Approve & Compose". DetailShell calls approveRecommendation,
 *     receives the Message draft, opens ComposeDrawer, and updates `status`.
 *     The card just fires the event — it never awaits the API call itself.
 *
 *   onDismiss  (recId: string) => void
 *     Rep dismissed the recommendation. DetailShell calls dismissRecommendation
 *     and clears the card.
 *
 *   status  RecStatus | null
 *     Externally controlled lifecycle state that DetailShell drives:
 *       'pending'    → show [Approve & Compose] + [Dismiss]
 *       'approved'   → card locked, drawer opening
 *       'composing'  → loading inside drawer
 *       'ready'      → editable draft visible in drawer
 *       'sent'       → show "Sent ✓" banner on card
 *       'dismissed'  → card hidden (DetailShell removes it)
 *       'superseded' → fade out, new card drops in
 *     Falls back to recommendation.status when null.
 */
import type { Recommendation, Customer, RecStatus } from '../../api/types'

export interface RecommendationCardProps {
  recommendation: Recommendation | null
  customer: Customer
  onApprove: (recId: string) => void
  onDismiss: (recId: string) => void
  /** Externally controlled status — overrides recommendation.status during transitions. */
  status: RecStatus | null
}

/** Stub — Step 3 replaces the body without changing the exported props type. */
export function RecommendationCard({ recommendation, status }: RecommendationCardProps) {
  if (!recommendation) return null
  const effectiveStatus = status ?? recommendation.status
  return (
    <div className="detail-stub" data-slot="recommendation-card">
      <p className="mono">Recommendation Card</p>
      <p className="detail-stub__rationale">{recommendation.rationale}</p>
      <p className="mono">status: {effectiveStatus}</p>
    </div>
  )
}
