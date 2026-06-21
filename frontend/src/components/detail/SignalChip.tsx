/**
 * SignalChip — a fully controlled evidence chip.
 *
 * Clicking a chip with an evidence_quote toggles `expanded` by calling `onToggle`.
 * High-severity labels (containing "HIGH") get the solar colour treatment and the
 * `data-high-severity` attribute so tests and CSS can target them.
 *
 * Evidence renders only when expanded=true so `queryByText` in tests is reliable.
 * Framer Motion AnimatePresence handles the height+opacity expand/collapse.
 * Duration is set to 0 when the user prefers reduced motion.
 */
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { Signal } from '../../api/types'
import './SignalChip.css'

export interface SignalChipProps {
  signal: Signal
  expanded: boolean
  onToggle: () => void
}

export function SignalChip({ signal, expanded, onToggle }: SignalChipProps) {
  const reduceMotion = useReducedMotion()
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

      <AnimatePresence initial={false}>
        {hasEvidence && expanded && (
          <motion.div
            data-testid="chip-evidence"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <blockquote className="signal-chip__quote signal-chip__quote--spaced">
              {signal.evidence_quote}
            </blockquote>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
