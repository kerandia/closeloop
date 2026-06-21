import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ManagementPage } from './ManagementPage'
import { mockMgmtStats } from '../mock/management'

// The page now fetches /api/management/stats via the client; resolve it with the
// fixture so the manager lens renders deterministically.
vi.mock('../api/client', () => ({
  getManagementStats: vi.fn((period: 'week' | 'month') => Promise.resolve(mockMgmtStats(period))),
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <ManagementPage />
    </MemoryRouter>,
  )
}

describe('ManagementPage', () => {
  test('renders KPI row, rep table and customer pool', async () => {
    renderPage()
    expect(await screen.findByText('Rep Performance')).toBeInTheDocument()
    expect(screen.getByText('Management Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Customer Pool')).toBeInTheDocument()
    for (const r of mockMgmtStats('month').reps) {
      expect(screen.getAllByText(r.rep.name).length).toBeGreaterThan(0)
    }
  })

  test('period toggle swaps the KPI numbers', async () => {
    renderPage()
    const month = mockMgmtStats('month')
    const week = mockMgmtStats('week')
    expect(month.new_leads).not.toBe(week.new_leads) // guard the fixture

    // default = month
    const card = (await screen.findByText('New Leads')).closest('.mkr-card') as HTMLElement
    expect(within(card).getByText(String(month.new_leads))).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'This Week' }))
    // after the toggle reloads, the week number appears
    expect(await screen.findByText(String(week.new_leads))).toBeInTheDocument()
  })
})
