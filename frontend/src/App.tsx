import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { AppShell } from './components/AppShell'
import { Dashboard } from './pages/Dashboard'
import { CustomerDetailPage } from './pages/CustomerDetailPage'
import { Sandbox } from './pages/Sandbox'

const slide = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 },
  transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const },
}

export default function App() {
  const location = useLocation()
  return (
    <AppShell goingQuiet={3}>
      <AnimatePresence mode="wait">
        <motion.div key={location.pathname} {...slide}>
          <Routes location={location}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/customers/:id" element={<CustomerDetailPage />} />
            <Route path="/sandbox" element={<Sandbox />} />
          </Routes>
        </motion.div>
      </AnimatePresence>
    </AppShell>
  )
}
