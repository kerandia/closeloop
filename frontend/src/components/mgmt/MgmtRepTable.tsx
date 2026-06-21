import type { RepStat } from '../../api/types'
import './MgmtRepTable.css'

/** "Lena Brandt" → "LB" */
function repInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0] ?? '')
    .join('')
    .toUpperCase()
}

interface Props {
  reps: RepStat[]
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
            <col style={{ width: '22%' }} />{/* Rep */}
            <col style={{ width: '13%' }} />{/* Owned */}
            <col style={{ width: '13%' }} />{/* Contacted */}
            <col style={{ width: '12%' }} />{/* Closed */}
            <col style={{ width: '15%' }} />{/* Conversion % */}
            <col style={{ width: '25%' }} />{/* Revenue */}
          </colgroup>
          <thead>
            <tr className="mrt__head-row">
              <th className="mono mrt__th">Rep</th>
              <th className="mono mrt__th">Owned</th>
              <th className="mono mrt__th">Contacted</th>
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
