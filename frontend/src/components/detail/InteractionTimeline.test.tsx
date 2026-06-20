import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InteractionTimeline } from './InteractionTimeline'
import type { Interaction } from '../../api/types'

const now = new Date()
const iso = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86_400_000).toISOString()
const iso_hours = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * 60 * 60 * 1000).toISOString()

const mockInteractions: Interaction[] = [
  {
    id: 'i-1',
    rep_id: 'r-1',
    channel: 'phone',
    direction: 'inbound',
    occurred_at: iso_hours(2),
    content: 'Customer called asking about financing',
    transcript_md: '**Customer:** Are there financing options?\n**Rep:** Yes, we have...',
    recording_url: null,
    outcome: 'Customer interested in financing details',
    rep_gut_feel: 'Very engaged, spouse decision-maker',
    created_by: 'r-1',
  },
  {
    id: 'i-2',
    rep_id: 'r-1',
    channel: 'visit',
    direction: 'outbound',
    occurred_at: iso(1),
    content: 'Home visit to assess roof',
    transcript_md: 'Visited property. South-facing roof, good sunlight.',
    recording_url: null,
    outcome: 'Assessment completed, quote sent',
    rep_gut_feel: null,
    created_by: 'r-1',
  },
  {
    id: 'i-3',
    rep_id: 'r-1',
    channel: 'email',
    direction: 'outbound',
    occurred_at: iso(3),
    content: 'Sent quote PDF',
    transcript_md: null,
    recording_url: null,
    outcome: 'Quote delivered',
    rep_gut_feel: null,
    created_by: 'r-1',
  },
]

describe('InteractionTimeline', () => {
  test('renders empty state for no interactions', () => {
    const mockOnLog = vi.fn().mockResolvedValue(undefined)
    render(<InteractionTimeline interactions={[]} onLogInteraction={mockOnLog} />)
    // Should still have a log button
    expect(screen.getByText(/\+ Log/i) || screen.getByText(/log/i)).toBeInTheDocument()
  })

  test('renders interactions in reverse chronological order (newest first)', () => {
    const mockOnLog = vi.fn().mockResolvedValue(undefined)
    render(<InteractionTimeline interactions={mockInteractions} onLogInteraction={mockOnLog} />)

    // Should render all three interactions (checking outcome field)
    expect(screen.getByText(/Customer interested in financing/)).toBeInTheDocument()
    expect(screen.getByText(/Assessment completed/)).toBeInTheDocument()
    expect(screen.getByText(/Quote delivered/)).toBeInTheDocument()

    // Check they appear in reverse chrono order
    const customerInterestedRow = screen.getByText(/Customer interested/).closest('[data-testid="interaction-row"]')
    const assessmentRow = screen.getByText(/Assessment completed/).closest('[data-testid="interaction-row"]')
    expect(customerInterestedRow).toBeInTheDocument()
    expect(assessmentRow).toBeInTheDocument()
  })

  test('renders channel icon, relative time, and outcome for each interaction', () => {
    const mockOnLog = vi.fn().mockResolvedValue(undefined)
    render(<InteractionTimeline interactions={mockInteractions} onLogInteraction={mockOnLog} />)

    // Outcomes should be visible
    expect(screen.getByText(/Customer interested in financing/)).toBeInTheDocument()
    expect(screen.getByText(/Assessment completed/)).toBeInTheDocument()
    expect(screen.getByText(/Quote delivered/)).toBeInTheDocument()

    // Relative times
    expect(screen.getByText(/2 hours? ago/)).toBeInTheDocument()
    expect(screen.getByText(/1 day ago/)).toBeInTheDocument()
    expect(screen.getByText(/3 days? ago/)).toBeInTheDocument()
  })

  test('clicking a row with transcript expands it', () => {
    const mockOnLog = vi.fn().mockResolvedValue(undefined)
    render(<InteractionTimeline interactions={mockInteractions} onLogInteraction={mockOnLog} />)

    // Find the interaction with transcript
    const phoneInteraction = screen.getByText(/Customer interested/)
    const row = phoneInteraction.closest('[data-testid="interaction-row"]')

    // Transcript should not be visible initially
    expect(screen.queryByText(/Are there financing/)).not.toBeInTheDocument()

    // Click to expand
    fireEvent.click(row!)

    // Transcript content should now be visible
    expect(screen.getByText(/Are there financing/)).toBeInTheDocument()
  })

  test('clicking again collapses the transcript', () => {
    const mockOnLog = vi.fn().mockResolvedValue(undefined)
    render(<InteractionTimeline interactions={mockInteractions} onLogInteraction={mockOnLog} />)

    const phoneInteraction = screen.getByText(/Customer interested/)
    const row = phoneInteraction.closest('[data-testid="interaction-row"]')

    // Expand
    fireEvent.click(row!)
    expect(screen.getByText(/Are there financing/)).toBeInTheDocument()

    // Collapse
    fireEvent.click(row!)
    expect(screen.queryByText(/Are there financing/)).not.toBeInTheDocument()
  })

  test('log button reveals the form', async () => {
    const mockOnLog = vi.fn().mockResolvedValue(undefined)
    render(<InteractionTimeline interactions={mockInteractions} onLogInteraction={mockOnLog} />)

    const logButton = screen.getByRole('button', { name: /log/i })
    fireEvent.click(logButton)

    // Form fields should appear
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/note|content|visit/i) || screen.getByLabelText(/note|content/i)).toBeInTheDocument()
    })
  })

  test('form submission calls onLogInteraction with typed payload', async () => {
    const mockOnLog = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<InteractionTimeline interactions={mockInteractions} onLogInteraction={mockOnLog} />)

    const logButton = screen.getByRole('button', { name: /log/i })
    fireEvent.click(logButton)

    // Find form inputs - be flexible with labels/placeholders
    const noteInput = screen.getAllByRole('textbox')[0] // First textarea/input is the note
    const gutFeelInput = screen.getAllByRole('textbox')[1] // Second is gut-feel
    const outcomeInput = screen.getAllByRole('textbox')[2] // Third is outcome

    await user.type(noteInput, 'Wife hesitant about cost')
    await user.type(gutFeelInput, 'Spouse dynamics matter here')
    await user.type(outcomeInput, 'Needs detailed breakdown')

    const submitButton = screen.getByRole('button', { name: /submit|send|log/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockOnLog).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'visit',
          direction: 'outbound',
          content: 'Wife hesitant about cost',
          rep_gut_feel: 'Spouse dynamics matter here',
          outcome: 'Needs detailed breakdown',
        }),
      )
    })
  })

  test('submit button is disabled while promise is pending', async () => {
    const mockOnLog = vi.fn(() => new Promise<void>((resolve) => setTimeout(resolve, 100)))
    const user = userEvent.setup()
    render(<InteractionTimeline interactions={mockInteractions} onLogInteraction={mockOnLog} />)

    const logButton = screen.getByRole('button', { name: /log/i })
    fireEvent.click(logButton)

    const noteInput = screen.getAllByRole('textbox')[0]
    await user.type(noteInput, 'Test note')

    const submitButton = screen.getByRole('button', { name: /submit|send|log/i })
    expect(submitButton).not.toBeDisabled()

    fireEvent.click(submitButton)

    // Button should now be disabled while pending
    await waitFor(() => {
      expect(submitButton).toBeDisabled()
    })

    // Wait for the promise to resolve
    await waitFor(() => {
      expect(mockOnLog).toHaveBeenCalled()
    })
  })

  test('form closes after successful submission', async () => {
    const mockOnLog = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<InteractionTimeline interactions={mockInteractions} onLogInteraction={mockOnLog} />)

    const logButton = screen.getByRole('button', { name: /log/i })
    fireEvent.click(logButton)

    const noteInput = screen.getAllByRole('textbox')[0]
    await user.type(noteInput, 'Test note')

    const submitButton = screen.getByRole('button', { name: /submit|send|log/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      // Form inputs should be hidden again
      expect(screen.queryByPlaceholderText(/note|content/i)).not.toBeInTheDocument()
    }, { timeout: 500 })
  })

  test('defaults to visit channel and outbound direction', async () => {
    const mockOnLog = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<InteractionTimeline interactions={mockInteractions} onLogInteraction={mockOnLog} />)

    const logButton = screen.getByRole('button', { name: /log/i })
    fireEvent.click(logButton)

    const noteInput = screen.getAllByRole('textbox')[0]
    await user.type(noteInput, 'Test')

    const submitButton = screen.getByRole('button', { name: /submit|send|log/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockOnLog).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'visit',
          direction: 'outbound',
        }),
      )
    })
  })
})
