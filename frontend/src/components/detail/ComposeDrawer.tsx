/**
 * ComposeDrawer — Step 3 agents implement the body; do NOT change prop signatures.
 *
 * Prop contract:
 *   open  boolean
 *     Whether the drawer is visible. DetailShell controls this after approve.
 *
 *   message  Message | null
 *     The draft returned by approveRecommendation. null while the approve request
 *     is in flight (drawer is open but showing a loading skeleton inside).
 *     Once set, the body + optional subject are pre-filled and editable.
 *     L1: full draft arrives at once (no streaming).
 *     L2: token-by-token streaming via SSE (UI unchanged — just feed chars in).
 *
 *   onClose  () => void
 *     Rep closed the drawer without sending. DetailShell resets status to 'pending'
 *     so the card re-shows its buttons.
 *
 *   onSent  (interaction: Interaction) => void
 *     Called after POST /api/messages/:id/send succeeds with the new interaction
 *     returned by the backend. DetailShell prepends it to the timeline and shows
 *     a "Sent ✓" toast.
 */
import type { Message, Interaction } from '../../api/types'

export interface ComposeDrawerProps {
  open: boolean
  message: Message | null
  onClose: () => void
  onSent: (interaction: Interaction) => void
}

/** Stub — Step 3 replaces the body without changing the exported props type. */
export function ComposeDrawer({ open }: ComposeDrawerProps) {
  if (!open) return null
  return (
    <div className="detail-stub" data-slot="compose-drawer">
      <p className="mono">Compose Drawer</p>
    </div>
  )
}
