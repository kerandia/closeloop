import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import type { InteractionLogResponse } from '../api/types'
import { CustomerDetailPage } from './CustomerDetailPage'

// ──────────────────────────────────────────────────────────────────────────────
// Module mock — intercepts every import of src/api/client across all files
// under test (including DetailShell, which lives in components/detail/).
// ──────────────────────────────────────────────────────────────────────────────
vi.mock('../api/client', () => ({
  getCustomer: vi.fn(),
  logInteraction: vi.fn(),
  isMockMode: vi.fn(() => false),
  approveRecommendation: vi.fn(),
  dismissRecommendation: vi.fn(),
  patchMessage: vi.fn(),
  sendMessage: vi.fn(),
  // live co-pilot (CopilotPanel mounts inside the detail shell)
  copilotRespond: vi.fn(),
  copilotCollect: vi.fn(),
  listCopilotSuggestions: vi.fn().mockResolvedValue([]),
  subscribeCopilot: vi.fn().mockReturnValue(() => {}),
  whatsappSend: vi.fn().mockResolvedValue({ ok: true, within_window: true, provider: {} }),
}))

import * as api from '../api/client'
import { mockGetCustomer } from '../mock/muller'

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────
function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/customers/abc']}>
      <Routes>
        <Route path="/customers/:id" element={<CustomerDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────────
describe('CustomerDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.getCustomer).mockResolvedValue(mockGetCustomer())
  })

  // ── Loading + successful render ──────────────────────────────────────────
  describe('loading and render', () => {
    test('shows skeleton while getCustomer is in flight', () => {
      // keep promise forever pending so we can observe the loading state
      vi.mocked(api.getCustomer).mockReturnValue(new Promise(() => {}))
      renderPage()
      expect(screen.getByTestId('detail-skeleton')).toBeInTheDocument()
    })

    test('renders customer name in the header after load', async () => {
      renderPage()
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /familie müller/i })).toBeInTheDocument()
      })
    })

    test('renders the sign-likelihood score after load', async () => {
      renderPage()
      await waitFor(() => {
        // ScoreBar renders the numeric value; initial display = target (74)
        expect(screen.getByText('74')).toBeInTheDocument()
      })
    })
  })

  // ── Error state ──────────────────────────────────────────────────────────
  describe('error state', () => {
    test('shows a Retry button when getCustomer rejects', async () => {
      vi.mocked(api.getCustomer).mockRejectedValue(new Error('Network error'))
      renderPage()
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
      })
    })

    test('refetches and renders name when Retry is clicked', async () => {
      vi.mocked(api.getCustomer)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockGetCustomer())

      renderPage()

      const retry = await screen.findByRole('button', { name: /retry/i })
      fireEvent.click(retry)

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /familie müller/i })).toBeInTheDocument()
      })
    })
  })

  // ── Reveal scaffold: idle → analyzing → revealed ─────────────────────────
  describe('reveal scaffold', () => {
    test('shows Analyzing state while logInteraction is in flight', async () => {
      // deferred promise — we control when it resolves
      let resolveLog!: (v: InteractionLogResponse) => void
      vi.mocked(api.logInteraction).mockImplementation(
        () => new Promise((res) => { resolveLog = res }),
      )

      renderPage()
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /familie müller/i })).toBeInTheDocument()
      })

      // Open the log-note form and submit it to fire onLogInteraction
      fireEvent.click(screen.getByRole('button', { name: /log visit/i }))
      fireEvent.click(screen.getByRole('button', { name: /^log$/i }))

      // Must show "Analyzing…" while in-flight
      await waitFor(() => {
        expect(screen.getByTestId('analyzing-state')).toBeInTheDocument()
      })

      // Unblock the promise so the test doesn't leak
      resolveLog({
        interaction: mockGetCustomer().interactions[0],
        recommendation: mockGetCustomer().recommendation,
        score: { sign_likelihood: 74, ghost_risk: 'medium', components: null, reason: null },
      })
    })

    test('reveals updated rationale and clears Analyzing state after logInteraction resolves', async () => {
      let resolveLog!: (v: InteractionLogResponse) => void
      vi.mocked(api.logInteraction).mockImplementation(
        () => new Promise((res) => { resolveLog = res }),
      )

      const updatedRec = {
        ...mockGetCustomer().recommendation!,
        rationale: 'Updated rationale after spouse visit confirmed',
      }
      const logResponse: InteractionLogResponse = {
        interaction: mockGetCustomer().interactions[0],
        recommendation: updatedRec,
        score: { sign_likelihood: 82, ghost_risk: 'low' as const, components: null, reason: 'Spouse on board' },
      }

      renderPage()
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /familie müller/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /log visit/i }))
      fireEvent.click(screen.getByRole('button', { name: /^log$/i }))

      // confirm analyzing appeared
      await waitFor(() => {
        expect(screen.getByTestId('analyzing-state')).toBeInTheDocument()
      })

      // resolve with new data
      resolveLog(logResponse)

      // analyzing overlay must disappear, new rationale must appear
      await waitFor(() => {
        expect(screen.queryByTestId('analyzing-state')).not.toBeInTheDocument()
        expect(
          screen.getByText('Updated rationale after spouse visit confirmed'),
        ).toBeInTheDocument()
      })
    })
  })
})
