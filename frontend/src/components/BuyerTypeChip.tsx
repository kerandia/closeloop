import type { BuyerType } from '../api/types'
import './BuyerTypeChip.css'

const LABEL: Record<BuyerType, string> = {
  family: 'Family',
  investor: 'Investor',
  environmentalist: 'Environmentalist',
  skeptic: 'Skeptic',
}

export function BuyerTypeChip({ type }: { type: BuyerType | null | undefined }) {
  if (!type) return null
  return (
    <span className="buyer-chip" data-type={type}>
      {LABEL[type]}
    </span>
  )
}
