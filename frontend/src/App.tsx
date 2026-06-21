import { useEffect, useState } from 'react'
import { Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { AppShell } from './components/AppShell'
import { Dashboard } from './pages/Dashboard'
import { Landing } from './pages/Landing'
import { ManagementPage } from './pages/ManagementPage'

import { Sandbox } from './pages/Sandbox'
import { listCustomers } from './api/client'

/** Real "going quiet" count = customers at high ghost risk. */
function useGoingQuiet(): number {
  const [count, setCount] = useState(0)
  useEffect(() => {
    listCustomers()
      .then((cs) => setCount(cs.filter((c) => c.ghost_risk === 'high').length))
      .catch(() => setCount(0))
  }, [])
  return count
}

const slide = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 },
  transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const },
}

/** The dashboard app, wrapped in the nav shell. Lives behind /app. */
function AppLayout() {
  const location = useLocation()
  const goingQuiet = useGoingQuiet()

  // Prevent full-page animation when transitioning between Dashboard/Management and Customer Drawer
  const isCustomerRoute = location.pathname.startsWith('/app/customers/')
  const isMgmtCustomerRoute = location.pathname.startsWith('/app/management/customers/')
  let pageKey = location.pathname
  if (isCustomerRoute) pageKey = '/app'
  if (isMgmtCustomerRoute) pageKey = '/app/management'

  return (
    <AppShell goingQuiet={goingQuiet}>
      <AnimatePresence mode="wait">
        <motion.div key={pageKey} {...slide}>
          <Routes location={location}>
            <Route path="/app/management/*" element={<ManagementPage />} />
            <Route path="/management/*" element={<Navigate to="/app/management" replace />} />
            <Route path="/app/*" element={<Dashboard />} />
            <Route path="/sandbox" element={<Sandbox />} />
          </Routes>
        </motion.div>
      </AnimatePresence>
    </AppShell>
  )
}

export default function App() {
  const location = useLocation()
  // The landing is the entry screen at "/", with no nav shell. Everything else
  // is the dashboard app behind /app (and /sandbox), rendered in the shell.
  if (location.pathname === '/') return <Landing />
  return <AppLayout />
}
