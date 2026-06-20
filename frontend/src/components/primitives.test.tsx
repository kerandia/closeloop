import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScoreBar } from './ScoreBar'
import { BuyerTypeChip } from './BuyerTypeChip'
import { GhostRiskPill } from './GhostRiskPill'

describe('ScoreBar', () => {
  test('shows the score number', () => {
    render(<ScoreBar value={74} />)
    expect(screen.getByText('74')).toBeInTheDocument()
  })
  test('exposes the band as data-band', () => {
    const { container } = render(<ScoreBar value={74} />)
    expect(container.querySelector('[data-band="high"]')).toBeTruthy()
  })
  test('null score renders a dash, unknown band', () => {
    const { container } = render(<ScoreBar value={null} />)
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(container.querySelector('[data-band="unknown"]')).toBeTruthy()
  })
})

describe('BuyerTypeChip', () => {
  test('renders the buyer type label', () => {
    render(<BuyerTypeChip type="skeptic" />)
    expect(screen.getByText(/skeptic/i)).toBeInTheDocument()
  })
  test('renders nothing for null', () => {
    const { container } = render(<BuyerTypeChip type={null} />)
    expect(container.firstChild).toBeNull()
  })
})

describe('GhostRiskPill', () => {
  test('renders the risk level', () => {
    render(<GhostRiskPill risk="high" />)
    expect(screen.getByText(/high/i)).toBeInTheDocument()
  })
})
