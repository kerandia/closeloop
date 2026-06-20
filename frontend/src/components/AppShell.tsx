import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import './AppShell.css'

interface Props {
  children: ReactNode
  /** ghost-radar count: customers going quiet */
  goingQuiet?: number
}

export function AppShell({ children, goingQuiet = 0 }: Props) {
  return (
    <div className="shell">
      <header className="shell__bar">
        <Link to="/" className="shell__brand">
          Close<span>Loop</span>
        </Link>
        {goingQuiet > 0 && (
          <span className="shell__radar" title="customers going quiet">
            <span className="shell__radar-dot" />
            {goingQuiet} going quiet
          </span>
        )}
        <span className="shell__rep" title="Lena Brandt">
          LB
        </span>
      </header>
      <main className="shell__stage">{children}</main>
    </div>
  )
}
