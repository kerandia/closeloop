import { describe, test, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { CustomerTable } from './CustomerTable'
import type { CustomerListItem } from '../api/types'

const now = new Date()
const iso = (daysAgo: number) =>
  new Date(now.getTime() - daysAgo * 86_400_000).toISOString()

const mockCustomers: CustomerListItem[] = [
  {
    id: 'c-1',
    name: 'Familie Müller',
    buyer_type: 'skeptic',
    sign_likelihood: 74,
    ghost_risk: 'medium',
    stage: 'in_progress',
    next_action: { channel: 'visit', timing_label: 'within 48h' },
    assigned_rep: { id: 'r-1', name: 'Lena Brandt' },
    last_contact_at: iso(2),
  },
  {
    id: 'c-2',
    name: 'Sophie Wagner',
    buyer_type: 'investor',
    sign_likelihood: 61,
    ghost_risk: 'low',
    stage: 'quoted',
    next_action: { channel: 'email', timing_label: 'this week' },
    assigned_rep: { id: 'r-1', name: 'Lena Brandt' },
    last_contact_at: iso(4),
  },
]

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="location">{loc.pathname}</div>
}

function renderWithRouter(customers = mockCustomers) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<CustomerTable customers={customers} />} />
        <Route path="/customers/:id" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('CustomerTable', () => {
  test('renders all customer names', () => {
    renderWithRouter()
    expect(screen.getByText('Familie Müller')).toBeInTheDocument()
    expect(screen.getByText('Sophie Wagner')).toBeInTheDocument()
  })

  test('renders buyer type chips', () => {
    renderWithRouter()
    expect(screen.getByText(/skeptic/i)).toBeInTheDocument()
    expect(screen.getByText(/investor/i)).toBeInTheDocument()
  })

  test('renders sign likelihood scores via ScoreBar', () => {
    renderWithRouter()
    expect(screen.getByText('74')).toBeInTheDocument()
    expect(screen.getByText('61')).toBeInTheDocument()
  })

  test('renders ghost risk pills', () => {
    renderWithRouter()
    expect(screen.getByText('MED')).toBeInTheDocument()
    expect(screen.getByText('LOW')).toBeInTheDocument()
  })

  test('renders stage badges with underscores replaced', () => {
    renderWithRouter()
    expect(screen.getByText('in progress')).toBeInTheDocument()
    expect(screen.getByText('quoted')).toBeInTheDocument()
  })

  test('renders next action timing labels', () => {
    renderWithRouter()
    expect(screen.getByText(/within 48h/)).toBeInTheDocument()
    expect(screen.getByText(/this week/)).toBeInTheDocument()
  })

  test('renders rep initials derived from name', () => {
    renderWithRouter()
    // Lena Brandt → LB; two rows, both reps are Lena Brandt
    expect(screen.getAllByText('LB').length).toBeGreaterThanOrEqual(2)
  })

  test('renders relative last contact time', () => {
    renderWithRouter()
    expect(screen.getByText('2 days ago')).toBeInTheDocument()
    expect(screen.getByText('4 days ago')).toBeInTheDocument()
  })

  test('clicking a row navigates to /customers/:id', async () => {
    renderWithRouter()
    fireEvent.click(screen.getByText('Familie Müller'))
    const loc = await screen.findByTestId('location')
    expect(loc.textContent).toBe('/customers/c-1')
  })

  test('clicking second row navigates to correct customer id', async () => {
    renderWithRouter()
    fireEvent.click(screen.getByText('Sophie Wagner'))
    const loc = await screen.findByTestId('location')
    expect(loc.textContent).toBe('/customers/c-2')
  })
})
