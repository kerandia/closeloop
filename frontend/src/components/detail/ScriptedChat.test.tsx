import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ScriptedChat, MULLER_SCRIPT } from './ScriptedChat'

describe('ScriptedChat', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  test('starts empty until Send is clicked', () => {
    render(<ScriptedChat customerName="Familie Müller" />)
    expect(screen.queryByText(/thanks for the quote/)).not.toBeInTheDocument()
    expect(screen.queryByTestId('typing-bubble')).not.toBeInTheDocument()
  })

  test('clicking Send shows a typing bubble, then reveals the first message', () => {
    render(<ScriptedChat customerName="Familie Müller" />)
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    // typing bubble appears immediately (delay starts at t=0 for first line)
    act(() => { vi.advanceTimersByTime(10) })
    expect(screen.getByTestId('typing-bubble')).toBeInTheDocument()

    // after the first line's delay, its message is revealed and typing clears
    act(() => { vi.advanceTimersByTime(MULLER_SCRIPT[0].delay) })
    expect(screen.getByText(/thanks for the quote/)).toBeInTheDocument()
  })

  test('Send is disabled while playing and re-enables when done', () => {
    render(<ScriptedChat customerName="Familie Müller" />)
    const send = screen.getByRole('button', { name: /send/i })
    fireEvent.click(send)
    act(() => { vi.advanceTimersByTime(50) })
    expect(send).toBeDisabled()

    // run the entire script to completion
    act(() => { vi.advanceTimersByTime(60_000) })
    expect(send).not.toBeDisabled()
    // last message present
    expect(screen.getByText(/Thursday after 6 works/)).toBeInTheDocument()
  })

  test('playSignal change triggers playback (right-column "Use this reply")', () => {
    const { rerender } = render(<ScriptedChat customerName="Familie Müller" playSignal={0} />)
    expect(screen.queryByText(/thanks for the quote/)).not.toBeInTheDocument()
    rerender(<ScriptedChat customerName="Familie Müller" playSignal={1} />)
    act(() => { vi.advanceTimersByTime(MULLER_SCRIPT[0].delay + 20) })
    expect(screen.getByText(/thanks for the quote/)).toBeInTheDocument()
  })

  test('the input is read-only', () => {
    render(<ScriptedChat customerName="Familie Müller" />)
    expect(screen.getByLabelText('Message')).toHaveAttribute('readonly')
  })
})
