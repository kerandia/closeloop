/**
 * ScriptedChat — the WhatsApp middle column as a scripted auto-play demo.
 *
 * DEMO ONLY. Starts empty. Clicking Send (or "Use this reply" in the right column,
 * via playSignal) plays the whole hardcoded Müller conversation: each message is
 * preceded by a "typing…" bubble (left = customer, right = rep), revealed one
 * after another, auto-scrolling to the newest. Send is disabled while playing and
 * re-enables when done, so it can be replayed. Reuses the app's chat-surface
 * styling for visual consistency. No backend.
 */
import { useState, useRef, useEffect } from 'react'
import './ChatSurface.css'

interface ScriptLine {
  from: 'them' | 'me' // them = customer (left), me = rep (right)
  text: string
  delay: number // how long the "typing…" bubble shows before this message (ms)
}

// The Müller demo script — copy kept verbatim.
// eslint-disable-next-line react-refresh/only-export-components -- demo data, shared with tests
export const MULLER_SCRIPT: ScriptLine[] = [
  { from: 'them', text: "Hi Lena — thanks for the quote. Honestly though, it's higher than we expected, and we still want to check a couple of other companies before we decide.", delay: 700 },
  { from: 'me', text: "Totally understand — a decision this big, you should compare a few. One thing worth flagging though: the number to watch isn't really the sticker price, it's how much it takes off that electricity bill every month, for years.", delay: 1900 },
  { from: 'me', text: "Long-term the gap is bigger than it looks on a quote. Let me put the monthly savings on one page and send it Wednesday — and I'll lay the warranty and service side by side so you've got a clear basis to compare. Sound good?", delay: 1900 },
  { from: 'them', text: "Okay, that's helpful. But one thing we keep wondering — does it actually generate much in winter? We're a bit worried it won't do much when it's cold and grey.", delay: 2100 },
  { from: 'me', text: 'Fair question — and honestly, output is lower in winter. But panels run on daylight, not heat, so you still generate on bright cold days, and it balances out across the year.', delay: 2000 },
  { from: 'me', text: 'Rather than me throwing numbers at you, the most honest thing is to look at your actual roof and sun exposure. Could I pop by for 15 minutes and give you a real production estimate for your home?', delay: 2000 },
  { from: 'them', text: 'That makes sense. Yeah, a quick visit would be good — my wife wants to be there too, so maybe one evening this week?', delay: 2100 },
  { from: 'me', text: "Perfect — evenings work great. How's Thursday after 6? I'll bring the savings breakdown and the warranty comparison so you both can see everything in one go.", delay: 1900 },
  { from: 'them', text: 'Thursday after 6 works. See you then 🙂', delay: 1600 },
]

// WhatsApp brand vars consumed by chat-surface.css.
const WA_THEME = {
  '--chat-header': '#075e54',
  '--chat-accent': '#25d366',
  '--chat-out': '#d9fdd3',
  '--chat-wallpaper': '#efeae2',
} as React.CSSProperties

interface Props {
  customerName: string
  /** Increment to start playback from the right column ("Use this reply"). */
  playSignal?: number
}

export function ScriptedChat({ customerName, playSignal = 0 }: Props) {
  const [messages, setMessages] = useState<ScriptLine[]>([])
  const [typingFrom, setTypingFrom] = useState<'them' | 'me' | null>(null)
  const [playing, setPlaying] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const playingRef = useRef(false)

  const initials = customerName
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  // Auto-scroll to the latest message / typing bubble.
  useEffect(() => {
    const el = bodyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, typingFrom])

  // Clear any pending timers on unmount.
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  function play() {
    if (playingRef.current) return
    timers.current.forEach(clearTimeout)
    timers.current = []
    setMessages([])
    setTypingFrom(null)
    setPlaying(true)
    playingRef.current = true

    let t = 0
    MULLER_SCRIPT.forEach((msg) => {
      timers.current.push(setTimeout(() => setTypingFrom(msg.from), t))
      t += msg.delay
      timers.current.push(
        setTimeout(() => {
          setTypingFrom(null)
          setMessages((m) => [...m, msg])
        }, t),
      )
      t += 300 // small pause between messages
    })
    timers.current.push(
      setTimeout(() => {
        setPlaying(false)
        playingRef.current = false
      }, t),
    )
  }

  // External trigger from the right column.
  useEffect(() => {
    if (playSignal > 0) play()
  }, [playSignal])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    play()
  }

  return (
    <section className="chat-surface" data-slot="chat-surface" style={WA_THEME}>
      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <header className="chat-surface__header">
        <span className="chat-surface__avatar">{initials || '·'}</span>
        <span className="chat-surface__peer">
          <span className="chat-surface__name">{customerName}</span>
          <span className="chat-surface__brand">WhatsApp · online</span>
        </span>
      </header>

      {/* ── Messages ─────────────────────────────────────────────────────────── */}
      <div className="chat-surface__messages" ref={bodyRef}>
        {messages.map((m, i) => (
          <div
            key={i}
            className={`chat-bubble chat-bubble--${m.from === 'me' ? 'out' : 'in'}`}
          >
            <p className="chat-bubble__text">{m.text}</p>
          </div>
        ))}
        {typingFrom && (
          <div
            className={`chat-bubble chat-bubble--${typingFrom === 'me' ? 'out' : 'in'} chat-bubble--typing`}
            data-testid="typing-bubble"
            aria-label="typing"
          >
            <span></span>
            <span></span>
            <span></span>
          </div>
        )}
      </div>

      {/* ── Input row (read-only; Send plays the script) ─────────────────────── */}
      <form className="chat-surface__input" onSubmit={handleSubmit}>
        <input
          type="text"
          className="chat-surface__field"
          placeholder="Type a message"
          readOnly
          aria-label="Message"
        />
        <button
          type="submit"
          className="chat-surface__send"
          aria-label="Send"
          disabled={playing}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path fill="currentColor" d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </form>
    </section>
  )
}
