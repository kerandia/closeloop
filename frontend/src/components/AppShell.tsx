import type { ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { withMock } from '../lib/nav'
import './AppShell.css'

interface Props {
  children: ReactNode
  /** ghost-radar count: customers going quiet */
  goingQuiet?: number
}

export function AppShell({ children, goingQuiet = 0 }: Props) {
  // Management is a separate (team-lead) persona — hide its nav link on the
  // installer/rep pages so the design + business demo flows stay clean.
  const onManagement = useLocation().pathname.startsWith('/app/management')
  return (
    <div className="shell">
      <header className="shell__bar">
        <Link to={withMock('/')} className="shell__brand">
          Close<span>Loop</span>
        </Link>
        <nav className="shell__nav">
          {!onManagement && (
            <NavLink
              to={withMock('/app')}
              end
              className={({ isActive }) =>
                `shell__nav-link${isActive ? ' shell__nav-link--active' : ''}`
              }
            >
              Pipeline
            </NavLink>
          )}
          {onManagement && (
            <NavLink
              to={withMock('/app/management')}
              className={({ isActive }) =>
                `shell__nav-link${isActive ? ' shell__nav-link--active' : ''}`
              }
            >
              Management
            </NavLink>
          )}
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
