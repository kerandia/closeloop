import { useState, useEffect, useCallback } from 'react'
import { useMatch, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { listCustomers } from '../api/client'
import type { CustomerListItem } from '../api/types'
import { CustomerTable } from '../components/CustomerTable'
import { DashboardControls } from '../components/DashboardControls'
import { CustomerDetailPage } from './CustomerDetailPage'
import { AddCustomerForm } from '../components/AddCustomerForm'
import { withMock } from '../lib/nav'
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
      <p className="dash-empty__msg">No customers yet — import a list</p>
      <button className="dash-empty__button" onClick={onAdd}>
        + Add customer
      </button>
    </div>
  )
}

// ── No-results state ───────────────────────────────────────────────────────────

interface NoResultsProps {
  onClearFilters: () => void
}

function NoResultsState({ onClearFilters }: NoResultsProps) {
  return (
    <div className="dash-empty">
      <p className="dash-empty__msg">No customers match your filters</p>
      <button className="dash-empty__button" onClick={onClearFilters}>
        Clear filters
      </button>
    </div>
  )
}

// ── Dashboard page ────────────────────────────────────────────────────────────

export function Dashboard() {
  const match = useMatch('/app/customers/:id')
  const activeCustomerId = match?.params.id
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [customers, setCustomers] = useState<CustomerListItem[]>([])

  // Controls state
  const [search, setSearch] = useState('')
  const [stage, setStage] = useState('')
  const [ghostRisk, setGhostRisk] = useState('')
  const [buyerType, setBuyerType] = useState('')
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
    .filter(c => !buyerType || c.buyer_type === buyerType)

  const handleClearFilters = () => {
    setSearch('')
    setStage('')
    setGhostRisk('')
    setBuyerType('')
  }

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
        buyerType={buyerType}
        onSearchChange={setSearch}
        onStageChange={setStage}
        onGhostRiskChange={setGhostRisk}
        onBuyerTypeChange={setBuyerType}
      />

      {loading ? (
        <SkeletonRows />
      ) : customers.length === 0 ? (
        <EmptyState onAdd={() => setShowAdd(true)} />
      ) : filtered.length === 0 ? (
        <NoResultsState onClearFilters={handleClearFilters} />
      ) : (
        <CustomerTable customers={filtered} />
      )}

      {/* Slide-out Drawer for Customer Detail */}
      <AnimatePresence>
        {activeCustomerId && (
          <>
            {/* Blurred glass backdrop overlay */}
            <motion.div
              className="drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => navigate(withMock('/app'))}
            />
            {/* The slide-in drawer container */}
            <motion.div
              className="drawer-container"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            >
              <CustomerDetailPage id={activeCustomerId} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
