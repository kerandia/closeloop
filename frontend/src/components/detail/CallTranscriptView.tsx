import './CallTranscriptView.css'

// SDK-free types for voice agent call transcripts
export interface CollectedSummary {
  motivation?: string | null
  timeline?: string | null
  hesitations?: string[]
  callback?: string | null
}

interface TranscriptTurn {
  role: string
  text: string
}

interface CallTranscriptViewProps {
  transcriptMd?: string | null
  mode: 'voice_ai' | 'phone'
  collected?: CollectedSummary | null
  liveTurns?: TranscriptTurn[] | null
}

// Role → safe CSS class slug (alphanumeric + single hyphens), e.g.
// "Agent (Voice AI)" → "agent-voice-ai".
function slugifyRole(role: string): string {
  return role.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function parseTranscriptMd(transcriptMd: string | null | undefined): TranscriptTurn[] {
  if (!transcriptMd) return []

  const turns: TranscriptTurn[] = []
  const lines = transcriptMd.split('\n\n') // markdown uses double newline for paragraph breaks

  for (const line of lines) {
    const match = line.match(/^\*\*([^:]+):\*\*\s*(.+)$/s)
    if (match) {
      const [, role, text] = match
      turns.push({ role: role.trim(), text: text.trim() })
    }
  }

  return turns
}

export function CallTranscriptView({ transcriptMd, mode, collected, liveTurns }: CallTranscriptViewProps) {
  const turns = liveTurns || parseTranscriptMd(transcriptMd)

  if (!turns.length && !collected && !liveTurns) {
    return <div className="transcript-view transcript-view--empty">No transcript or summary available.</div>
  }

  return (
    <div className="transcript-view">
      {turns.length > 0 && (
        <div className="transcript-view__turns">
          {turns.map((turn, idx) => (
            <div
              key={idx}
              className={`transcript-turn transcript-turn--${slugifyRole(turn.role)}`}
            >
              <div className="transcript-turn__role">{turn.role}</div>
              <div className="transcript-turn__text">{turn.text}</div>
            </div>
          ))}
        </div>
      )}

      {mode === 'voice_ai' && collected && (
        <div className="transcript-view__collected">
          <div className="collected-summary">
            <h4 className="collected-summary__title">Collected Summary</h4>

            {collected.motivation && (
              <div className="collected-summary__field">
                <span className="collected-summary__label">Motivation</span>
                <div className="collected-summary__value">{collected.motivation}</div>
              </div>
            )}

            {collected.timeline && (
              <div className="collected-summary__field">
                <span className="collected-summary__label">Timeline</span>
                <div className="collected-summary__value">{collected.timeline}</div>
              </div>
            )}

            {collected.hesitations && collected.hesitations.length > 0 && (
              <div className="collected-summary__field">
                <span className="collected-summary__label">Hesitations</span>
                <ul className="collected-summary__list">
                  {collected.hesitations.map((h, idx) => (
                    <li key={idx} className="collected-summary__item">{h}</li>
                  ))}
                </ul>
              </div>
            )}

            {collected.callback && (
              <div className="collected-summary__field">
                <span className="collected-summary__label">Callback</span>
                <div className="collected-summary__value">{collected.callback}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

