import type { Channel } from '../api/types'

export type Band = 'cold' | 'cool' | 'warm' | 'hot' | 'unknown'

// Human-readable channel labels — avoids raw enum tokens like "voice_ai" in the UI.
const CHANNEL_LABELS: Record<Channel, string> = {
  email: 'Email',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  phone: 'Phone',
  visit: 'Visit',
  voice_ai: 'Voice AI',
  system: 'System',
}

/** "Lena Brandt" → "LB" */
export function repInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0] ?? '')
    .join('')
    .toUpperCase()
}

export function channelLabel(channel: Channel): string {
  return CHANNEL_LABELS[channel] ?? channel
}

// ── Human-readable labels ─────────────────────────────────────────────────────
// The backend speaks in enum tokens (peace_of_mind, multi_quote_risk: HIGH).
// These helpers turn that machine vocabulary into plain language for the rep,
// so the UI reads like a briefing — not a database dump.

// Layer names that are redundant when they prefix a signal label inside their
// own section (e.g. "MOTIVATION: peace_of_mind" under the Motivation heading).
const LAYER_PREFIXES = new Set([
  'motivation',
  'negotiation',
  'objection',
  'buying signal',
])

const SEVERITY_WORDS: Record<string, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

// "winter_yield doubt" → "Winter yield doubt"
function sentenceCase(raw: string): string {
  const t = raw.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
  if (!t) return ''
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/**
 * Turn a raw signal/enum label into a readable phrase.
 *   "peace_of_mind"             → "Peace of mind"
 *   "MOTIVATION: peace_of_mind" → "Peace of mind"  (redundant layer prefix dropped)
 *   "multi_quote_risk: HIGH"    → "Multi quote risk · High"
 *   "decision: husband + wife"  → "Decision · Husband + wife"
 */
export function humanizeLabel(raw: string): string {
  if (!raw) return ''
  const colon = raw.indexOf(':')
  if (colon !== -1) {
    const keyRaw = raw.slice(0, colon)
    const valRaw = raw.slice(colon + 1)
    const keyNorm = keyRaw.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
    // A bare layer prefix carries no extra meaning inside its own section.
    if (LAYER_PREFIXES.has(keyNorm)) return humanizeLabel(valRaw)
    const valNorm = valRaw.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
    const val = SEVERITY_WORDS[valNorm.toLowerCase()] ?? sentenceCase(valNorm)
    return `${sentenceCase(keyRaw)} · ${val}`
  }
  return sentenceCase(raw)
}

// Friendly names for the small fixed set of motivations.
const MOTIVATION_LABELS: Record<string, string> = {
  savings: 'Saving money',
  environment: 'Caring for the planet',
  independence: 'Energy independence',
  peace_of_mind: 'Peace of mind',
  mixed: 'A mix of reasons',
}

export function motivationLabel(motivation: string | null | undefined): string {
  if (!motivation) return ''
  return MOTIVATION_LABELS[motivation] ?? sentenceCase(motivation)
}

// 0.8 → "80% sure". null/undefined → null (caller omits the line).
export function confidencePct(conf: number | null | undefined): string | null {
  if (conf == null) return null
  return `${Math.round(conf * 100)}% sure`
}

// Deal Score bands (deal-score.md Part 1): Cold 0–39 · Cool 40–59 · Warm 60–79 · Hot 80–100.
export function scoreBand(score: number | null | undefined): Band {
  if (score == null) return 'unknown'
  if (score < 40) return 'cold'
  if (score < 60) return 'cool'
  if (score < 80) return 'warm'
  return 'hot'
}

export function relativeTime(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return 'never'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return 'never'
  const sec = Math.round((now.getTime() - then) / 1000)

  if (sec < 0) {
    // future timestamp (e.g. a due date)
    const ahead = -sec
    if (ahead < 60) return 'soon'
    const min = Math.round(ahead / 60)
    if (min < 60) return `in ${min} min`
    const hours = Math.round(min / 60)
    if (hours < 24) return `in ${hours} ${hours === 1 ? 'hour' : 'hours'}`
    const days = Math.round(hours / 24)
    return `in ${days} ${days === 1 ? 'day' : 'days'}`
  }

  if (sec < 60) return 'just now'
  const min = Math.round(sec / 60)
  if (min < 60) return `${min} min ago`
  const hours = Math.round(min / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  const days = Math.round(hours / 24)
  return `${days} ${days === 1 ? 'day' : 'days'} ago`
}
