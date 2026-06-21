/**
 * RecommendationCard — the "why this next step" header.
 *
 * Info-only: channel + timing headline, goal, and the rationale. No actions —
 * the rep acts via the ConversationPanel channel picker, and this card is merged
 * into that panel as its header (embedded).
 */
import { motion } from 'framer-motion'
import type { Recommendation, Channel } from '../../api/types'
import { ChannelIcon } from '../ChannelIcon'
import './RecommendationCard.css'

export interface RecommendationCardProps {
  recommendation: Recommendation | null
  /** Render without its own card chrome — used when merged into ConversationPanel. */
  embedded?: boolean
}

const CHANNEL_LABEL: Record<Channel, string> = {
  email: 'Email',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  phone: 'Phone call',
  visit: 'Home visit',
  voice_ai: 'Voice AI',
  system: 'System',
}

export function RecommendationCard({ recommendation, embedded }: RecommendationCardProps) {
  if (!recommendation) {
    return (
      <div className={`rec-card rec-card--empty${embedded ? ' rec-card--embedded' : ''}`}>
        <p className="rec-card__empty-text">No active recommendation</p>
      </div>
    )
  }

  const headline = recommendation.timing_label
    ? `${CHANNEL_LABEL[recommendation.channel]} · ${recommendation.timing_label}`
    : CHANNEL_LABEL[recommendation.channel]

  return (
    <motion.div
      className={`rec-card${embedded ? ' rec-card--embedded' : ''}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
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
      {recommendation.goal && <p className="rec-card__goal">{recommendation.goal}</p>}

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
    </motion.div>
  )
}
