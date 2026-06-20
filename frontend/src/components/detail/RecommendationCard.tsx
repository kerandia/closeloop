/**
 * RecommendationCard — Step 3 agents implement the body; do NOT change prop signatures.
 *
 * Prop contract:
 *   recommendation  Recommendation | null
 *     The current active recommendation. null while re-analyzing (right column shows
 *     the analyzing overlay instead of this card).
 *
 *   customer  Customer
 *     Full customer record. Used for channel-specific executor logic:
 *     channel === 'visit' is always rep-executed (the AI can't knock on a door).
 *     Also drives the "who makes the next touch" executor control.
 *
 *   onApprove  (recId: string) => void
 *     Rep clicked "Approve & Compose". DetailShell calls approveRecommendation,
 *     receives the Message draft, opens ComposeDrawer, and updates `status`.
 *     The card just fires the event — it never awaits the API call itself.
 *
 *   onDismiss  (recId: string) => void
 *     Rep dismissed the recommendation. DetailShell calls dismissRecommendation
 *     and clears the card.
 *
 *   status  RecStatus | null
 *     Externally controlled lifecycle state that DetailShell drives:
 *       'pending'    → show [Approve & Compose] + [Dismiss]
 *       'approved'   → card locked, drawer opening
 *       'composing'  → loading inside drawer
 *       'ready'      → editable draft visible in drawer
 *       'sent'       → show "Sent ✓" banner on card
 *       'dismissed'  → card hidden (DetailShell removes it)
 *       'superseded' → fade out, new card drops in
 *     Falls back to recommendation.status when null.
 */
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import type { Recommendation, Customer, RecStatus, Channel } from '../../api/types'
import { ChannelIcon } from '../ChannelIcon'
import './RecommendationCard.css'

export interface RecommendationCardProps {
  recommendation: Recommendation | null
  customer: Customer
  onApprove: (recId: string) => void
  onDismiss: (recId: string) => void
  /** Externally controlled status — overrides recommendation.status during transitions. */
  status: RecStatus | null
}

type Executor = 'ai' | 'rep'

// Channels where AI execution is feasible; visit always requires a rep
const AI_CAPABLE: Channel[] = ['email', 'sms', 'whatsapp', 'phone', 'voice_ai']

function defaultExecutor(channel: Channel): Executor {
  return AI_CAPABLE.includes(channel) ? 'ai' : 'rep'
}

const CHANNEL_LABEL: Record<Channel, string> = {
  email: 'Email',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  phone: 'Phone call',
  visit: 'Home visit',
  voice_ai: 'Voice AI',
  system: 'System',
}

export function RecommendationCard({
  recommendation,
  onApprove,
  onDismiss,
  status,
}: RecommendationCardProps) {
  // Executor state lives in the card (UI-local — the contract has no executor field)
  const [executor, setExecutor] = useState<Executor>(() =>
    recommendation ? defaultExecutor(recommendation.channel) : 'ai',
  )

  // Reset the executor to the suggested default whenever a new recommendation
  // arrives (e.g. after a re-analyze) so a new `visit` rec never keeps AI selected.
  const recId = recommendation?.id
  const recChannel = recommendation?.channel
  useEffect(() => {
    if (recChannel) setExecutor(defaultExecutor(recChannel))
  }, [recId, recChannel])

  // Empty / analyzing state
  if (!recommendation) {
    return (
      <div className="rec-card rec-card--empty">
        <p className="rec-card__empty-text">No active recommendation</p>
      </div>
    )
  }

  const effectiveStatus = status ?? recommendation.status
  const isVisit = recommendation.channel === 'visit'

  // Derive card lifecycle phase from status
  const isSent = effectiveStatus === 'sent'
  const isDismissed = effectiveStatus === 'dismissed'
  const isLocked = effectiveStatus === 'approved' || effectiveStatus === 'composing'
  const isReady = effectiveStatus === 'ready'

  const headline = recommendation.timing_label
    ? `${CHANNEL_LABEL[recommendation.channel]} · ${recommendation.timing_label}`
    : CHANNEL_LABEL[recommendation.channel]

  return (
    <motion.div
      className={`rec-card${isDismissed ? ' rec-card--dismissed' : ''}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: isDismissed ? 0.35 : 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
    >
      {/* ── Channel + timing headline ───────────────────────────────────────── */}
      <div className="rec-card__header">
        <span className="rec-card__channel-icon">
          <ChannelIcon channel={recommendation.channel} size={22} />
        </span>
        <h2 className="rec-card__headline">{headline}</h2>
      </div>

      {/* ── Goal line ──────────────────────────────────────────────────────── */}
      {recommendation.goal && (
        <p className="rec-card__goal">{recommendation.goal}</p>
      )}

      {/* ── Executor control ───────────────────────────────────────────────── */}
      <div className="rec-card__executor" role="radiogroup" aria-label="Executor">
        <label
          className={`rec-card__exec-btn${executor === 'ai' ? ' rec-card__exec-btn--active' : ''}${isVisit ? ' rec-card__exec-btn--disabled' : ''}`}
          title={isVisit ? "AI can't knock on a door" : undefined}
        >
          <input
            type="radio"
            name={`executor-${recommendation.id}`}
            value="ai"
            checked={executor === 'ai'}
            disabled={isVisit}
            onChange={() => setExecutor('ai')}
          />
          AI executes
        </label>
        <label
          className={`rec-card__exec-btn${executor === 'rep' ? ' rec-card__exec-btn--active' : ''}`}
        >
          <input
            type="radio"
            name={`executor-${recommendation.id}`}
            value="rep"
            checked={executor === 'rep'}
            onChange={() => setExecutor('rep')}
          />
          Rep executes
        </label>
      </div>

      {/* ── Rationale with animated solar stripe ───────────────────────────── */}
      <div className="rec-card__rationale-wrap">
        <motion.span
          className="rec-card__rationale-stripe"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.2, delay: 0.28, ease: 'easeOut' }}
        />
        <motion.p
          className="rec-card__rationale"
          initial={{ opacity: 0.4 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, delay: 0.3 }}
        >
          {recommendation.rationale}
        </motion.p>
      </div>

      {/* ── Lifecycle action area ───────────────────────────────────────────── */}
      {isSent ? (
        <div className="rec-card__sent" data-testid="sent-state">
          <span className="rec-card__sent-check" style={{ color: 'var(--flux)' }}>✓</span>
          {' '}Sent
        </div>
      ) : (
        <>
          <button
            className="rec-card__approve"
            onClick={() => onApprove(recommendation.id)}
            disabled={isLocked || isReady}
          >
            {isLocked ? 'Composing…' : isReady ? 'Message ready' : 'Approve & Compose'}
          </button>

          {/* Dismiss is only available while pending — hidden once locked or ready */}
          {!isLocked && !isReady && (
            <button
              className="rec-card__dismiss"
              onClick={() => onDismiss(recommendation.id)}
            >
              Dismiss
            </button>
          )}
        </>
      )}
    </motion.div>
  )
}
