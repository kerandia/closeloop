import type { MgmtStats } from '../../api/types'
import './MgmtKpiRow.css'

interface MgmtKpiRowProps {
  stats: MgmtStats
}

type DeltaType = 'pct' | 'eur' | 'count'

const eurFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

function formatEur(value: number): string {
  if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(0)}M`
  if (value >= 1_000) return `€${(value / 1_000).toFixed(0)}k`
  return eurFormatter.format(value)
}

function DeltaChip({ delta, type }: { delta: number; type: DeltaType }) {
  if (delta === 0) return null
  const isPositive = delta > 0
  const sign = isPositive ? '+' : ''
  const value =
    type === 'pct'
      ? `${sign}${delta.toFixed(1)}%`
      : type === 'count'
        ? `${sign}${delta}`
        : `${isPositive ? '+' : '-'}${formatEur(Math.abs(delta))}`
  return (
    <div className={`mkr-delta ${isPositive ? 'mkr-delta--up' : 'mkr-delta--down'}`}>
      <span className="mkr-delta__arrow">{isPositive ? '↑' : '↓'}</span>
      <span className="mkr-delta__value">{value}</span>
    </div>
  )
}

function KpiCard({
  label,
  value,
  delta,
  deltaType,
}: {
  label: string
  value: string | number
  delta?: number
  deltaType?: DeltaType
}) {
  return (
    <div className="mkr-card">
      <div className="mono mkr-card__label">{label}</div>
      <div className="mkr-card__value">{value}</div>
      {delta !== undefined && deltaType && <DeltaChip delta={delta} type={deltaType} />}
    </div>
  )
}

export function MgmtKpiRow({ stats }: MgmtKpiRowProps) {
  return (
    <div className="mkr-grid">
      <KpiCard
        label="New Leads"
        value={stats.new_leads}
        delta={stats.delta_new_leads}
        deltaType="count"
      />
      <KpiCard label="Active Pipeline" value={stats.active_pipeline} />
      <KpiCard label="Deals Closed" value={stats.deals_closed} />
      <KpiCard
        label="Conversion Rate"
        value={`${stats.conversion_rate_pct}%`}
        delta={stats.delta_conversion_pct}
        deltaType="pct"
      />
      <KpiCard
        label="Forecast"
        value={formatEur(stats.forecast_eur)}
        delta={stats.delta_revenue_eur}
        deltaType="eur"
      />
    </div>
  )
}
