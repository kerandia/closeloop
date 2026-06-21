/**
 * EmailSurface — the middle column for the email channel. DEMO ONLY.
 *
 * A real-looking email composer (To / Subject / Body). The body is controlled by
 * the parent so the right-column "Use this draft" can fill it. Nothing is sent.
 */
import './EmailSurface.css'

interface Props {
  to: string
  subject: string
  body: string
  onBodyChange: (value: string) => void
}

export function EmailSurface({ to, subject, body, onBodyChange }: Props) {
  return (
    <section className="email-surface" data-slot="email-surface">
      <header className="email-surface__header">
        <span className="email-surface__brand">✉ Email draft</span>
      </header>

      <div className="email-surface__fields">
        <div className="email-surface__row">
          <span className="email-surface__label">To</span>
          <span className="email-surface__value">{to}</span>
        </div>
        <div className="email-surface__row">
          <span className="email-surface__label">Subject</span>
          <span className="email-surface__value email-surface__value--subject">{subject}</span>
        </div>
      </div>

      <textarea
        className="email-surface__body"
        value={body}
        onChange={(e) => onBodyChange(e.target.value)}
        placeholder="Write your message…"
        aria-label="Email body"
      />

      <div className="email-surface__footer">
        <button type="button" className="email-surface__send" disabled={!body.trim()}>
          Send email
        </button>
        <span className="email-surface__hint">Demo only — not actually sent.</span>
      </div>
    </section>
  )
}
