import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConversationPanel } from './ConversationPanel'
import type { Customer, Recommendation } from '../../api/types'

// Neutralize child-component API effects (CoachingCard / ChatWindow).
vi.mock('../../api/client', () => ({
  copilotRespond: vi.fn(),
  copilotCollect: vi.fn(),
  listCopilotSuggestions: vi.fn().mockResolvedValue([]),
  subscribeCopilot: vi.fn().mockReturnValue(() => {}),
  messagingSend: vi.fn(),
  isMockMode: () => true, // exercise the full channel set incl. telegram
}))

const customer = { id: 'c1', name: 'Familie Müller' } as Customer
const rec = { id: 'r1', channel: 'visit', goal: 'Book a home visit' } as Recommendation

function setup(overrides = {}) {
  const onSelectChannel = vi.fn()
  const onLogCall = vi.fn()
  const onClose = vi.fn()
  render(
    <ConversationPanel
      activeChannel={null}
      recommendedChannel="visit"
      recommendation={rec}
      onSelectChannel={onSelectChannel}
      customerId="c1"
      customer={customer}
      interactions={[]}
      onLogCall={onLogCall}
      emailComposing={false}
      onComposeEmail={vi.fn()}
      onClose={onClose}
      {...overrides}
    />,
  )
  return { onSelectChannel, onLogCall, onClose }
}

describe('ConversationPanel', () => {
  beforeEach(() => vi.clearAllMocks())

  test('shows every channel and badges the recommended one', () => {
    setup()
    // All seven channels render in the rail.
    ;['AI call', 'Rep call', 'WhatsApp', 'SMS', 'Telegram', 'Email', 'Visit'].forEach(
      (label) => expect(screen.getByText(label)).toBeInTheDocument(),
    )
    expect(screen.getByText('Recommended')).toBeInTheDocument()
  })

  test('recommended channel chip comes first', () => {
    const { container } = render(
      <ConversationPanel
        activeChannel={null}
        recommendedChannel="visit"
        recommendation={rec}
        onSelectChannel={vi.fn()}
        customerId="c1"
        customer={customer}
        interactions={[]}
        onLogCall={vi.fn()}
        emailComposing={false}
        onComposeEmail={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    const first = container.querySelector('.conversation-rail__chip')
    expect(first?.textContent).toContain('Visit')
    expect(first?.className).toContain('conversation-rail__chip--recommended')
  })

  test('selecting a channel fires onSelectChannel', () => {
    const { onSelectChannel } = setup()
    fireEvent.click(screen.getByText('WhatsApp'))
    expect(onSelectChannel).toHaveBeenCalledWith('whatsapp')
  })

  test('email surface needs an explicit compose action (no approve on browse)', () => {
    const onComposeEmail = vi.fn()
    setup({ activeChannel: 'email', onComposeEmail })
    const btn = screen.getByText('Compose email draft')
    fireEvent.click(btn)
    expect(onComposeEmail).toHaveBeenCalledTimes(1)
  })

  test('voice_ai surface renders transcript turns and logs the call', () => {
    const { onLogCall } = setup({ activeChannel: 'voice_ai' })
    // Parsed transcript turn from the mock fallback.
    expect(screen.getAllByText('Agent').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByText(/Log call/))
    expect(onLogCall).toHaveBeenCalledWith('voice_ai', expect.stringContaining('**Agent:**'))
  })

  test('surface view hides the picker and Back returns to the info card', () => {
    const { onClose } = setup({ activeChannel: 'voice_ai' })
    // Picker chips are not shown while a surface is active.
    expect(screen.queryByText('WhatsApp')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText(/Back/))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
