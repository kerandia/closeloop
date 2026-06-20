/**
 * SignalChip — a fully controlled evidence chip.
 *
 * Clicking a chip with an evidence_quote toggles `expanded` by calling `onToggle`.
 * High-severity labels (containing "HIGH") get the solar colour treatment and the
 * `data-high-severity` attribute so tests and CSS can target them.
 *
 * Evidence renders only when expanded=true so `queryByText` in tests is reliable.
 * CSS handles the fade-in on mount; the collapse is instant (deterministic tests).
 */
import type { Signal } from '../../api/types'
import './SignalChip.css'

export interface SignalChipProps {
  signal: Signal
  expanded: boolean
  onToggle: () => void
}

export function SignalChip({ signal, expanded, onToggle }: SignalChipProps) {
  const isHigh = signal.label.toUpperCase().includes('HIGH')
  const hasEvidence = Boolean(signal.evidence_quote)

  return (
    <div
      className={`signal-chip${isHigh ? ' signal-chip--high' : ''}`}
      data-high-severity={isHigh ? 'true' : undefined}
    >
      <button
        type="button"
        className="signal-chip__button"
        aria-expanded={hasEvidence ? expanded : undefined}
        onClick={onToggle}
      >
        {signal.label}
      </button>

      {hasEvidence && expanded && (
        <div className="signal-chip__evidence" data-testid="chip-evidence">
          <blockquote className="signal-chip__quote">{signal.evidence_quote}</blockquote>
        </div>
      )}
    </div>
  )
}
