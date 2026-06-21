/**
 * ChatWindow — chat-thread component for messaging conversations.
 *
 * Props:
 *   customerId        string — customer ID for sending messages
 *   channel           'whatsapp' | 'sms' | 'telegram' — messaging channel
 *   interactions      Interaction[] — optional array of past interactions
 *
 * Renders:
 *   - Interaction bubbles filtered to the specified channel
 *     - inbound (left), outbound (right)
 *   - LIVE suggestion block (Read + reply lines + Send buttons)
 *     - subscribes to live suggestions
 *     - renders lines with Send buttons
 */
import { useState, useEffect, useCallback } from 'react'
import {
  listCopilotSuggestions,
  subscribeCopilot,
  messagingSend,
} from '../../api/client'
import type { Interaction, CopilotSuggestion } from '../../api/types'
import './ChatWindow.css'
import './CopilotPanel.css'

export interface ChatWindowProps {
  customerId: string
  channel: 'whatsapp' | 'sms' | 'telegram'
  interactions?: Interaction[]
}

export function ChatWindow({ customerId, channel, interactions = [] }: ChatWindowProps) {
  const [live, setLive] = useState<CopilotSuggestion | null>(null)
  const [sendingLine, setSendingLine] = useState<string | null>(null)
  const [sentNote, setSentNote] = useState<string | null>(null)

  // Load initial live suggestions and subscribe to updates
  useEffect(() => {
    let active = true
    listCopilotSuggestions(customerId)
      .then((rows) => {
        if (active && rows.length) {
          const matching = rows.find(r => r.channel === channel)
          setLive(matching || rows[0])
        }
      })
      .catch(() => {})

    const unsub = subscribeCopilot(customerId, (e) => {
      if (e.type === 'suggestion' && e.suggestion && e.suggestion.channel === channel) {
        setLive(e.suggestion)
        setSentNote(null)
      }
    })

    return () => {
      active = false
      unsub()
    }
  }, [customerId, channel])

  const handleSendWhatsApp = useCallback(
    async (line: string) => {
      if (!live || sendingLine) return
      setSendingLine(line)
      try {
        const res = await messagingSend({
          customer_id: customerId,
          body: line,
          channel: live.channel,
          suggestion_id: live.id,
        })
        setLive({ ...live, status: 'sent' })
        const chLabel = live.channel === 'sms' ? 'SMS' : live.channel === 'telegram' ? 'Telegram' : 'WhatsApp'
        setSentNote(res.within_window ? `Sent on ${chLabel} ✓` : 'Sent (template) ✓')
      } catch (err) {
        setSentNote(err instanceof Error ? err.message : 'Send failed')
      } finally {
        setSendingLine(null)
      }
    },
    [live, sendingLine, customerId],
  )

  // Filter interactions to this channel
  const filteredInteractions = interactions.filter(i => i.channel === channel)

  // Channel label display
  const channelLabel = channel === 'sms' ? 'SMS' : channel === 'telegram' ? 'Telegram' : 'WhatsApp'

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

      {/* ── Live suggestion block ─────────────────────────────────────────── */}
      {live && (
        <div className="chat-window__live" data-testid="chat-window-live">
          {live.utterance && (
            <p className="copilot-live__msg">"{live.utterance}"</p>
          )}
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
                  onClick={() => handleSendWhatsApp(line)}
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
    </section>
  )
}
