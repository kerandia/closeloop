import type { GhostRisk } from '../api/types'
import './GhostRiskPill.css'

const SHORT: Record<GhostRisk, string> = { low: 'LOW', medium: 'MED', high: 'HIGH' }

export function GhostRiskPill({ risk }: { risk: GhostRisk | null | undefined }) {
  if (!risk) return null
  return (
    <span className="risk-pill" data-risk={risk} title={`ghost risk: ${risk}`}>
      {SHORT[risk]}
    </span>
  )
}
