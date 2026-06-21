/**
 * CallNotesButton — auto note-taking (Phase 3). One click summarizes the
 * customer's latest call/visit transcript into structured notes for the rep.
 * Additive, isolated.
 */
import { useState } from 'react'
import { generateCallNotes } from '../../api/client'
import type { CallNotes } from '../../api/types'
import './CallNotesButton.css'

function NoteList({ label, items }: { label: string; items: string[] }) {
  if (!items?.length) return null
  return (
    <div className="cnotes__group">
      <span className="cnotes__label mono">{label}</span>
      <ul className="cnotes__ul">
        {items.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  )
}

export function CallNotesButton({ customerId }: { customerId: string }) {
  const [loading, setLoading] = useState(false)
  const [notes, setNotes] = useState<CallNotes | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      setNotes(await generateCallNotes(customerId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate notes')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="cnotes" data-slot="call-notes">
      <div className="cnotes__bar">
        <span className="cnotes__title mono">Call notes</span>
        <button className="cnotes__btn" onClick={run} disabled={loading}>
          {loading ? 'Summarizing…' : notes ? 'Refresh' : '📝 Generate notes'}
        </button>
      </div>
      {error && <p className="cnotes__err" role="alert">{error}</p>}
      {notes && (
        <div className="cnotes__body">
          <p className="cnotes__summary">{notes.summary}</p>
          <NoteList label="Key points" items={notes.key_points} />
          <NoteList label="Objections" items={notes.objections} />
          <NoteList label="Buying signals" items={notes.buying_signals} />
          <NoteList label="Next steps" items={notes.next_steps} />
        </div>
      )}
    </section>
  )
}
