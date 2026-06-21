import { describe, it, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ProfilePanel } from './ProfilePanel'
import type { Profile, Signal, Quote } from '../../api/types'

// ── Fixtures ────────────────────────────────────────────────────────────────

const profile: Profile = {
  id: 'p1',
  motivation: 'peace_of_mind',
  motivation_conf: 0.8,
  negotiation: { price_sensitivity: 'medium', decision_makers: ['husband', 'wife'] },
  buyer_type: 'family',
  summary: 'Retired couple seeking energy independence',
  objections: [{ key: 'winter_yield', note: 'Worried about winter output' }],
  completeness: 72,
  updated_at: null,
}

const signals: Signal[] = [
  {
    id: 's1',
    layer: 'motivation',
    label: 'peace of mind',
    evidence_quote: 'We want to be energy independent',
    source_interaction_id: null,
    confidence: 0.9,
  },
  {
    id: 's2',
    layer: 'negotiation',
    label: 'multi_quote_risk: HIGH',
    evidence_quote: 'We are checking other companies',
    source_interaction_id: null,
    confidence: 0.8,
  },
  {
    id: 's3',
    layer: 'negotiation',
    label: 'price sensitive',
    evidence_quote: null,
    source_interaction_id: null,
    confidence: 0.6,
  },
  {
    id: 's4',
    layer: 'objection',
    label: 'winter yield doubt',
    evidence_quote: 'What about winter yield?',
    source_interaction_id: null,
    confidence: 0.7,
  },
]

const quote: Quote = {
  id: 'q1',
  system_size_kwp: 12,
  battery_kwh: null,
  product_summary: null,
  price_eur: 28900,
  monthly_saving_eur: null,
  payback_years: 9.5,
  annual_return_pct: null,
  co2_tons_25y: null,
  financing: null,
  pdf_url: null,
  sent_at: null,
}

// ── Test suite ───────────────────────────────────────────────────────────────

describe('ProfilePanel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── Core rendering ─────────────────────────────────────────────────────────

  it('renders summary and motivation with confidence', () => {
    render(<ProfilePanel profile={profile} signals={signals} quote={null} />)
    expect(screen.getByText('Retired couple seeking energy independence')).toBeInTheDocument()
    // Raw enum is humanized; confidence is shown as a percentage. The phrase
    // appears both as the motivation badge and the motivation-layer chip.
    expect(screen.getAllByText('Peace of mind').length).toBeGreaterThan(0)
    expect(screen.getByText(/80%/)).toBeInTheDocument()
  })

  it('renders a chip per signal label', () => {
    render(<ProfilePanel profile={profile} signals={signals} quote={null} />)
    // Chips are buttons — query by role to disambiguate from the motivation badge.
    expect(screen.getByRole('button', { name: 'Peace of mind' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Multi quote risk · High' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Price sensitive' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Winter yield doubt' })).toBeInTheDocument()
  })

  it('null profile shows empty state', () => {
    render(<ProfilePanel profile={null} signals={[]} quote={null} />)
    expect(screen.getByText(/no profile yet/i)).toBeInTheDocument()
  })

  it('renders completeness percentage', () => {
    render(<ProfilePanel profile={profile} signals={[]} quote={null} />)
    expect(screen.getByText(/72%/)).toBeInTheDocument()
  })

  it('renders quote summary when quote is provided', () => {
    render(<ProfilePanel profile={profile} signals={[]} quote={quote} />)
    expect(screen.getByText(/12 kWp/)).toBeInTheDocument()
    expect(screen.getByText(/28.900|28,900/)).toBeInTheDocument()
  })

  // ── SignalChip evidence expansion ──────────────────────────────────────────

  it('clicking a chip with evidence reveals the quote inline', () => {
    render(<ProfilePanel profile={profile} signals={[signals[0]]} quote={null} />)

    // Evidence not in DOM initially
    expect(screen.queryByText('We want to be energy independent')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Peace of mind' }))

    expect(screen.getByText('We want to be energy independent')).toBeInTheDocument()
  })

  it('clicking an expanded chip collapses it', () => {
    render(<ProfilePanel profile={profile} signals={[signals[0]]} quote={null} />)

    fireEvent.click(screen.getByRole('button', { name: 'Peace of mind' }))
    expect(screen.getByText('We want to be energy independent')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Peace of mind' }))
    expect(screen.queryByText('We want to be energy independent')).not.toBeInTheDocument()
  })

  it('clicking a chip without evidence does not crash or show evidence', () => {
    render(<ProfilePanel profile={profile} signals={[signals[2]]} quote={null} />)

    expect(() => fireEvent.click(screen.getByRole('button', { name: 'Price sensitive' }))).not.toThrow()
    expect(screen.queryByTestId('chip-evidence')).not.toBeInTheDocument()
  })

  // ── High-severity treatment ────────────────────────────────────────────────

  it('high-severity label gets a distinguishing data attribute', () => {
    render(<ProfilePanel profile={profile} signals={signals} quote={null} />)

    const highBtn = screen.getByRole('button', { name: 'Multi quote risk · High' })
    const highChip = highBtn.closest('[data-high-severity]')
    expect(highChip).not.toBeNull()

    const normalBtn = screen.getByRole('button', { name: 'Price sensitive' })
    const normalChip = normalBtn.closest('[data-high-severity]')
    expect(normalChip).toBeNull()
  })

  // ── Auto-demo ──────────────────────────────────────────────────────────────

  it('auto-demo expands the first negotiation chip with evidence after 600ms', () => {
    render(<ProfilePanel profile={profile} signals={signals} quote={null} />)

    // Before timer fires — evidence not in DOM
    expect(screen.queryByText('We are checking other companies')).not.toBeInTheDocument()

    act(() => { vi.advanceTimersByTime(700) })

    expect(screen.getByText('We are checking other companies')).toBeInTheDocument()
  })

  it('auto-demo collapses chips after ~3 seconds', () => {
    render(<ProfilePanel profile={profile} signals={signals} quote={null} />)

    act(() => { vi.advanceTimersByTime(700) })
    expect(screen.getByText('We are checking other companies')).toBeInTheDocument()

    // Advance past the collapse timer (3900ms from mount; total here: 700 + 3300 = 4000ms)
    act(() => { vi.advanceTimersByTime(3300) })
    expect(screen.queryByText('We are checking other companies')).not.toBeInTheDocument()
  })

  test('user interaction cancels auto-demo', () => {
    render(<ProfilePanel profile={profile} signals={signals} quote={null} />)

    // User clicks a chip before auto-demo fires — cancels auto-demo
    fireEvent.click(screen.getByRole('button', { name: 'Peace of mind' }))

    // Advance past all auto-demo timers
    act(() => { vi.advanceTimersByTime(5000) })

    // The chip the user clicked should be expanded (user action)
    expect(screen.getByText('We want to be energy independent')).toBeInTheDocument()
    // The negotiation auto-demo chip should NOT have been auto-expanded
    expect(screen.queryByText('We are checking other companies')).not.toBeInTheDocument()
  })
})
