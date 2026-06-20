import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RecommendationCard, type RecommendationCardProps } from './RecommendationCard'
import type { Recommendation, Customer, RecStatus } from '../../api/types'

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

const mockCustomer: Customer = {
  id: 'cust-1',
  name: 'Familie Müller',
  email: 'mueller@example.com',
  phone: null,
  address: {},
  language: 'de',
  stage: 'quoted',
  sign_likelihood: 72,
  ghost_risk: 'medium',
  last_contact_at: null,
  next_action_at: null,
  consent_voice: false,
  consent_marketing: true,
}

function renderCard(overrides: Partial<Omit<RecommendationCardProps, 'onApprove' | 'onDismiss'>> = {}) {
  const onApprove = vi.fn()
  const onDismiss = vi.fn()
  render(
    <RecommendationCard
      recommendation={mockRec}
      customer={mockCustomer}
      onApprove={onApprove}
      onDismiss={onDismiss}
      status={null}
      {...overrides}
    />,
  )
  return { onApprove, onDismiss }
}

describe('RecommendationCard', () => {
  test('renders channel + timing headline', () => {
    renderCard()
    // Headline contains channel name and timing_label
    expect(screen.getByText(/email/i)).toBeInTheDocument()
    expect(screen.getByText(/within 48h/i)).toBeInTheDocument()
  })

  test('renders rationale text', () => {
    renderCard()
    expect(screen.getByText(/silent for 5 days/i)).toBeInTheDocument()
  })

  test('Approve button calls onApprove with rec id', () => {
    const { onApprove } = renderCard()
    fireEvent.click(screen.getByRole('button', { name: /approve/i }))
    expect(onApprove).toHaveBeenCalledOnce()
    expect(onApprove).toHaveBeenCalledWith('rec-1')
  })

  test('Dismiss button calls onDismiss with rec id', () => {
    const { onDismiss } = renderCard()
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(onDismiss).toHaveBeenCalledOnce()
    expect(onDismiss).toHaveBeenCalledWith('rec-1')
  })

  test('visit channel forces Rep-executes and disables AI option', () => {
    renderCard({ recommendation: { ...mockRec, channel: 'visit' } })
    const aiRadio = screen.getByRole('radio', { name: /ai executes/i })
    expect(aiRadio).toBeDisabled()
    const repRadio = screen.getByRole('radio', { name: /rep executes/i })
    expect(repRadio).toBeChecked()
  })

  test('status=approved shows composing state and disables approve button', () => {
    renderCard({ status: 'approved' as RecStatus })
    expect(screen.getByText(/composing/i)).toBeInTheDocument()
    const approveBtn = screen.getByRole('button', { name: /composing/i })
    expect(approveBtn).toBeDisabled()
  })

  test('status=sent shows sent state and hides Approve and Dismiss', () => {
    renderCard({ status: 'sent' as RecStatus })
    expect(screen.getByText(/sent/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /dismiss/i })).not.toBeInTheDocument()
  })

  test('null recommendation shows empty state', () => {
    renderCard({ recommendation: null })
    expect(screen.getByText(/no active recommendation/i)).toBeInTheDocument()
  })
})
