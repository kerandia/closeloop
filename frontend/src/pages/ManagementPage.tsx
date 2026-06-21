import { useEffect, useState } from 'react'
import { getManagementStats } from '../api/client'
import { mockMgmtStats } from '../mock/management'
import type { MgmtStats } from '../api/types'
import { MgmtKpiRow } from '../components/mgmt/MgmtKpiRow'
import { MgmtFunnel } from '../components/mgmt/MgmtFunnel'
import { MgmtTrends } from '../components/mgmt/MgmtTrends'
import { MgmtRepTable } from '../components/mgmt/MgmtRepTable'
import { MgmtNeedsAttention } from '../components/mgmt/MgmtNeedsAttention'
import { CustomerTable } from '../components/CustomerTable'
import './ManagementPage.css'

// Manager lens. Live aggregation from /api/management/stats; falls back to the
// seed fixture in mock mode or if the backend is unreachable (never blanks).
type Period = 'week' | 'month'

export function ManagementPage() {
  const [period, setPeriod] = useState<Period>('month')
  const [stats, setStats] = useState<MgmtStats | null>(null)

  useEffect(() => {
    let active = true
    setStats(null)
    getManagementStats(period)
      .then((s) => { if (active) setStats(s) })
      .catch(() => { if (active) setStats(mockMgmtStats(period)) })
    return () => { active = false }
  }, [period])

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

      {!stats ? (
        <p className="mgmt__loading">Loading…</p>
      ) : (
        <>
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
        </>
      )}
    </div>
  )
}
