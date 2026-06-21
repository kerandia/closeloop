import { describe, test, expect } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ManagementPage } from './ManagementPage'
import { mockMgmtStats } from '../mock/management'

function renderPage() {
  return render(
    <MemoryRouter>
      <ManagementPage />
    </MemoryRouter>,
  )
}

describe('ManagementPage', () => {
  test('renders KPI row, rep table and customer pool', () => {
    renderPage()
    expect(screen.getByText('Management Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Rep Performance')).toBeInTheDocument()
    expect(screen.getByText('Customer Pool')).toBeInTheDocument()
    // all 3 reps present
    for (const r of mockMgmtStats('month').reps) {
      expect(screen.getAllByText(r.rep.name).length).toBeGreaterThan(0)
    }
  })

  test('period toggle swaps the KPI numbers', () => {
    renderPage()
    const month = mockMgmtStats('month')
    const week = mockMgmtStats('week')
    expect(month.new_leads).not.toBe(week.new_leads) // guard the fixture

    // default = month
    const card = screen.getByText('New Leads').closest('.mkr-card') as HTMLElement
    expect(within(card).getByText(String(month.new_leads))).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'This Week' }))
    const weekCard = screen.getByText('New Leads').closest('.mkr-card') as HTMLElement
    expect(within(weekCard).getByText(String(week.new_leads))).toBeInTheDocument()
  })
})
