import type { CustomerListItem } from '../api/types'
import './DashboardControls.css'

interface Props {
  /** Full unfiltered list — used to compute the going-quiet counter. */
  customers: CustomerListItem[]
  search: string
  stage: string
  ghostRisk: string
  onSearchChange: (v: string) => void
  onStageChange: (v: string) => void
  onGhostRiskChange: (v: string) => void
}

export function DashboardControls({
  customers,
  search,
  stage,
  ghostRisk,
  onSearchChange,
  onStageChange,
  onGhostRiskChange,
}: Props) {
  const goingQuiet = customers.filter(c => c.ghost_risk === 'high').length
  const stages = Array.from(new Set(customers.map(c => c.stage))).sort()

  return (
    <div className="dash-ctrl">
      {goingQuiet > 0 && (
        <span className="dash-ctrl__radar" title="customers at high ghost risk">
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
        {stages.map(s => (
          <option key={s} value={s}>
            {s.replace(/_/g, ' ')}
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
