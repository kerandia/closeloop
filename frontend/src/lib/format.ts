export type Band = 'cold' | 'cool' | 'warm' | 'hot' | 'unknown'

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
