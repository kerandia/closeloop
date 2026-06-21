import { useState, useEffect, useCallback } from 'react'
import { listCustomers } from '../api/client'
import type { CustomerListItem } from '../api/types'
import { CustomerTable } from '../components/CustomerTable'
import { DashboardControls } from '../components/DashboardControls'
import { AddCustomerForm } from '../components/AddCustomerForm'
import './Dashboard.css'

// ── Loading skeleton ─────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <div className="dash-skeleton" aria-label="Loading pipeline…">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="skeleton-row" />
      ))}
    </div>
  )
}

// ── Error state ───────────────────────────────────────────────────────────────

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="dash-error" role="alert">
      <p className="dash-error__msg">{message}</p>
      <button className="dash-error__retry" onClick={onRetry}>
        Retry
      </button>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="dash-empty">
      <p className="dash-empty__msg">No customers yet</p>
      <button className="dashboard__add" onClick={onAdd}>
        + Add customer
      </button>
    </div>
  )
}

// ── Dashboard page ────────────────────────────────────────────────────────────

export function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [customers, setCustomers] = useState<CustomerListItem[]>([])

  // Controls state
  const [search, setSearch] = useState('')
  const [stage, setStage] = useState('')
  const [ghostRisk, setGhostRisk] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listCustomers()
      setCustomers(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load customers')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Client-side filtering (API already returns ranked by sign_likelihood desc)
  const filtered = customers
    .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()))
    .filter(c => !stage || c.stage === stage)
    .filter(c => !ghostRisk || c.ghost_risk === ghostRisk)

  if (loading) return <SkeletonRows />
  if (error) return <ErrorState message={error} onRetry={fetchData} />

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <h1 className="dashboard__title">Pipeline</h1>
        <button className="dashboard__add" onClick={() => setShowAdd(true)}>
          + Add customer
        </button>
      </header>

      {showAdd && (
        <AddCustomerForm
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false)
            fetchData()
          }}
        />
      )}

      <DashboardControls
        customers={customers}
        search={search}
        stage={stage}
        ghostRisk={ghostRisk}
        onSearchChange={setSearch}
        onStageChange={setStage}
        onGhostRiskChange={setGhostRisk}
      />

      {customers.length === 0 ? (
        <EmptyState onAdd={() => setShowAdd(true)} />
      ) : (
        <CustomerTable customers={filtered} />
      )}
    </div>
  )
}
