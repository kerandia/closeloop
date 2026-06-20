/**
 * ComposeDrawer — Step 3 agents implement the body; do NOT change prop signatures.
 *
 * Prop contract:
 *   open  boolean
 *     Whether the drawer is visible. DetailShell controls this after approve.
 *
 *   message  Message | null
 *     The draft returned by approveRecommendation. null while the approve request
 *     is in flight (drawer is open but showing a loading skeleton inside).
 *     Once set, the body + optional subject are pre-filled and editable.
 *     L1: full draft arrives at once (no streaming).
 *     L2: token-by-token streaming via SSE (UI unchanged — just feed chars in).
 *
 *   onClose  () => void
 *     Rep closed the drawer without sending. DetailShell resets status to 'pending'
 *     so the card re-shows its buttons.
 *
 *   onSent  (interaction: Interaction) => void
 *     Called after POST /api/messages/:id/send succeeds with the new interaction
 *     returned by the backend. DetailShell prepends it to the timeline and shows
 *     a "Sent ✓" toast.
 */
import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import type { Message, Interaction } from '../../api/types'
import { patchMessage, sendMessage } from '../../api/client'
import './ComposeDrawer.css'

export interface ComposeDrawerProps {
  open: boolean
  message: Message | null
  onClose: () => void
  onSent: (interaction: Interaction) => void
}

export function ComposeDrawer({ open, message, onClose, onSent }: ComposeDrawerProps) {
  const [subject, setSubject] = useState<string>(message?.subject ?? '')
  const [body, setBody] = useState<string>(message?.body ?? '')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  // Track the last persisted value so blur only patches when something changed
  const savedSubjectRef = useRef<string>(message?.subject ?? '')
  const savedBodyRef = useRef<string>(message?.body ?? '')

  // Sync editable fields when the draft message arrives (null → Message)
  useEffect(() => {
    if (message) {
      const s = message.subject ?? ''
      const b = message.body
      setSubject(s)
      setBody(b)
      savedSubjectRef.current = s
      savedBodyRef.current = b
      setSendError(null)
    }
  }, [message])

  if (!open) return null

  async function handleBlurSubject() {
    if (!message || subject === savedSubjectRef.current) return
    savedSubjectRef.current = subject
    await patchMessage(message.id, { subject })
  }

  async function handleBlurBody() {
    if (!message || body === savedBodyRef.current) return
    savedBodyRef.current = body
    await patchMessage(message.id, { body })
  }

  async function handleSend() {
    if (!message) return
    setSending(true)
    setSendError(null)
    try {
      const response = await sendMessage(message.id)
      onSent(response.interaction)
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Failed to send')
      setSending(false)
    }
  }

  return (
    <>
      {/* Scrim — closes drawer on click */}
      <div className="compose-scrim" aria-hidden="true" onClick={onClose} />

      {/* Drawer panel slides in from right */}
      <motion.div
        className="compose-drawer"
        role="dialog"
        aria-label="Compose message"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <div className="compose-drawer__header">
          <span className="compose-drawer__title">Compose</span>
          <button
            className="compose-drawer__close"
            aria-label="Close compose drawer"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="compose-drawer__body">
          {message === null ? (
            // ── Composing / loading state ──────────────────────────────────
            <div className="compose-composing" data-testid="composing-state">
              <div className="compose-composing__dots">
                <span className="compose-composing__dot" />
                <span className="compose-composing__dot" />
                <span className="compose-composing__dot" />
              </div>
              <p className="compose-composing__label">Composing draft…</p>
            </div>
          ) : (
            // ── Editable draft ─────────────────────────────────────────────
            <div className="compose-editor">
              {message.channel === 'email' && (
                <div className="compose-field">
                  <label htmlFor="compose-subject" className="compose-field__label">
                    Subject
                  </label>
                  <input
                    id="compose-subject"
                    className="compose-field__input"
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    onBlur={handleBlurSubject}
                  />
                </div>
              )}

              <div className="compose-field">
                <label htmlFor="compose-body" className="compose-field__label">
                  Message
                </label>
                <textarea
                  id="compose-body"
                  className="compose-field__textarea"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onBlur={handleBlurBody}
                  rows={12}
                />
              </div>

              {sendError && (
                <div className="compose-error" role="alert">
                  <span className="compose-error__text">{sendError}</span>
                  <button className="compose-error__retry" onClick={handleSend}>
                    Retry
                  </button>
                </div>
              )}

              <div className="compose-actions">
                <button
                  className="compose-btn compose-btn--send"
                  onClick={handleSend}
                  disabled={sending}
                >
                  {sending ? 'Sending…' : 'Send'}
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </>
  )
}
