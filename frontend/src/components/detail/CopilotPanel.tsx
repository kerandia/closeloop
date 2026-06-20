/**
 * CopilotPanel — live RESPOND co-pilot + COLLECT (spec §E).
 *
 * Prop contract:
 *   customerId  string
 *     Passed as customer_id to copilotRespond() and as the id to copilotCollect().
 *
 * Respond sub-panel
 *   Input: "What did the customer just say?" → Submit
 *   Calls copilotRespond({ customer_id, utterance }).
 *   3-phase cinematic reveal of RespondOutput:
 *     1. READ   — read text fades in immediately.
 *     2. LINES  — exact_lines[] slide in one at a time, ~250 ms stagger.
 *                 Each line has a copy button (→ navigator.clipboard.writeText).
 *                 Solar left-border marks the "script to speak" block.
 *     3. WHY    — why fades in last.
 *
 * Collect sub-panel
 *   "Suggest next question" → copilotCollect(customerId) → shows question.
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import {
  copilotRespond,
  copilotCollect,
  listCopilotSuggestions,
  subscribeCopilot,
  messagingSend,
} from '../../api/client'
import type { RespondOutput, CopilotSuggestion } from '../../api/types'
import './CopilotPanel.css'

export interface CopilotPanelProps {
  customerId: string
}

type Phase = 'idle' | 'loading' | 'reading' | 'lines' | 'complete'

export function CopilotPanel({ customerId }: CopilotPanelProps) {
  const [utterance, setUtterance] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<RespondOutput | null>(null)
  const [visibleLines, setVisibleLines] = useState(0)
  const [showWhy, setShowWhy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [collectQuestion, setCollectQuestion] = useState<string | null>(null)
  const [collectLoading, setCollectLoading] = useState(false)
  const [collectError, setCollectError] = useState<string | null>(null)

  // ── Live WhatsApp co-pilot ────────────────────────────────────────────────
  const [live, setLive] = useState<CopilotSuggestion | null>(null)
  const [liveIsNew, setLiveIsNew] = useState(false)
  const [sendingLine, setSendingLine] = useState<string | null>(null)
  const [sentNote, setSentNote] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    listCopilotSuggestions(customerId)
      .then((rows) => {
        if (active && rows.length) setLive(rows[0])
      })
      .catch(() => {})
    const unsub = subscribeCopilot(customerId, (e) => {
      if (e.type === 'suggestion' && e.suggestion) {
        setLive(e.suggestion)
        setLiveIsNew(true)
        setSentNote(null)
      }
    })
    return () => {
      active = false
      unsub()
    }
  }, [customerId])

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
        const ch = live.channel === 'sms' ? 'SMS' : 'WhatsApp'
        setSentNote(res.within_window ? `Sent on ${ch} ✓` : 'Sent (template) ✓')
      } catch (err) {
        setSentNote(err instanceof Error ? err.message : 'Send failed')
      } finally {
        setSendingLine(null)
      }
    },
    [live, sendingLine, customerId],
  )

  // Track pending reveal timers so we can cancel them on re-submit or unmount.
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    return () => { timersRef.current.forEach(clearTimeout) }
  }, [])

  function cancelTimers() {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
  }

  /** Drive the read → lines → why reveal after the API responds. */
  function scheduleReveal(data: RespondOutput) {
    cancelTimers()
    setResult(data)
    setVisibleLines(0)
    setShowWhy(false)
    setPhase('reading') // READ is visible immediately (CSS fade-in)

    // After the read phase (~1.2 s), begin staggered line reveals.
    const t1 = setTimeout(() => {
      setPhase('lines')
      setVisibleLines(1)

      // Remaining lines: each 250 ms after the previous.
      data.exact_lines.slice(1).forEach((_, idx) => {
        const t = setTimeout(() => {
          setVisibleLines((v) => v + 1)
        }, (idx + 1) * 250)
        timersRef.current.push(t)
      })

      // WHY fades in after the last line (+350 ms buffer).
      const whyDelay = Math.max(data.exact_lines.length - 1, 0) * 250 + 350
      const t2 = setTimeout(() => {
        setShowWhy(true)
        setPhase('complete')
      }, whyDelay)
      timersRef.current.push(t2)
    }, 1200)

    timersRef.current.push(t1)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!utterance.trim() || phase === 'loading') return

    setPhase('loading')
    setError(null)
    cancelTimers()

    try {
      const data = await copilotRespond({ customer_id: customerId, utterance })
      scheduleReveal(data)
    } catch (err) {
      setPhase('idle')
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
    }
  }

  async function handleCollect() {
    if (collectLoading) return
    setCollectLoading(true)
    setCollectError(null)
    try {
      const { question } = await copilotCollect(customerId)
      setCollectQuestion(question)
    } catch (err) {
      setCollectError(err instanceof Error ? err.message : 'Could not fetch next question.')
    } finally {
      setCollectLoading(false)
    }
  }

  function handleCopy(line: string) {
    navigator.clipboard.writeText(line)
  }

  const isLoading = phase === 'loading'
  const hasResult = result !== null

  return (
    <section className="copilot-panel" data-slot="copilot-panel">
      <h2 className="copilot-panel__heading">Co-pilot</h2>

      {/* ── Live WhatsApp suggestion (pushed in real time) ─────────────────── */}
      {live && (
        <div
          className={`copilot-live${liveIsNew ? ' copilot-live--new' : ''}`}
          data-testid="copilot-live"
        >
          <div className="copilot-live__bar">
            <span className="copilot-live__dot" aria-hidden="true" />
            <span className="copilot-live__label mono">
              Live · {live.channel === 'sms' ? 'SMS' : 'WhatsApp'}
            </span>
          </div>
          {live.utterance && (
            <p className="copilot-live__msg">“{live.utterance}”</p>
          )}
          <div className="copilot-read">
            <span className="copilot-read__label mono">Read</span>
            <p className="copilot-read__text">{live.read}</p>
          </div>
          <div className="copilot-lines">
            <span className="copilot-lines__label mono">
              Reply on {live.channel === 'sms' ? 'SMS' : 'WhatsApp'}
            </span>
            {live.exact_lines.map((line, i) => (
              <div key={i} className="copilot-line">
                <span className="copilot-line__text">{line}</span>
                <button
                  type="button"
                  className="copilot-line__send"
                  disabled={live.status === 'sent' || sendingLine !== null}
                  onClick={() => handleSendWhatsApp(line)}
                >
                  {sendingLine === line ? 'Sending…' : 'Send'}
                </button>
              </div>
            ))}
          </div>
          {live.advance_hook && (
            <p className="copilot-live__hook">↪ {live.advance_hook}</p>
          )}
          {sentNote && <p className="copilot-live__sent" role="status">{sentNote}</p>}
        </div>
      )}

      {/* ── Respond input ──────────────────────────────────────────────────── */}
      <form className="copilot-respond" onSubmit={handleSubmit}>
        <div className="copilot-respond__row">
          <input
            className="copilot-respond__input"
            type="text"
            placeholder="What did the customer just say?"
            aria-label="What did the customer just say?"
            value={utterance}
            onChange={(e) => setUtterance(e.target.value)}
            disabled={isLoading}
          />
          <button
            className="copilot-respond__submit"
            type="submit"
            disabled={isLoading || !utterance.trim()}
            aria-label="Submit"
          >
            {isLoading
              ? <span className="copilot-flux-dot" aria-hidden="true" />
              : 'Submit'}
          </button>
        </div>
      </form>

      {/* ── Inline error ───────────────────────────────────────────────────── */}
      {error && (
        <p className="copilot-error" role="alert">{error}</p>
      )}

      {/* ── Idle hint — before first submit ───────────────────────────────── */}
      {phase === 'idle' && !hasResult && (
        <p className="copilot-idle-hint">
          Type what the customer just said — the co-pilot will read the situation
          and suggest exactly what to say next.
        </p>
      )}

      {/* ── 3-phase reveal ────────────────────────────────────────────────── */}
      {hasResult && result && (
        <div className="copilot-result">

          {/* Phase 1: READ — appears immediately, CSS fade-in */}
          <div className="copilot-read">
            <span className="copilot-read__label mono">Read</span>
            <p className="copilot-read__text">{result.read}</p>
          </div>

          {/* Phase 2: EXACT LINES — staggered slide-in, solar left-border */}
          {visibleLines > 0 && (
            <div className="copilot-lines">
              <span className="copilot-lines__label mono">Say this</span>
              {result.exact_lines.slice(0, visibleLines).map((line, i) => (
                <div key={i} className="copilot-line">
                  <span className="copilot-line__text">{line}</span>
                  <button
                    type="button"
                    className="copilot-line__copy"
                    aria-label="Copy"
                    onClick={() => handleCopy(line)}
                  >
                    Copy
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Phase 3: WHY — fades in last */}
          {showWhy && (
            <div className="copilot-why">
              <span className="copilot-why__label mono">Why</span>
              <p className="copilot-why__text">{result.why}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Collect sub-panel ─────────────────────────────────────────────── */}
      <div className="copilot-collect">
        <button
          type="button"
          className="copilot-collect__btn"
          onClick={handleCollect}
          disabled={collectLoading}
        >
          {collectLoading ? 'Thinking…' : 'Suggest next question'}
        </button>

        {collectError && (
          <p className="copilot-error" role="alert">{collectError}</p>
        )}

        {collectQuestion && (
          <div className="copilot-collect__result">
            <span className="copilot-collect__label mono">Ask</span>
            <p className="copilot-collect__question">{collectQuestion}</p>
          </div>
        )}
      </div>
    </section>
  )
}
