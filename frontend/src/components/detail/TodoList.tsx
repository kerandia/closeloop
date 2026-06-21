/**
 * TodoList — the customer's concrete next steps, as a sorted list of to-do cards.
 *
 * DEMO ONLY: the to-dos are hardcoded (the Müllers). Replaces the old vague
 * "Actions" line. Each card carries a concrete title, a channel chip, an explicit
 * due window (red when overdue), a muted "why" reasoning line, a Confirmed/
 * Suggested status badge, and Mark-done / Open-transcript actions.
 */
import { useState } from 'react'
import type { Channel } from '../../api/types'
import { ChannelIcon } from '../ChannelIcon'
import './TodoList.css'

type TodoStatus = 'confirmed' | 'suggested'

interface Todo {
  id: string
  title: string
  channel: Channel // drives the icon
  channelLabel: string // Call / WhatsApp / Email / Visit
  dueLabel: string // explicit window, e.g. "Tue · after 17:00"
  dueOrder: number // soonest-first sort key
  overdue: boolean
  why: string
  status: TodoStatus
}

// Hardcoded demo to-dos for this customer.
const TODOS: Todo[] = [
  {
    id: 'todo-callback',
    title: 'Call back the Müllers',
    channel: 'phone',
    channelLabel: 'Call',
    dueLabel: 'Tue · after 17:00',
    dueOrder: 1,
    overdue: false,
    why: 'Customer asked for a callback; both spouses are around after 6.',
    status: 'confirmed',
  },
  {
    id: 'todo-onepager',
    title: 'Send the monthly-savings one-pager + warranty comparison',
    channel: 'email',
    channelLabel: 'Email',
    dueLabel: 'Wed · morning',
    dueOrder: 2,
    overdue: false,
    why: "Shift value from sticker price to monthly savings, and get ahead of the competing quotes they're collecting.",
    status: 'suggested',
  },
  {
    id: 'todo-visit',
    title: 'Book a home visit within 48h',
    channel: 'visit',
    channelLabel: 'Visit',
    dueLabel: 'By Thu',
    dueOrder: 3,
    overdue: false,
    why: 'The wife is the blocker — a visit builds trust better than another email.',
    status: 'suggested',
  },
]

// Soonest-first, with overdue items floated to the top.
function sortTodos(todos: Todo[]): Todo[] {
  return [...todos].sort(
    (a, b) => Number(b.overdue) - Number(a.overdue) || a.dueOrder - b.dueOrder,
  )
}

/** The transcript still lives in the interactions timeline — scroll to it. */
function openTranscript(): void {
  document
    .querySelector('.interaction-timeline')
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function TodoList() {
  // Local-only done state (no backend).
  const [done, setDone] = useState<Set<string>>(new Set())

  function toggleDone(id: string) {
    setDone((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="todo-list">
      <h3 className="todo-list__title mono">To-dos</h3>
      <div className="todo-list__cards">
        {sortTodos(TODOS).map((todo) => {
          const isDone = done.has(todo.id)
          return (
            <article
              key={todo.id}
              className="todo-card"
              data-done={isDone ? 'true' : undefined}
              data-status={todo.status}
            >
              <div className="todo-card__head">
                <span className="todo-card__channel">
                  <ChannelIcon channel={todo.channel} size={14} />
                  <span className="todo-card__channel-label">{todo.channelLabel}</span>
                </span>
                <span className={`todo-card__status todo-card__status--${todo.status}`}>
                  {todo.status === 'confirmed' ? 'Confirmed' : 'Suggested'}
                </span>
              </div>

              <h4 className="todo-card__title">{todo.title}</h4>
              <p className="todo-card__why">{todo.why}</p>
              {todo.status === 'suggested' && (
                <p className="todo-card__hint">Not confirmed yet — keep it light.</p>
              )}

              <div className="todo-card__foot">
                <span
                  className={`todo-card__due${todo.overdue ? ' todo-card__due--overdue' : ''}`}
                >
                  {todo.overdue && <span aria-hidden="true">⚠ </span>}
                  {todo.dueLabel}
                </span>
                <div className="todo-card__actions">
                  <button
                    type="button"
                    className="todo-card__done"
                    onClick={() => toggleDone(todo.id)}
                  >
                    {isDone ? 'Undo' : 'Mark done'}
                  </button>
                  <button
                    type="button"
                    className="todo-card__transcript"
                    onClick={openTranscript}
                  >
                    Open transcript
                  </button>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
