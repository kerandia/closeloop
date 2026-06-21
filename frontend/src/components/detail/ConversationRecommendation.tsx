/**
 * ConversationRecommendation — right column of the channel workspace.
 *
 * DEMO ONLY. Hardcoded per-channel: an objection "read", then EITHER a suggested
 * reply (insertable into the middle column via "Use this reply") OR a list of
 * live talking points (for calls / visits, where there's nothing to type into).
 * Always closes with a muted "Why this" rationale.
 */
import './ConversationRecommendation.css'

interface Props {
  read: string
  why: string
  /** A draft message — rendered with a "Use this …" button. */
  reply?: string
  /** Live talking points — rendered as a list (no insert action). */
  lines?: string[]
  /** Insert handler for the reply. Omit to hide the button. */
  onUse?: (text: string) => void
  useLabel?: string
}

export function ConversationRecommendation({ read, why, reply, lines, onUse, useLabel }: Props) {
  return (
    <section className="conv-rec" data-slot="conversation-recommendation">
      {/* ── Objection read ─────────────────────────────────────────────────── */}
      <div className="conv-rec__read">
        <span className="conv-rec__read-label">Objection read</span>
        <span className="conv-rec__read-value">{read}</span>
      </div>

      {/* ── Card: a reply to send, or talking points for a live channel ─────── */}
      <div className="conv-rec__card">
        {reply != null ? (
          <>
            <span className="conv-rec__card-label">{useLabel ? 'Suggested draft' : 'Suggested reply'}</span>
            <p className="conv-rec__reply">{reply}</p>
          </>
        ) : (
          <>
            <span className="conv-rec__card-label">Talking points</span>
            <ul className="conv-rec__lines">
              {(lines ?? []).map((line, i) => (
                <li key={i} className="conv-rec__line">{line}</li>
              ))}
            </ul>
          </>
        )}

        <p className="conv-rec__why">
          <span className="conv-rec__why-label">Why this — </span>
          {why}
        </p>

        {reply != null && onUse && (
          <button type="button" className="conv-rec__use" onClick={() => onUse(reply)}>
            {useLabel ?? 'Use this reply'}
          </button>
        )}
      </div>
    </section>
  )
}
