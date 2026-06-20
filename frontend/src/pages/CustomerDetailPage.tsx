// Placeholder — Step 2 (Agent B) builds the detail shell + reveal scaffold here.
import { Link, useParams } from 'react-router-dom'

export function CustomerDetailPage() {
  const { id } = useParams()
  return (
    <div style={{ padding: 32 }}>
      <Link to="/" className="mono">
        ← Pipeline
      </Link>
      <h1>Customer detail</h1>
      <p className="mono">Detail shell — built in Step 2 (id: {id})</p>
    </div>
  )
}
