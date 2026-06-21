import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatWindow } from './ChatWindow'
import type { Interaction } from '../../api/types'

// Mock the API client
vi.mock('../../api/client', () => ({
  listCopilotSuggestions: vi.fn().mockResolvedValue([]),
  subscribeCopilot: vi.fn().mockReturnValue(() => {}),
  messagingSend: vi.fn(),
  composeDraft: vi.fn().mockResolvedValue(null),
  generateClosingKit: vi.fn(),
}))

describe('ChatWindow Component', () => {
  const mockCustomerId = 'cust-123'
  const mockInteractions: Interaction[] = [
    {
      id: 'int-1',
      rep_id: null,
      channel: 'whatsapp',
      direction: 'inbound',
      occurred_at: '2024-01-01T10:00:00Z',
      content: 'Hello, I am interested',
      transcript_md: null,
      recording_url: null,
      outcome: null,
      rep_gut_feel: null,
      created_by: 'system',
    },
    {
      id: 'int-2',
      rep_id: null,
      channel: 'whatsapp',
      direction: 'outbound',
      occurred_at: '2024-01-01T10:05:00Z',
      content: 'Great! Let me help you.',
      transcript_md: null,
      recording_url: null,
      outcome: null,
      rep_gut_feel: null,
      created_by: 'rep-1',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders chat bubbles from interactions', () => {
    render(
      <ChatWindow
        customerId={mockCustomerId}
        channel="whatsapp"
        interactions={mockInteractions}
      />
    )

    expect(screen.getByText('Hello, I am interested')).toBeInTheDocument()
    expect(screen.getByText('Great! Let me help you.')).toBeInTheDocument()
  })

  test('filters interactions by channel', () => {
    const mixedInteractions: Interaction[] = [
      ...mockInteractions,
      {
        id: 'int-3',
        rep_id: null,
        channel: 'sms',
        direction: 'inbound',
        occurred_at: '2024-01-01T11:00:00Z',
        content: 'SMS message',
        transcript_md: null,
        recording_url: null,
        outcome: null,
        rep_gut_feel: null,
        created_by: 'system',
      },
    ]

    render(
      <ChatWindow
        customerId={mockCustomerId}
        channel="whatsapp"
        interactions={mixedInteractions}
      />
    )

    expect(screen.getByText('Hello, I am interested')).toBeInTheDocument()
    expect(screen.queryByText('SMS message')).not.toBeInTheDocument()
  })

  test('renders inbound bubbles on the left and outbound on the right', () => {
    const { container } = render(
      <ChatWindow
        customerId={mockCustomerId}
        channel="whatsapp"
        interactions={mockInteractions}
      />
    )

    const inboundBubble = container.querySelector('.chat-bubble--inbound')
    const outboundBubble = container.querySelector('.chat-bubble--outbound')

    expect(inboundBubble).toBeInTheDocument()
    expect(outboundBubble).toBeInTheDocument()
  })

  test('renders channel title', () => {
    render(
      <ChatWindow
        customerId={mockCustomerId}
        channel="whatsapp"
        interactions={mockInteractions}
      />
    )

    expect(screen.getByText('WhatsApp')).toBeInTheDocument()
  })
})
