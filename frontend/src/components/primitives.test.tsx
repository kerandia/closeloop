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
    expect(container.querySelector('[data-band="warm"]')).toBeTruthy()
  })
  test('shows a trend arrow when trending', () => {
    const { container } = render(<ScoreBar value={74} trend="up" />)
    expect(container.querySelector('.scorebar__trend--up')).toBeTruthy()
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

describe('ScoreBar reason chip', () => {
  test('renders reason text when provided', () => {
    render(<ScoreBar value={74} reason="+18 · agreed to a home visit" />)
    expect(screen.getByText('+18 · agreed to a home visit')).toBeInTheDocument()
  })
  test('renders nothing when reason is absent', () => {
    const { container } = render(<ScoreBar value={74} />)
    expect(container.querySelector('.scorebar__reason')).toBeNull()
  })
})

describe('GhostRiskPill', () => {
  test('renders the risk level', () => {
    render(<GhostRiskPill risk="high" />)
    expect(screen.getByText(/high/i)).toBeInTheDocument()
  })
})
