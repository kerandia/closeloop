import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Dashboard } from './Dashboard'
import * as clientModule from '../api/client'

vi.mock('../api/client', () => ({
  listCustomers: vi.fn(),
  isMockMode: vi.fn(() => false),
}))

const listCustomersMock = vi.mocked(clientModule.listCustomers)

const now = new Date()
const iso = (daysAgo: number) =>
  new Date(now.getTime() - daysAgo * 86_400_000).toISOString()

const mockCustomers = [
  {
    id: 'c-1',
    name: 'Familie Müller',
    buyer_type: 'skeptic' as const,
    sign_likelihood: 74,
    ghost_risk: 'medium' as const,
    stage: 'in_progress',
    next_action: { channel: 'visit' as const, timing_label: 'within 48h' },
    assigned_rep: { id: 'r-1', name: 'Lena Brandt' },
    last_contact_at: iso(2),
  },
  {
    id: 'c-2',
    name: 'Sophie Wagner',
    buyer_type: 'investor' as const,
    sign_likelihood: 61,
    ghost_risk: 'high' as const,
    stage: 'quoted',
    next_action: { channel: 'email' as const, timing_label: 'this week' },
    assigned_rep: { id: 'r-1', name: 'Lena Brandt' },
    last_contact_at: iso(4),
  },
]

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  )
}

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('shows skeleton rows while data is loading', () => {
    // Never-resolving promise keeps us in loading state
    listCustomersMock.mockImplementation(() => new Promise(() => {}))
    renderDashboard()
    expect(document.querySelectorAll('.skeleton-row').length).toBeGreaterThan(0)
  })

  test('renders customer rows after data loads', async () => {
    listCustomersMock.mockResolvedValue(mockCustomers)
    renderDashboard()
    expect(await screen.findByText('Familie Müller')).toBeInTheDocument()
    expect(screen.getByText('Sophie Wagner')).toBeInTheDocument()
  })

  test('going quiet counter reflects count of high ghost_risk customers', async () => {
    // Sophie Wagner has ghost_risk: 'high' → 1 going quiet
    listCustomersMock.mockResolvedValue(mockCustomers)
    renderDashboard()
    await screen.findByText('Familie Müller')
    expect(screen.getByText(/1 going quiet/i)).toBeInTheDocument()
  })

  test('search filters rows by customer name (case-insensitive)', async () => {
    listCustomersMock.mockResolvedValue(mockCustomers)
    renderDashboard()
    await screen.findByText('Familie Müller')
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Sophie' } })
    expect(screen.queryByText('Familie Müller')).not.toBeInTheDocument()
    expect(screen.getByText('Sophie Wagner')).toBeInTheDocument()
  })

  test('stage filter shows only rows matching the selected stage', async () => {
    listCustomersMock.mockResolvedValue(mockCustomers)
    renderDashboard()
    await screen.findByText('Familie Müller')
    fireEvent.change(screen.getByLabelText(/stage/i), { target: { value: 'quoted' } })
    expect(screen.queryByText('Familie Müller')).not.toBeInTheDocument()
    expect(screen.getByText('Sophie Wagner')).toBeInTheDocument()
  })

  test('ghost risk filter shows only rows matching the selected risk', async () => {
    listCustomersMock.mockResolvedValue(mockCustomers)
    renderDashboard()
    await screen.findByText('Familie Müller')
    fireEvent.change(screen.getByLabelText(/ghost risk/i), { target: { value: 'medium' } })
    expect(screen.getByText('Familie Müller')).toBeInTheDocument()
    expect(screen.queryByText('Sophie Wagner')).not.toBeInTheDocument()
  })

  test('empty state shows CTA when API returns no customers', async () => {
    listCustomersMock.mockResolvedValue([])
    renderDashboard()
    expect(await screen.findByText(/no customers yet/i)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /add customer/i }).length).toBeGreaterThan(0)
  })

  test('error state shows inline error and Retry button', async () => {
    listCustomersMock.mockRejectedValue(new Error('network error'))
    renderDashboard()
    expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  test('Retry button refetches data on click', async () => {
    listCustomersMock
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce(mockCustomers)
    renderDashboard()
    const retryBtn = await screen.findByRole('button', { name: /retry/i })
    fireEvent.click(retryBtn)
    expect(await screen.findByText('Familie Müller')).toBeInTheDocument()
    expect(listCustomersMock).toHaveBeenCalledTimes(2)
  })

  test('no-results state shows when filter eliminates all rows', async () => {
    listCustomersMock.mockResolvedValue(mockCustomers)
    renderDashboard()
    await screen.findByText('Familie Müller')
    // Search for a name that doesn't exist
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzzzzzz' } })
    expect(await screen.findByText(/no customers match your filters/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument()
  })

  test('Clear filters button resets filters and restores rows', async () => {
    listCustomersMock.mockResolvedValue(mockCustomers)
    renderDashboard()
    await screen.findByText('Familie Müller')
    // Apply a search that zeros rows
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzzzzzz' } })
    expect(await screen.findByText(/no customers match your filters/i)).toBeInTheDocument()
    // Click Clear filters
    fireEvent.click(screen.getByRole('button', { name: /clear filters/i }))
    // Filters reset, rows restored
    expect(await screen.findByText('Familie Müller')).toBeInTheDocument()
    expect(screen.getByText('Sophie Wagner')).toBeInTheDocument()
  })
})
