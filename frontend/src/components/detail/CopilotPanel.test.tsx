/**
 * CopilotPanel tests — TDD, fake timers.
 *
 * Covers:
 *   1. copilotRespond called with correct {customer_id, utterance}
 *   2. read + all exact_lines + why render after full reveal
 *   3. copy button triggers navigator.clipboard.writeText with the line text
 *   4. "Suggest next question" calls copilotCollect and renders the question
 */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { CopilotPanel } from './CopilotPanel'
import { copilotRespond, copilotCollect } from '../../api/client'
import type { RespondOutput } from '../../api/types'

vi.mock('../../api/client', () => ({
  copilotRespond: vi.fn(),
  copilotCollect: vi.fn(),
  isMockMode: vi.fn().mockReturnValue(false),
  listCopilotSuggestions: vi.fn().mockResolvedValue([]),
  subscribeCopilot: vi.fn().mockReturnValue(() => {}),
  whatsappSend: vi.fn().mockResolvedValue({ ok: true, within_window: true, provider: {} }),
}))

const FIXED_RESPOND: RespondOutput = {
  read: 'Classic multi-quote stall.',
  type: 'objection',
  tone: 'warm, reassuring',
  exact_lines: ['Line one to say.', 'Line two to say.', 'Line three.'],
  why: 'Because trust matters.',
}

describe('CopilotPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(copilotRespond).mockResolvedValue(FIXED_RESPOND)
    vi.mocked(copilotCollect).mockResolvedValue({ question: 'What concerns do you have?' })
    // jsdom doesn't ship clipboard — stub it
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.runAllTimers()
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  /** Type into the utterance field and click Submit. */
  function submitUtterance(text: string) {
    fireEvent.change(
      screen.getByPlaceholderText(/what did the customer just say/i),
      { target: { value: text } },
    )
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))
  }

  /**
   * Flush the copilotRespond promise then advance fake timers far enough
   * to complete the entire read → lines → why reveal sequence.
   */
  async function advanceToComplete() {
    // One `act` pass lets the await inside handleSubmit resume and
    // schedules the first reveal timer.
    await act(async () => {})
    // Advance well past all phases: 1200ms read + (N-1)*250ms lines + 350ms why.
    act(() => { vi.advanceTimersByTime(5000) })
  }

  // ── 1. API call ──────────────────────────────────────────────────────────────
  test('calls copilotRespond with customer_id and utterance on submit', async () => {
    render(<CopilotPanel customerId="cid" />)
    submitUtterance('I need to compare prices')

    await act(async () => {})

    expect(vi.mocked(copilotRespond)).toHaveBeenCalledWith({
      customer_id: 'cid',
      utterance: 'I need to compare prices',
    })
  })

  // ── 2. Full reveal ───────────────────────────────────────────────────────────
  test('renders read, all exact_lines, and why after full reveal', async () => {
    render(<CopilotPanel customerId="cid" />)
    submitUtterance('test utterance')
    await advanceToComplete()

    expect(screen.getByText('Classic multi-quote stall.')).toBeInTheDocument()
    expect(screen.getByText('Line one to say.')).toBeInTheDocument()
    expect(screen.getByText('Line two to say.')).toBeInTheDocument()
    expect(screen.getByText('Line three.')).toBeInTheDocument()
    expect(screen.getByText('Because trust matters.')).toBeInTheDocument()
  })

  // ── 3. Copy button ───────────────────────────────────────────────────────────
  test('copy button calls navigator.clipboard.writeText with the line text', async () => {
    render(<CopilotPanel customerId="cid" />)
    submitUtterance('test')
    await advanceToComplete()

    const copyButtons = screen.getAllByRole('button', { name: /copy/i })
    expect(copyButtons).toHaveLength(FIXED_RESPOND.exact_lines.length)

    fireEvent.click(copyButtons[0])
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Line one to say.')

    fireEvent.click(copyButtons[1])
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Line two to say.')
  })

  // ── 4. Collect flow ──────────────────────────────────────────────────────────
  test('Suggest next question calls copilotCollect and renders the returned question', async () => {
    render(<CopilotPanel customerId="cid" />)

    fireEvent.click(screen.getByRole('button', { name: /suggest next question/i }))

    await act(async () => {})

    expect(vi.mocked(copilotCollect)).toHaveBeenCalledWith('cid')
    expect(screen.getByText('What concerns do you have?')).toBeInTheDocument()
  })
})
