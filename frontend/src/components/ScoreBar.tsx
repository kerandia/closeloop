import { useEffect, useRef, useState } from 'react'
import { scoreBand } from '../lib/format'
import './ScoreBar.css'

interface Props {
  value: number | null | undefined
  /** trend arrow — deal-score.md ②: trend beats the absolute number */
  trend?: 'up' | 'down' | 'flat' | null
  /** compact = inline header/row variant */
  compact?: boolean
}

/** Score bar: band color + count-up + charge animation + trend arrow. */
export function ScoreBar({ value, trend, compact }: Props) {
  const band = scoreBand(value)
  const target = value ?? 0
  const [display, setDisplay] = useState(target)
  const raf = useRef(0)

  useEffect(() => {
    if (value == null) return
    const from = display
    const start = performance.now()
    const dur = 600
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(from + (target - from) * eased))
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, value])

  return (
    <div className={`scorebar ${compact ? 'scorebar--compact' : ''}`} data-band={band}>
      <div className="scorebar__track">
        <div
          className="scorebar__fill"
          style={{ width: value == null ? 0 : `${Math.max(2, target)}%` }}
        />
      </div>
      <span className="scorebar__num">{value == null ? '—' : display}</span>
      {value != null && trend && trend !== 'flat' && (
        <span
          className={`scorebar__trend scorebar__trend--${trend}`}
          aria-label={`trend ${trend}`}
        >
          {trend === 'up' ? '↑' : '↓'}
        </span>
      )}
    </div>
  )
}
