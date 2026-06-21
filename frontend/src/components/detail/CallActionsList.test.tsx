import { describe, test, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CallActionsList } from './CallActionsList'
import type { ExtractedAction } from '../../api/types'

function createMockActions(): ExtractedAction[] {
  return [
    {
      id: 'a-1',
      interaction_id: null,
      type: 'callback',
      detail: 'Call back after 5pm on Tuesday',
      due_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      status: 'open',
    },
    {
      id: 'a-2',
      interaction_id: null,
      type: 'send_info',
      detail: 'Send quote and financing options',
      due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 1 day from now
      status: 'done',
    },
    {
      id: 'a-3',
      interaction_id: null,
      type: 'schedule_visit',
      detail: 'Schedule home visit',
      due_at: null,
      status: 'open',
    },
  ]
}

describe('CallActionsList', () => {
  test('renders nothing for empty actions array', () => {
    const { container } = render(<CallActionsList actions={[]} />)
    // Should either render nothing or a quiet placeholder
    expect(container.querySelector('[data-testid="call-action-row"]')).not.toBeInTheDocument()
  })

  test('renders a row per action with detail text', () => {
    render(<CallActionsList actions={createMockActions()} />)
    expect(screen.getByText(/Call back after 5pm on Tuesday/)).toBeInTheDocument()
    expect(screen.getByText(/Send quote and financing options/)).toBeInTheDocument()
    expect(screen.getByText(/Schedule home visit/)).toBeInTheDocument()
  })

  test('renders due date using relativeTime', () => {
    render(<CallActionsList actions={createMockActions()} />)
    // First action was due 2 hours ago
    expect(screen.getByText(/2 hours? ago/)).toBeInTheDocument()
    // Third action has no due date - look for "Due: never"
    expect(screen.getByText(/Due: never/)).toBeInTheDocument()
  })

  test('renders status badge for each action', () => {
    render(<CallActionsList actions={createMockActions()} />)
    const openBadges = screen.getAllByText(/open/i)
    const doneBadges = screen.getAllByText(/done/i)
    expect(openBadges.length).toBe(2) // a-1 and a-3
    expect(doneBadges.length).toBe(1) // a-2
  })

  test('clicking status toggle switches between open and done', () => {
    render(<CallActionsList actions={createMockActions()} />)
    const toggleButtons = screen.getAllByRole('button')
    expect(toggleButtons.length).toBeGreaterThan(0)

    // Find the first action's toggle (should show 'open')
    const firstToggle = toggleButtons.find((btn) => btn.textContent?.includes('open'))
    expect(firstToggle).toBeInTheDocument()

    // Click it to flip to done
    fireEvent.click(firstToggle!)
    expect(firstToggle?.textContent).toMatch(/done/i)

    // Click again to flip back to open
    fireEvent.click(firstToggle!)
    expect(firstToggle?.textContent).toMatch(/open/i)
  })

  test('toggle persists local state (no API call required)', () => {
    render(<CallActionsList actions={createMockActions()} />)
    const buttons = screen.getAllByRole('button')
    const firstToggle = buttons.find((btn) => btn.textContent?.includes('open'))

    // Verify initial state
    expect(firstToggle?.textContent).toMatch(/open/i)

    // Toggle to done
    fireEvent.click(firstToggle!)
    expect(firstToggle?.textContent).toMatch(/done/i)

    // Toggle back multiple times to verify it works consistently
    fireEvent.click(firstToggle!)
    expect(firstToggle?.textContent).toMatch(/open/i)
    fireEvent.click(firstToggle!)
    expect(firstToggle?.textContent).toMatch(/done/i)
  })

  test('dismissed actions can be handled (shown or hidden)', () => {
    const mockActions = createMockActions()
    const actionsWithDismissed: ExtractedAction[] = [
      ...mockActions,
      {
        id: 'a-4',
        interaction_id: null,
        type: 'other',
        detail: 'This was dismissed',
        due_at: null,
        status: 'dismissed',
      },
    ]
    const { container } = render(<CallActionsList actions={actionsWithDismissed} />)
    // Should render at least the open/done actions
    const rows = container.querySelectorAll('[data-testid="call-action-row"]')
    expect(rows.length).toBeGreaterThanOrEqual(2)
  })

  test('renders channel label when present', () => {
    const actionsWithChannel: ExtractedAction[] = [
      {
        id: 'a-5',
        interaction_id: null,
        type: 'callback',
        detail: 'Call back next week',
        due_at: null,
        status: 'open',
        channel: 'phone',
      },
    ]
    render(<CallActionsList actions={actionsWithChannel} />)
    expect(screen.getByText(/phone/i)).toBeInTheDocument()
  })

  test('renders why line when present', () => {
    const actionsWithWhy: ExtractedAction[] = [
      {
        id: 'a-6',
        interaction_id: null,
        type: 'send_info',
        detail: 'Send quote',
        due_at: null,
        status: 'open',
        why: 'Customer asked for pricing breakdown',
      },
    ]
    render(<CallActionsList actions={actionsWithWhy} />)
    expect(screen.getByText(/Customer asked for pricing breakdown/)).toBeInTheDocument()
  })

  test('renders channel and why together', () => {
    const actionsWithBoth: ExtractedAction[] = [
      {
        id: 'a-7',
        interaction_id: null,
        type: 'schedule_visit',
        detail: 'Schedule home visit',
        due_at: null,
        status: 'open',
        channel: 'phone',
        why: 'Objection: needs to see system in person',
      },
    ]
    render(<CallActionsList actions={actionsWithBoth} />)
    expect(screen.getByText(/phone/i)).toBeInTheDocument()
    expect(screen.getByText(/Objection: needs to see system in person/)).toBeInTheDocument()
  })

  test('does not render channel or why when absent', () => {
    const basicAction: ExtractedAction[] = [
      {
        id: 'a-8',
        interaction_id: null,
        type: 'callback',
        detail: 'Simple callback',
        due_at: null,
        status: 'open',
      },
    ]
    const { container } = render(<CallActionsList actions={basicAction} />)
    expect(container.querySelector('.call-action-row__channel')).toBeNull()
    expect(container.querySelector('.call-action-row__why')).toBeNull()
  })
})
