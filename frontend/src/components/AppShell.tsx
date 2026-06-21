import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { withMock } from '../lib/nav'
import './AppShell.css'

interface Props {
  children: ReactNode
  /** ghost-radar count: customers going quiet */
  goingQuiet?: number
}

export function AppShell({ children, goingQuiet = 0 }: Props) {
  // Rep (Pipeline) and team-lead (Management) are two personas; expose both so
  // the manager view is reachable from the rep dashboard, not only once you're
  // already on it.
  return (
    <div className="shell">
      <header className="shell__bar">
        <Link to={withMock('/')} className="shell__brand">
          Close<span>Loop</span>
        </Link>
        <nav className="shell__nav">
          <NavLink
            to={withMock('/app')}
            end
            className={({ isActive }) =>
              `shell__nav-link${isActive ? ' shell__nav-link--active' : ''}`
            }
          >
            Pipeline
          </NavLink>
          <NavLink
            to={withMock('/app/management')}
            className={({ isActive }) =>
              `shell__nav-link${isActive ? ' shell__nav-link--active' : ''}`
            }
          >
            Management
          </NavLink>
        </nav>
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
