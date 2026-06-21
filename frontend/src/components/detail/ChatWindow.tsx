/**
 * ChatWindow — chat-thread component for messaging conversations.
 *
 * Renders, for the selected channel:
 *   - past interaction bubbles (inbound left / outbound right)
 *   - either:
 *       • a LIVE suggestion (reply) when the customer has messaged in, or
 *       • the AI's PROACTIVE recommended opener (composed for this channel) when
 *         there's no inbound yet — so the rep can start the conversation.
 *   Both render with Send buttons (messagingSend on the current channel).
 */
import { useState, useEffect, useCallback } from 'react'
import {
  listCopilotSuggestions,
  subscribeCopilot,
  messagingSend,
  composeDraft,
} from '../../api/client'
import type { Interaction, CopilotSuggestion, MessagingDraft } from '../../api/types'
import './ChatWindow.css'
import './CopilotPanel.css'

export interface ChatWindowProps {
  customerId: string
  channel: 'whatsapp' | 'sms' | 'telegram'
  interactions?: Interaction[]
}

export function ChatWindow({ customerId, channel, interactions = [] }: ChatWindowProps) {
  const [live, setLive] = useState<CopilotSuggestion | null>(null) // inbound-driven reply
  const [draft, setDraft] = useState<MessagingDraft | null>(null) // proactive opener
  const [sendingLine, setSendingLine] = useState<string | null>(null)
  const [sentNote, setSentNote] = useState<string | null>(null)
  const [draftSent, setDraftSent] = useState(false)

  useEffect(() => {
    let active = true
    // Reset per-channel state so a prior channel can't linger.
    setLive(null); setDraft(null); setSentNote(null); setSendingLine(null); setDraftSent(false)

    listCopilotSuggestions(customerId)
      .then((rows) => {
        if (!active) return
        const matching = rows.find((r) => r.channel === channel)
        if (matching) {
          setLive(matching)
        } else {
          // No inbound suggestion for this channel → compose the AI's opener.
          composeDraft(customerId, channel)
            .then((d) => { if (active) setDraft(d) })
            .catch(() => {})
        }
      })
      .catch(() => {})

    const unsub = subscribeCopilot(customerId, (e) => {
      if (e.type === 'suggestion' && e.suggestion && e.suggestion.channel === channel) {
        setLive(e.suggestion)
        setDraft(null)
        setSentNote(null)
      }
    })

    return () => { active = false; unsub() }
  }, [customerId, channel])

  const channelLabel = channel === 'sms' ? 'SMS' : channel === 'telegram' ? 'Telegram' : 'WhatsApp'

  const handleSend = useCallback(
    async (line: string, suggestionId?: string) => {
      if (sendingLine) return
      setSendingLine(line)
      try {
        const res = await messagingSend({ customer_id: customerId, body: line, channel, suggestion_id: suggestionId })
        if (suggestionId) setLive((s) => (s ? { ...s, status: 'sent' } : s))
        else setDraftSent(true)
        setSentNote(res.within_window ? `Sent on ${channelLabel} ✓` : 'Sent (template) ✓')
      } catch (err) {
        setSentNote(err instanceof Error ? err.message : 'Send failed')
      } finally {
        setSendingLine(null)
      }
    },
    [sendingLine, customerId, channel, channelLabel],
  )

  const filteredInteractions = interactions.filter((i) => i.channel === channel)

  return (
    <section className="chat-window" data-slot="chat-window">
      <div className="chat-window__header">
        <h2 className="chat-window__title">{channelLabel}</h2>
      </div>

      <div className="chat-window__bubbles">
        {filteredInteractions.map((interaction) => (
          <div
            key={interaction.id}
            className={`chat-bubble ${interaction.direction === 'inbound' ? 'chat-bubble--inbound' : 'chat-bubble--outbound'}`}
            data-testid={`chat-bubble-${interaction.id}`}
          >
            <p className="chat-bubble__text">{interaction.content || interaction.transcript_md}</p>
          </div>
        ))}
      </div>

      {/* ── Inbound-driven suggestion (reply to what the customer said) ──────── */}
      {live && (
        <div className="chat-window__live" data-testid="chat-window-live">
          {live.utterance && <p className="copilot-live__msg">"{live.utterance}"</p>}
          <div className="copilot-read">
            <span className="copilot-read__label mono">Read</span>
            <p className="copilot-read__text">{live.read}</p>
          </div>
          <div className="copilot-lines">
            <span className="copilot-lines__label mono">Reply</span>
            {live.exact_lines.map((line, i) => (
              <div key={i} className="copilot-line">
                <span className="copilot-line__text">{line}</span>
                <button
                  type="button"
                  className="copilot-line__send"
                  disabled={live.status === 'sent' || sendingLine !== null}
                  onClick={() => handleSend(line, live.id)}
                  data-testid={`send-button-${i}`}
                >
                  {sendingLine === line ? 'Sending…' : 'Send'}
                </button>
              </div>
            ))}
          </div>
          {sentNote && <p className="copilot-live__sent" role="status">{sentNote}</p>}
        </div>
      )}

      {/* ── Proactive opener (AI recommendation) when there's no inbound yet ─── */}
      {!live && draft && (
        <div className="chat-window__live" data-testid="chat-window-draft">
          <div className="copilot-live__bar">
            <span className="copilot-live__label mono">Recommended by AI</span>
          </div>
          {draft.why && (
            <div className="copilot-read">
              <span className="copilot-read__label mono">Why now</span>
              <p className="copilot-read__text">{draft.why}</p>
            </div>
          )}
          <div className="copilot-lines">
            <span className="copilot-lines__label mono">Suggested first message</span>
            {draft.exact_lines.map((line, i) => (
              <div key={i} className="copilot-line">
                <span className="copilot-line__text">{line}</span>
                <button
                  type="button"
                  className="copilot-line__send"
                  disabled={draftSent || sendingLine !== null}
                  onClick={() => handleSend(line)}
                  data-testid={`draft-send-button-${i}`}
                >
                  {sendingLine === line ? 'Sending…' : 'Send'}
                </button>
              </div>
            ))}
          </div>
          {sentNote && <p className="copilot-live__sent" role="status">{sentNote}</p>}
        </div>
      )}
    </section>
  )
}
