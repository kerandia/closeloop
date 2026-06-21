import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RecommendationCard, type RecommendationCardProps } from './RecommendationCard'
import type { Recommendation } from '../../api/types'

const mockRec: Recommendation = {
  id: 'rec-1',
  channel: 'email',
  timing_at: null,
  timing_label: 'within 48h',
  goal: 'Re-engage stalled deal',
  rationale: 'Customer has been silent for 5 days after receiving the quote.',
  play_key: null,
  priority: 1,
  status: 'pending',
}

function renderCard(overrides: Partial<RecommendationCardProps> = {}) {
  render(<RecommendationCard recommendation={mockRec} {...overrides} />)
}

describe('RecommendationCard', () => {
  test('renders channel + timing headline', () => {
    renderCard()
    expect(screen.getByText(/email/i)).toBeInTheDocument()
    expect(screen.getByText(/within 48h/i)).toBeInTheDocument()
  })

  test('renders rationale text', () => {
    renderCard()
    expect(screen.getByText(/silent for 5 days/i)).toBeInTheDocument()
  })

  test('is info-only — no actions or executor toggle', () => {
    renderCard()
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /dismiss/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: /executes/i })).not.toBeInTheDocument()
  })

  test('null recommendation shows empty state', () => {
    renderCard({ recommendation: null })
    expect(screen.getByText(/no active recommendation/i)).toBeInTheDocument()
  })
})
