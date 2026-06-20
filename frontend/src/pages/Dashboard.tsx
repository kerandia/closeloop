// Placeholder — Step 2 (Agent A) builds the ranked CustomerTable here.
import { Link } from 'react-router-dom'
import { MOCK_MULLER_ID } from '../mock/muller'

export function Dashboard() {
  return (
    <div style={{ padding: 32 }}>
      <h1>Pipeline</h1>
      <p className="mono">Dashboard — built in Step 2</p>
      <p>
        <Link to={`/customers/${MOCK_MULLER_ID}`} style={{ color: 'var(--solar)' }}>
          → Open Familie Müller
        </Link>
      </p>
    </div>
  )
}
