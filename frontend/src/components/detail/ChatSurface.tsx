/**
 * ChatSurface — the middle column for messaging channels (WhatsApp / SMS / Telegram).
 *
 * DEMO ONLY. Not wired to any provider. Renders a messenger-styled chat with the
 * demo opening messages plus any locally-appended outgoing bubbles, and a real-
 * looking input that only mutates local state (no real send). The draft is
 * controlled by the parent so the right-column "Use this reply" can fill it.
 */
import type { Channel } from '../../api/types'
import './ChatSurface.css'

export interface ChatMessage {
  id: string
  from: 'rep' | 'customer'
  text: string
}

type ChatChannel = 'whatsapp' | 'sms' | 'telegram'

interface Brand {
  name: string
  header: string
  accent: string
  out: string
  wallpaper: string
}

// Per-channel theming — keeps each messenger recognisable.
const BRAND: Record<ChatChannel, Brand> = {
  whatsapp: { name: 'WhatsApp', header: '#075e54', accent: '#25d366', out: '#d9fdd3', wallpaper: '#efeae2' },
  sms: { name: 'SMS', header: '#0b66d0', accent: '#1f6feb', out: '#d6e6ff', wallpaper: '#f0f2f5' },
  telegram: { name: 'Telegram', header: '#2aabee', accent: '#2aabee', out: '#cfeaff', wallpaper: '#eef3f7' },
}

interface Props {
  channel: Channel
  customerName: string
  initialMessages: ChatMessage[]
  draft: string
  onDraftChange: (value: string) => void
  onSend: () => void
  /** Locally-appended outgoing bubbles (from the rep clicking Send). */
  sentMessages: ChatMessage[]
}

export function ChatSurface({
  channel,
  customerName,
  initialMessages,
  draft,
  onDraftChange,
  onSend,
  sentMessages,
}: Props) {
  const brand = BRAND[(channel as ChatChannel)] ?? BRAND.whatsapp
  const messages = [...initialMessages, ...sentMessages]
  const initials = customerName
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (draft.trim()) onSend()
  }

  const themeVars = {
    '--chat-header': brand.header,
    '--chat-accent': brand.accent,
    '--chat-out': brand.out,
    '--chat-wallpaper': brand.wallpaper,
  } as React.CSSProperties

  return (
    <section className="chat-surface" data-slot="chat-surface" style={themeVars}>
      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <header className="chat-surface__header">
        <span className="chat-surface__avatar">{initials || '·'}</span>
        <span className="chat-surface__peer">
          <span className="chat-surface__name">{customerName}</span>
          <span className="chat-surface__brand">{brand.name} · online</span>
        </span>
      </header>

      {/* ── Message area ─────────────────────────────────────────────────────── */}
      <div className="chat-surface__messages">
        {messages.map((m, i) => (
          <div
            key={m.id}
            className={`chat-bubble chat-bubble--${m.from === 'rep' ? 'out' : 'in'}`}
          >
            <p className="chat-bubble__text">{m.text}</p>
            <span className="chat-bubble__meta">
              12:0{i + 2}
              {m.from === 'rep' && <span className="chat-bubble__ticks" aria-hidden="true"> ✓✓</span>}
            </span>
          </div>
        ))}
      </div>

      {/* ── Input row (looks real; local-only) ───────────────────────────────── */}
      <form className="chat-surface__input" onSubmit={handleSubmit}>
        <input
          type="text"
          className="chat-surface__field"
          placeholder="Type a message"
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          aria-label="Message"
        />
        <button
          type="submit"
          className="chat-surface__send"
          aria-label="Send"
          disabled={!draft.trim()}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path fill="currentColor" d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </form>
    </section>
  )
}
