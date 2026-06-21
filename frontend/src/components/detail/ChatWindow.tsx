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
    // Reset per-channel state so a prior channel's suggestion can't linger.
    setLive(null)
    setSentNote(null)
    setSendingLine(null)
    listCopilotSuggestions(customerId)
      .then((rows) => {
        // Only surface a suggestion for THIS channel — never fall back to a
        // different channel's suggestion (it would send on the wrong surface).
        const matching = rows.find((r) => r.channel === channel)
        if (active && matching) setLive(matching)
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

  // Channel label display
  const channelLabel = channel === 'sms' ? 'SMS' : channel === 'telegram' ? 'Telegram' : 'WhatsApp'

  const handleSendMessage = useCallback(
    async (line: string) => {
      if (!live || sendingLine) return
      setSendingLine(line)
      try {
        // Always send on the currently selected surface, not live.channel.
        const res = await messagingSend({
          customer_id: customerId,
          body: line,
          channel,
          suggestion_id: live.id,
        })
        setLive({ ...live, status: 'sent' })
        setSentNote(res.within_window ? `Sent on ${channelLabel} ✓` : 'Sent (template) ✓')
      } catch (err) {
        setSentNote(err instanceof Error ? err.message : 'Send failed')
      } finally {
        setSendingLine(null)
      }
    },
    [live, sendingLine, customerId, channel, channelLabel],
  )

  // Filter interactions to this channel
  const filteredInteractions = interactions.filter(i => i.channel === channel)

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
                  onClick={() => handleSendMessage(line)}
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
