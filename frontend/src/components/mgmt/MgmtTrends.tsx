import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { TrendPoint } from '../../api/types'
import './MgmtTrends.css'

interface MgmtTrendsProps {
  trends: TrendPoint[]
}

const fluxGreen = '#3ab179'
const solarOrange = '#f1682c'
const axisTextFill = '#6b7280'

export function MgmtTrends({ trends }: MgmtTrendsProps) {
  const formatRevenue = (value: number) => {
    const formatter = new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    })
    return formatter.format(value)
  }

  const formatConversion = (value: number) => `${value}%`

  return (
    <div className="mgmt-trends">
      <h3 className="mgmt-trends__heading mono">Trends — 6 months</h3>
      <div className="mgmt-trends__chart-container">
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={trends} margin={{ top: 10, right: 40, left: 0, bottom: 40 }}>
            <defs>
              <linearGradient id="fluxGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={fluxGreen} stopOpacity={0.15} />
                <stop offset="95%" stopColor={fluxGreen} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="solarGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={solarOrange} stopOpacity={0.15} />
                <stop offset="95%" stopColor={solarOrange} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="0"
              stroke="var(--ink-700)"
              verticalPoints={[]}
              horizontalPoints={[]}
            />
            <XAxis
              dataKey="month"
              tick={{ fill: axisTextFill, fontSize: 12 }}
              axisLine={{ stroke: 'var(--ink-700)' }}
              tickLine={false}
            />
            <YAxis
              yAxisId="left"
              label={{ value: 'Conversion %', angle: -90, position: 'insideLeft' }}
              tick={{ fill: axisTextFill, fontSize: 12 }}
              axisLine={{ stroke: 'var(--ink-700)' }}
              tickLine={false}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              label={{ value: 'Revenue EUR', angle: 90, position: 'insideRight' }}
              tick={{ fill: axisTextFill, fontSize: 12 }}
              axisLine={{ stroke: 'var(--ink-700)' }}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--white)',
                border: `1px solid var(--ink-700)`,
                borderRadius: 'var(--radius)',
              }}
              formatter={(value, name) => {
                if (name === 'conversion_pct') {
                  return [formatConversion(value as number), 'Conversion']
                }
                if (name === 'revenue_eur') {
                  return [formatRevenue(value as number), 'Revenue']
                }
                return [value, name]
              }}
            />
            <Legend
              wrapperStyle={{ paddingTop: '16px' }}
              formatter={(value) => {
                if (value === 'conversion_pct') return 'Conversion %'
                if (value === 'revenue_eur') return 'Revenue EUR'
                return value
              }}
            />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="conversion_pct"
              stroke={fluxGreen}
              fill="url(#fluxGradient)"
              strokeWidth={2}
              dot={false}
              name="conversion_pct"
            />
            <Area
              yAxisId="right"
              type="monotone"
              dataKey="revenue_eur"
              stroke={solarOrange}
              fill="url(#solarGradient)"
              strokeWidth={2}
              dot={false}
              name="revenue_eur"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
