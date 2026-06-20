/**
 * InteractionTimeline — Step 3 agents implement the body; do NOT change prop signatures.
 *
 * Prop contract:
 *   interactions  Interaction[]
 *     Reverse-chronological list of all interactions (initial load + any logged
 *     during this session, prepended by DetailShell after logInteraction resolves).
 *     Each interaction has:
 *       interaction.channel        — icon to display (ChannelIcon component)
 *       interaction.occurred_at    — ISO timestamp for relativeTime()
 *       interaction.outcome        — one-liner shown in collapsed view
 *       interaction.transcript_md  — expandable, rendered as markdown
 *       interaction.rep_gut_feel   — rep's free-text note
 *
 *   onLogInteraction  (payload: InteractionCreate) => Promise<void>
 *     Called by the LogNote form when the rep logs a visit/call/note.
 *     DetailShell handles the API call and the analyze→reveal orchestration;
 *     this panel just fires the payload and awaits resolution (can show local
 *     loading state while waiting). The new interaction will be prepended to
 *     the `interactions` prop by DetailShell once the response lands.
 *     Payload shape (InteractionCreate):
 *       channel        Channel
 *       direction?     'inbound' | 'outbound' (defaults to 'inbound')
 *       content?       string | null       — free-text note / summary
 *       rep_gut_feel?  string | null       — gut-feel field
 *       outcome?       string | null
 *       transcript_md? string | null
 *       rep_id?        string | null
 */
import type { Interaction, InteractionCreate } from '../../api/types'

export interface InteractionTimelineProps {
  interactions: Interaction[]
  onLogInteraction: (payload: InteractionCreate) => Promise<void>
}

/** Stub — Step 3 replaces the body without changing the exported props type. */
export function InteractionTimeline({ interactions, onLogInteraction }: InteractionTimelineProps) {
  return (
    <div className="detail-stub" data-slot="interaction-timeline">
      <p className="mono">Interaction Timeline ({interactions.length})</p>
      {/* Test hook: triggers onLogInteraction with a minimal valid payload.
          Step 3 replaces this with the real LogNote form. */}
      <button
        data-testid="stub-log-interaction"
        className="mono"
        onClick={() =>
          onLogInteraction({
            channel: 'phone',
            direction: 'inbound',
            content: 'Stub log note',
            outcome: 'test',
          })
        }
      >
        + Log interaction (stub)
      </button>
    </div>
  )
}
