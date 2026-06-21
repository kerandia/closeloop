import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ComposeDrawer } from './ComposeDrawer'
import type { Message, Interaction } from '../../api/types'

vi.mock('../../api/client', () => ({
  patchMessage: vi.fn(),
  sendMessage: vi.fn(),
}))

import * as client from '../../api/client'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const mockEmailMessage: Message = {
  id: 'msg-1',
  recommendation_id: 'rec-1',
  customer_id: 'cust-1',
  channel: 'email',
  subject: 'Test Subject',
  body: 'Test body text',
  language: 'en',
  status: 'draft',
  sent_at: null,
}

const mockSmsMessage: Message = {
  id: 'msg-2',
  recommendation_id: 'rec-1',
  customer_id: 'cust-1',
  channel: 'sms',
  subject: null,
  body: 'Test SMS body',
  language: 'en',
  status: 'draft',
  sent_at: null,
}

const mockInteraction: Interaction = {
  id: 'int-1',
  rep_id: null,
  channel: 'email',
  direction: 'outbound',
  occurred_at: new Date().toISOString(),
  content: 'Test body text',
  transcript_md: null,
  recording_url: null,
  outcome: null,
  rep_gut_feel: null,
  created_by: 'system',
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ComposeDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(client.patchMessage).mockResolvedValue(mockEmailMessage)
    vi.mocked(client.sendMessage).mockResolvedValue({
      ok: true,
      provider: {},
      interaction: mockInteraction,
    })
  })

  test('closed renders nothing', () => {
    const { container } = render(
      <ComposeDrawer
        open={false}
        message={mockEmailMessage}
        onClose={vi.fn()}
        onSent={vi.fn()}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  test('open with null message shows composing state', () => {
    render(
      <ComposeDrawer open={true} message={null} onClose={vi.fn()} onSent={vi.fn()} />,
    )
    expect(screen.getByTestId('composing-state')).toBeInTheDocument()
  })

  test('email message renders subject field prefilled', () => {
    render(
      <ComposeDrawer open={true} message={mockEmailMessage} onClose={vi.fn()} onSent={vi.fn()} />,
    )
    expect(screen.getByDisplayValue('Test Subject')).toBeInTheDocument()
  })

  test('email message renders body textarea prefilled', () => {
    render(
      <ComposeDrawer open={true} message={mockEmailMessage} onClose={vi.fn()} onSent={vi.fn()} />,
    )
    expect(screen.getByDisplayValue('Test body text')).toBeInTheDocument()
  })

  test('non-email message hides subject field', () => {
    render(
      <ComposeDrawer open={true} message={mockSmsMessage} onClose={vi.fn()} onSent={vi.fn()} />,
    )
    expect(screen.queryByLabelText(/subject/i)).not.toBeInTheDocument()
  })

  test('editing body and blur calls patchMessage with new body', async () => {
    render(
      <ComposeDrawer open={true} message={mockEmailMessage} onClose={vi.fn()} onSent={vi.fn()} />,
    )
    const bodyField = screen.getByDisplayValue('Test body text')
    fireEvent.change(bodyField, { target: { value: 'Updated body' } })
    fireEvent.blur(bodyField)
    await waitFor(() => {
      expect(client.patchMessage).toHaveBeenCalledWith('msg-1', { body: 'Updated body' })
    })
  })

  test('Send button calls sendMessage then onSent with the returned interaction', async () => {
    const onSent = vi.fn()
    render(
      <ComposeDrawer open={true} message={mockEmailMessage} onClose={vi.fn()} onSent={onSent} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^send$/i }))
    await waitFor(() => {
      expect(client.sendMessage).toHaveBeenCalledWith('msg-1')
      expect(onSent).toHaveBeenCalledWith(mockInteraction)
    })
  })

  test('Send clears the sending state after success (button not stuck on "Sending…")', async () => {
    render(
      <ComposeDrawer open={true} message={mockEmailMessage} onClose={vi.fn()} onSent={vi.fn()} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^send$/i }))
    // After the send resolves, the button returns to an enabled "Send" — not "Sending…".
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /^send$/i })
      expect(btn).not.toBeDisabled()
    })
  })

  test('Send waits for an in-flight blur PATCH before posting (no race)', async () => {
    let resolvePatch!: () => void
    vi.mocked(client.patchMessage).mockImplementation(
      () => new Promise((res) => { resolvePatch = () => res(mockEmailMessage) }),
    )
    const onSent = vi.fn()
    render(
      <ComposeDrawer open={true} message={mockEmailMessage} onClose={vi.fn()} onSent={onSent} />,
    )

    const bodyField = screen.getByDisplayValue('Test body text')
    fireEvent.change(bodyField, { target: { value: 'Edited body' } })
    fireEvent.blur(bodyField) // PATCH starts but stays in-flight
    fireEvent.click(screen.getByRole('button', { name: /^send$/i }))

    // Let microtasks flush — Send must still be waiting on the PATCH
    await new Promise((r) => setTimeout(r, 0))
    expect(client.sendMessage).not.toHaveBeenCalled()

    resolvePatch() // PATCH settles → queue drains → send proceeds
    await waitFor(() => {
      expect(client.sendMessage).toHaveBeenCalledWith('msg-1')
      expect(onSent).toHaveBeenCalledWith(mockInteraction)
    })
  })

  test('send failure shows inline error and keeps draft visible', async () => {
    vi.mocked(client.sendMessage).mockRejectedValue(new Error('Network error'))
    render(
      <ComposeDrawer open={true} message={mockEmailMessage} onClose={vi.fn()} onSent={vi.fn()} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^send$/i }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
    // Draft body still visible
    expect(screen.getByDisplayValue('Test body text')).toBeInTheDocument()
  })
})
