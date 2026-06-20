export type Band = 'low' | 'mid' | 'high' | 'unknown'

// Score bands per spec: red <40, amber 40–70, green >70.
export function scoreBand(score: number | null | undefined): Band {
  if (score == null) return 'unknown'
  if (score < 40) return 'low'
  if (score <= 70) return 'mid'
  return 'high'
}

export function relativeTime(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return 'never'
  const then = new Date(iso).getTime()
  const sec = Math.round((now.getTime() - then) / 1000)
  if (sec < 60) return 'just now'
  const min = Math.round(sec / 60)
  if (min < 60) return `${min} min ago`
  const hours = Math.round(min / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  const days = Math.round(hours / 24)
  return `${days} ${days === 1 ? 'day' : 'days'} ago`
}
