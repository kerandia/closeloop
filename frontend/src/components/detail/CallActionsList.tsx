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
import { useState } from 'react'
import type { ExtractedAction, ActionStatus } from '../../api/types'
import { relativeTime } from '../../lib/format'
import './CallActionsList.css'

export interface CallActionsListProps {
  actions: ExtractedAction[]
}

/** Render each extracted action with detail, due date, and open/done toggle. */
export function CallActionsList({ actions }: CallActionsListProps) {
  // Local status overrides for toggling open ↔ done (no API call needed)
  const [localStatus, setLocalStatus] = useState<Record<string, ActionStatus>>({})

  // Filter to non-dismissed actions (they exist but aren't prominent)
  const visible = actions.filter((a) => a.status !== 'dismissed')

  if (visible.length === 0) {
    return null
  }

  return (
    <div className="call-actions-list">
      <h3 className="call-actions-list__title mono">Actions</h3>
      <div className="call-actions-list__rows">
        {visible.map((action) => {
          const currentStatus = localStatus[action.id] ?? action.status
          const isOpen = currentStatus === 'open'

          return (
            <div key={action.id} className="call-action-row" data-testid="call-action-row">
              <div className="call-action-row__content">
                <p className="call-action-row__detail">{action.detail}</p>
                <p className="call-action-row__meta">
                  <span className="call-action-row__due">
                    Due: {relativeTime(action.due_at)}
                  </span>
                </p>
              </div>
              <button
                className={`call-action-row__toggle ${isOpen ? 'call-action-row__toggle--open' : 'call-action-row__toggle--done'}`}
                onClick={() => {
                  setLocalStatus((prev) => ({
                    ...prev,
                    [action.id]: isOpen ? 'done' : 'open',
                  }))
                }}
                aria-label={`Toggle action: ${currentStatus === 'open' ? 'mark done' : 'reopen'}`}
              >
                {currentStatus}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
