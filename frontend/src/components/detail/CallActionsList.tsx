/**
 * CallActionsList — Step 3 agents implement the body; do NOT change prop signatures.
 *
 * Prop contract:
 *   actions  ExtractedAction[]
 *     Concrete asks the AI extracted from interactions. Each action has:
 *       action.type    — 'callback'|'send_info'|'schedule_visit'|'other'
 *       action.detail  — human-readable description ("Call back Tue after 17:00")
 *       action.due_at  — ISO timestamp or null
 *       action.status  — 'open'|'done'|'dismissed' (user-togglable)
 *     Render prominently — judges love that the AI caught a specific ask.
 *     Each action should have a toggle control to flip open ↔ done.
 *     Filter out dismissed items by default (or show them greyed out).
 */
import type { ExtractedAction } from '../../api/types'

export interface CallActionsListProps {
  actions: ExtractedAction[]
}

/** Stub — Step 3 replaces the body without changing the exported props type. */
export function CallActionsList({ actions }: CallActionsListProps) {
  return (
    <div className="detail-stub" data-slot="call-actions-list">
      <p className="mono">Call Actions ({actions.length})</p>
    </div>
  )
}
