import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { TodoList } from './TodoList'

describe('TodoList', () => {
  test('renders the section header as "To-dos"', () => {
    render(<TodoList />)
    expect(screen.getByText('To-dos')).toBeInTheDocument()
  })

  test('renders a card per hardcoded to-do with concrete titles', () => {
    render(<TodoList />)
    expect(screen.getByText('Call back the Müllers')).toBeInTheDocument()
    expect(
      screen.getByText('Send the monthly-savings one-pager + warranty comparison'),
    ).toBeInTheDocument()
    expect(screen.getByText('Book a home visit within 48h')).toBeInTheDocument()
  })

  test('shows channel chips, explicit due windows, and why lines', () => {
    render(<TodoList />)
    expect(screen.getByText('Call')).toBeInTheDocument()
    expect(screen.getByText('Tue · after 17:00')).toBeInTheDocument()
    expect(
      screen.getByText('Customer asked for a callback; both spouses are around after 6.'),
    ).toBeInTheDocument()
  })

  test('shows Confirmed and Suggested status badges', () => {
    render(<TodoList />)
    expect(screen.getByText('Confirmed')).toBeInTheDocument()
    expect(screen.getAllByText('Suggested').length).toBe(2)
  })

  test('sorts soonest-first (callback before visit)', () => {
    render(<TodoList />)
    const titles = screen
      .getAllByRole('heading', { level: 4 })
      .map((h) => h.textContent)
    expect(titles[0]).toBe('Call back the Müllers')
    expect(titles[titles.length - 1]).toBe('Book a home visit within 48h')
  })

  test('Mark done toggles the card to done and back', () => {
    render(<TodoList />)
    const card = screen.getByText('Call back the Müllers').closest('.todo-card')!
    const btn = within(card as HTMLElement).getByText('Mark done')
    fireEvent.click(btn)
    expect(card).toHaveAttribute('data-done', 'true')
    expect(within(card as HTMLElement).getByText('Undo')).toBeInTheDocument()
    fireEvent.click(within(card as HTMLElement).getByText('Undo'))
    expect(card).not.toHaveAttribute('data-done', 'true')
  })

  test('Open transcript scrolls the interactions timeline into view', () => {
    // jsdom has no scrollIntoView by default — stub it on a stand-in element.
    const el = document.createElement('div')
    el.className = 'interaction-timeline'
    const scrollSpy = vi.fn()
    el.scrollIntoView = scrollSpy
    document.body.appendChild(el)

    render(<TodoList />)
    fireEvent.click(screen.getAllByText('Open transcript')[0])
    expect(scrollSpy).toHaveBeenCalled()

    document.body.removeChild(el)
  })
})
