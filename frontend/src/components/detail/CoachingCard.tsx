/**
 * CoachingCard — extracted RESPOND + COLLECT coaching UI from CopilotPanel.
 *
 * Props:
 *   customerId  string — passed to copilotRespond() and copilotCollect()
 *
 * Respond sub-panel:
 *   Input: "What did the customer just say?" → Submit
 *   Calls copilotRespond({ customer_id, utterance }).
 *   3-phase cinematic reveal of RespondOutput:
 *     1. READ   — read text fades in immediately.
 *     2. LINES  — exact_lines[] slide in one at a time, ~250 ms stagger.
 *                 Each line has a copy button.
 *                 Solar left-border marks the "script to speak" block.
 *     3. WHY    — why fades in last.
 *
 * Collect sub-panel:
 *   "Suggest next question" → copilotCollect(customerId) → shows question.
 */
import { useState, useRef, useEffect } from 'react'
import { copilotRespond, copilotCollect } from '../../api/client'
import type { RespondOutput } from '../../api/types'
import './CoachingCard.css'
import './CopilotPanel.css'

export interface CoachingCardProps {
  customerId: string
}

type Phase = 'idle' | 'loading' | 'reading' | 'lines' | 'complete'

export function CoachingCard({ customerId }: CoachingCardProps) {
  const [utterance, setUtterance] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<RespondOutput | null>(null)
  const [visibleLines, setVisibleLines] = useState(0)
  const [showWhy, setShowWhy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [collectQuestion, setCollectQuestion] = useState<string | null>(null)
  const [collectLoading, setCollectLoading] = useState(false)
  const [collectError, setCollectError] = useState<string | null>(null)

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
      console.error('Copilot respond failed:', err)
      setPhase('idle')
      setError('Could not generate a response. Try again.')
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
      console.error('Copilot collect failed:', err)
      setCollectError('Could not generate a question. Try again.')
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
    <section className="coaching-card" data-slot="coaching-card">
      <h2 className="coaching-card__heading">Co-pilot</h2>

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
