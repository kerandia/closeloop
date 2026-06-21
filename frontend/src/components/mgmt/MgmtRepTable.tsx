import type { RepStat } from '../../api/types'
import { repInitials } from '../../lib/format'
import './MgmtRepTable.css'

interface Props {
  reps: RepStat[]
}

const STAGE_COLORS: Record<string, string> = {
  lead: 'var(--ink-700)',
  contacted: 'var(--band-cold)',
  quoted: 'var(--band-cool)',
  in_progress: 'var(--band-warm)',
  won: 'var(--band-hot)',
}

export function MgmtRepTable({ reps }: Props) {
  const formatter = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  })

  return (
    <div className="mrt-scroll">
      <section>
        <h2 className="mono mrt__heading">Rep Performance</h2>
        <table className="mrt">
          <colgroup>
            <col style={{ width: '20%' }} />{/* Rep */}
            <col style={{ width: '10%' }} />{/* Owned */}
            <col style={{ width: '10%' }} />{/* Contacted */}
            <col style={{ width: '25%' }} />{/* Pipeline */}
            <col style={{ width: '10%' }} />{/* Closed */}
            <col style={{ width: '10%' }} />{/* Conversion % */}
            <col style={{ width: '15%' }} />{/* Revenue */}
          </colgroup>
          <thead>
            <tr className="mrt__head-row">
              <th className="mono mrt__th">Rep</th>
              <th className="mono mrt__th">Owned</th>
              <th className="mono mrt__th">Contacted</th>
              <th className="mono mrt__th">Pipeline</th>
              <th className="mono mrt__th">Closed</th>
              <th className="mono mrt__th">Conversion %</th>
              <th className="mono mrt__th">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {reps.map(r => (
              <tr key={r.rep.id} className="mrt__row">
                <td className="mrt__cell mrt__cell--name">
                  <span className="mrt__rep-avatar" title={r.rep.name}>
                    {repInitials(r.rep.name)}
                  </span>
                  <span className="mrt__name">{r.rep.name}</span>
                </td>
                <td className="mrt__cell mrt__cell--num mono">
                  {r.customers_owned}
                </td>
                <td className="mrt__cell mrt__cell--num mono">
                  {r.contacted_this_period}
                </td>
                <td className="mrt__cell">
                  <div className="mrt__pipeline-bar" title={Object.entries(r.stage_breakdown).map(([k, v]) => `${v} ${k}`).join(', ')}>
                    {['lead', 'contacted', 'quoted', 'in_progress', 'won'].map(stage => {
                      const count = r.stage_breakdown[stage] || 0
                      if (count === 0) return null
                      const pct = (count / r.customers_owned) * 100
                      return (
                        <div
                          key={stage}
                          className="mrt__pipeline-segment"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: STAGE_COLORS[stage] || 'var(--ink-700)',
                          }}
                        />
                      )
                    })}
                  </div>
                </td>
                <td className="mrt__cell mrt__cell--num mono">
                  {r.deals_closed}
                </td>
                <td className="mrt__cell mrt__cell--num mono">
                  {r.conversion_rate_pct}%
                </td>
                <td className="mrt__cell mrt__cell--num mono">
                  {formatter.format(r.revenue_eur)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
