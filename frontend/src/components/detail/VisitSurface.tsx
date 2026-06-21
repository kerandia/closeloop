/**
 * VisitSurface — the middle column for the home-visit channel. DEMO ONLY.
 *
 * A home-visit isn't a conversation thread, so the middle column is a prep
 * checklist plus a proposed slot — what the rep takes into the room.
 */
import './VisitSurface.css'

interface Props {
  customerName: string
  whenLabel: string
  prep: string[]
}

export function VisitSurface({ customerName, whenLabel, prep }: Props) {
  return (
    <section className="visit-surface" data-slot="visit-surface">
      <header className="visit-surface__header">
        <span className="visit-surface__brand">🏠 Home visit</span>
        <span className="visit-surface__when">{whenLabel}</span>
      </header>

      <div className="visit-surface__body">
        <p className="visit-surface__intro">
          Prep for the visit with <strong>{customerName}</strong>:
        </p>
        <ul className="visit-surface__prep">
          {prep.map((item, i) => (
            <li key={i} className="visit-surface__item">{item}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}
