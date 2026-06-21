import { useMemo, useState } from 'react'
import { mockMgmtStats } from '../mock/management'
import { MgmtKpiRow } from '../components/mgmt/MgmtKpiRow'
import { MgmtFunnel } from '../components/mgmt/MgmtFunnel'
import { MgmtTrends } from '../components/mgmt/MgmtTrends'
import { MgmtRepTable } from '../components/mgmt/MgmtRepTable'
import { MgmtNeedsAttention } from '../components/mgmt/MgmtNeedsAttention'
import { CustomerTable } from '../components/CustomerTable'
import './ManagementPage.css'

// Frontend-only manager lens: always reads the seed fixture (there is no backend
// aggregation endpoint yet). The period toggle swaps the precomputed snapshot.
type Period = 'week' | 'month'

export function ManagementPage() {
  const [period, setPeriod] = useState<Period>('month')
  const stats = useMemo(() => mockMgmtStats(period), [period])

  return (
    <div className="mgmt">
      <header className="mgmt__header">
        <h1 className="mgmt__title">Management Dashboard</h1>
        <div className="mgmt__toggle" role="group" aria-label="Time period">
          {(['week', 'month'] as const).map((p) => (
            <button
              key={p}
              type="button"
              className={`mgmt__toggle-btn${period === p ? ' mgmt__toggle-btn--active' : ''}`}
              aria-pressed={period === p}
              onClick={() => setPeriod(p)}
            >
              {p === 'week' ? 'This Week' : 'This Month'}
            </button>
          ))}
        </div>
      </header>

      <MgmtKpiRow stats={stats} />

      <div className="mgmt__split">
        <MgmtFunnel funnel={stats.funnel} />
        <MgmtTrends trends={stats.trends} />
      </div>

      <MgmtRepTable reps={stats.reps} />

      <MgmtNeedsAttention customers={stats.needs_attention} />

      <section className="mgmt-pool">
        <h3 className="mgmt-pool__heading mono">Customer Pool</h3>
        <CustomerTable customers={stats.customers} />
      </section>
    </div>
  )
}
