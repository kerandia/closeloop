import React from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  LabelList,
} from 'recharts'
import type { FunnelStage } from '../../api/types'
import './MgmtFunnel.css'

interface MgmtFunnelProps {
  funnel: FunnelStage[]
}

const formatEUR = (value: number): string => {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

const CustomTooltip: React.FC<{
  active?: boolean
  payload?: { payload: FunnelStage }[]
}> = ({ active, payload }) => {
  if (active && payload && payload[0]) {
    const data = payload[0].payload
    return (
      <div className="funnel-tooltip">
        <div className="funnel-tooltip__label">{data.label}</div>
        <div className="funnel-tooltip__count">Count: {data.count}</div>
        <div className="funnel-tooltip__value">
          Value: {formatEUR(data.value_eur)}
        </div>
      </div>
    )
  }
  return null
}

export const MgmtFunnel: React.FC<MgmtFunnelProps> = ({ funnel }) => {
  return (
    <section className="funnel-card">
      <h2 className="mono funnel-card__heading">Pipeline Funnel</h2>

      <div className="funnel-chart-container">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={funnel}
            layout="vertical"
            margin={{ top: 8, right: 32, left: 120, bottom: 8 }}
          >
            <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} />
            <YAxis
              dataKey="label"
              type="category"
              tick={{ fill: '#6b7280', fontSize: 11 }}
              width={110}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="count" fill="#f1682c" radius={4}>
              <LabelList
                dataKey="count"
                position="right"
                fill="#6b7280"
                fontSize={12}
                offset={8}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="funnel-conversions">
        {funnel.map((stage, index) => {
          if (
            stage.conversion_to_next_pct !== null &&
            index < funnel.length - 1
          ) {
            const nextStage = funnel[index + 1]
            return (
              <div key={`conversion-${index}`} className="funnel-conversion-row">
                <span className="funnel-conversion-label">
                  {stage.label} → {nextStage.label}
                </span>
                <span className="funnel-conversion-value">
                  {stage.conversion_to_next_pct}%
                </span>
              </div>
            )
          }
          return null
        })}
      </div>
    </section>
  )
}
