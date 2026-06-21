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
import { useState } from 'react'
import type { Interaction, InteractionCreate } from '../../api/types'
import { ChannelIcon } from '../ChannelIcon'
import { relativeTime } from '../../lib/format'
import './InteractionTimeline.css'

export interface InteractionTimelineProps {
  interactions: Interaction[]
  onLogInteraction: (payload: InteractionCreate) => Promise<void>
}

function LogNoteForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (payload: InteractionCreate) => Promise<void>
  onCancel: () => void
}) {
  const [content, setContent] = useState('')
  const [repGutFeel, setRepGutFeel] = useState('')
  const [outcome, setOutcome] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        channel: 'visit',
        direction: 'outbound',
        content: content || null,
        rep_gut_feel: repGutFeel || null,
        outcome: outcome || null,
      })
      // Form closes when parent receives the response
      onCancel()
    } catch {
      // Keep the form open with the typed note intact so the rep can retry
      setError('Could not log that — try again')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="log-note-form" onSubmit={handleSubmit}>
      <textarea
        placeholder="Note / summary"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="log-note-form__input"
        disabled={isSubmitting}
      />
      <textarea
        placeholder="Gut feel"
        value={repGutFeel}
        onChange={(e) => setRepGutFeel(e.target.value)}
        className="log-note-form__input"
        disabled={isSubmitting}
      />
      <textarea
        placeholder="Outcome"
        value={outcome}
        onChange={(e) => setOutcome(e.target.value)}
        className="log-note-form__input"
        disabled={isSubmitting}
      />
      {error && (
        <p className="log-note-form__error" role="alert">
          {error}
        </p>
      )}
      <div className="log-note-form__actions">
        <button
          type="submit"
          className="log-note-form__submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Logging...' : 'Log'}
        </button>
        <button
          type="button"
          className="log-note-form__cancel"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

/** Render reverse-chronological interactions with expandable transcripts and log form. */
export function InteractionTimeline({
  interactions,
  onLogInteraction,
}: InteractionTimelineProps) {
  const [showLogForm, setShowLogForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [isLogging, setIsLogging] = useState(false)

  // Already sorted newest-first by the caller, but be robust
  const sorted = [...interactions].sort(
    (a, b) =>
      new Date(b.occurred_at || 0).getTime() -
      new Date(a.occurred_at || 0).getTime(),
  )

  const handleLogInteraction = async (payload: InteractionCreate) => {
    setIsLogging(true)
    try {
      await onLogInteraction(payload)
      setShowLogForm(false)
    } finally {
      setIsLogging(false)
    }
  }

  return (
    <div className="interaction-timeline">
      <h3 className="interaction-timeline__title mono">Interactions</h3>

      <div className="interaction-timeline__rows">
        {sorted.map((interaction) => {
          const isExpanded = expandedId === interaction.id
          const hasTranscript = !!interaction.transcript_md

          return (
            <div
              key={interaction.id}
              className={`interaction-row ${hasTranscript ? 'interaction-row--expandable' : ''}`}
              data-testid="interaction-row"
              role={hasTranscript ? 'button' : undefined}
              tabIndex={hasTranscript ? 0 : undefined}
              aria-expanded={hasTranscript ? isExpanded : undefined}
              onClick={() => {
                if (hasTranscript) {
                  setExpandedId(isExpanded ? null : interaction.id)
                }
              }}
              onKeyDown={(e) => {
                if (hasTranscript && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault()
                  setExpandedId(isExpanded ? null : interaction.id)
                }
              }}
            >
              <div className="interaction-row__header">
                <span className="interaction-row__icon">
                  <ChannelIcon channel={interaction.channel} size={16} />
                </span>
                <span className="interaction-row__time">
                  {relativeTime(interaction.occurred_at)}
                </span>
                <span className="interaction-row__outcome">
                  {interaction.outcome || '(no outcome recorded)'}
                </span>
                {hasTranscript && (
                  <span className="interaction-row__expand-indicator">
                    {isExpanded ? '▼' : '▶'}
                  </span>
                )}
              </div>

              {isExpanded && hasTranscript && (
                <div className="interaction-row__transcript">
                  <pre className="interaction-row__transcript-content">
                    {interaction.transcript_md}
                  </pre>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="interaction-timeline__log-section">
        {!showLogForm ? (
          <button
            className="interaction-timeline__log-button mono"
            onClick={() => setShowLogForm(true)}
            disabled={isLogging}
          >
            + Log visit / note
          </button>
        ) : (
          <LogNoteForm
            onSubmit={handleLogInteraction}
            onCancel={() => setShowLogForm(false)}
          />
        )}
      </div>
    </div>
  )
}
