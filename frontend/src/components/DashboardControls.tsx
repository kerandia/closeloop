import type { CustomerListItem } from '../api/types'
import { FUNNEL_STAGES, BUYER_TYPE_OPTIONS, isAtRisk } from '../lib/demoPipeline'
import './DashboardControls.css'

interface Props {
  /** Full unfiltered list — used to compute the going-quiet counter. */
  customers: CustomerListItem[]
  search: string
  stage: string
  ghostRisk: string
  buyerType: string
  onSearchChange: (v: string) => void
  onStageChange: (v: string) => void
  onGhostRiskChange: (v: string) => void
  onBuyerTypeChange: (v: string) => void
}

export function DashboardControls({
  customers,
  search,
  stage,
  ghostRisk,
  buyerType,
  onSearchChange,
  onStageChange,
  onGhostRiskChange,
  onBuyerTypeChange,
}: Props) {
  const goingQuiet = customers.filter(isAtRisk).length

  return (
    <div className="dash-ctrl">
      {goingQuiet > 0 && (
        <span className="dash-ctrl__radar" title="customers at risk of going quiet — high ghost risk or trending down">
          <span className="dash-ctrl__radar-dot" /> {goingQuiet} going quiet
        </span>
      )}

      <input
        type="search"
        aria-label="Search customers"
        placeholder="Search by name…"
        value={search}
        onChange={e => onSearchChange(e.target.value)}
        className="dash-ctrl__search"
      />

      <label htmlFor="stage-filter" className="mono dash-ctrl__label">
        Stage
      </label>
      <select
        id="stage-filter"
        value={stage}
        onChange={e => onStageChange(e.target.value)}
        className="dash-ctrl__select"
      >
        <option value="">All stages</option>
        {FUNNEL_STAGES.map(s => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      <label htmlFor="buyer-filter" className="mono dash-ctrl__label">
        Buyer type
      </label>
      <select
        id="buyer-filter"
        value={buyerType}
        onChange={e => onBuyerTypeChange(e.target.value)}
        className="dash-ctrl__select"
      >
        <option value="">All types</option>
        {BUYER_TYPE_OPTIONS.map(b => (
          <option key={b.value} value={b.value}>
            {b.label}
          </option>
        ))}
      </select>

      <label htmlFor="risk-filter" className="mono dash-ctrl__label">
        Ghost Risk
      </label>
      <select
        id="risk-filter"
        value={ghostRisk}
        onChange={e => onGhostRiskChange(e.target.value)}
        className="dash-ctrl__select"
      >
        <option value="">All risks</option>
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
      </select>
    </div>
  )
}
