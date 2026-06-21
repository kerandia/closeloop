import type {
  CustomerListItem,
  CustomerDetail,
  CopilotSuggestion,
  CopilotStreamEvent,
  InteractionCreate,
  InteractionLogResponse,
  Message,
  RespondOutput,
  SendResponse,
  MessagingSendResponse,
  ImportCustomerInput,
  ImportQuoteInput,
  ImportResponse,
  MgmtStats,
  ClosingKitResult,
  CallNotes,
} from './types'
import {
  mockListCustomers,
  mockGetCustomer,
  mockRespond,
  mockLogInteraction,
  mockApprove,
  mockPatchMessage,
  mockSend,
  mockCollect,
} from '../mock/muller'
import { mockMgmtStats } from '../mock/management'
import { applyDemoList, applyDemoDetail } from '../lib/demoPipeline'

export function isMockMode(): boolean {
  return new URLSearchParams(window.location.search).get('mock') === '1'
}

async function req<T>(url: string, method: string, body?: unknown): Promise<T> {
  const opts: RequestInit & { headers: Record<string, string> } = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body !== undefined) opts.body = JSON.stringify(body)
  const res = await fetch(url, opts)
  if (!res.ok) {
    let detail = res.statusText
    try {
      detail = (await res.json())?.detail ?? detail
    } catch {
      /* ignore */
    }
    throw new Error(`${method} ${url} failed (${res.status}): ${detail}`)
  }
  return res.json() as Promise<T>
}

export function listCustomers(): Promise<CustomerListItem[]> {
  if (isMockMode()) return Promise.resolve(mockListCustomers())
  // DEMO: overlay funnel stages + extra rows on the real list (see demoPipeline).
  return req<CustomerListItem[]>('/api/customers?sort=sign_likelihood&order=desc', 'GET').then(
    applyDemoList,
  )
}

export function getCustomer(id: string): Promise<CustomerDetail> {
  if (isMockMode()) return Promise.resolve(mockGetCustomer())
  // DEMO: keep the detail's stage consistent with the funnel shown in the list.
  return req<CustomerDetail>(`/api/customers/${id}`, 'GET').then(applyDemoDetail)
}

export function getManagementStats(period: 'week' | 'month'): Promise<MgmtStats> {
  if (isMockMode()) return Promise.resolve(mockMgmtStats(period))
  return req(`/api/management/stats?period=${period}`, 'GET')
}

export function generateClosingKit(
  customerId: string,
  kind: string = 'auto',
): Promise<ClosingKitResult> {
  if (isMockMode())
    return Promise.reject(new Error('The visual agent needs the live backend (remove ?mock=1).'))
  return req(`/api/customers/${customerId}/closing-kit?kind=${encodeURIComponent(kind)}`, 'POST')
}

export function generateCallNotes(customerId: string): Promise<CallNotes> {
  if (isMockMode())
    return Promise.resolve({
      summary: 'Warm call; comparing other quotes and wants to involve the spouse.',
      key_points: ['Interested in savings', 'Comparing 2 other companies'],
      objections: ['comparing', 'spouse'],
      buying_signals: ['asked about install timing'],
      next_steps: ['Send the partner one-pager', 'Follow up Tuesday'],
      source_interaction_id: null,
    })
  return req(`/api/customers/${customerId}/call-notes`, 'POST')
}

export function importCustomers(payload: {
  customers: ImportCustomerInput[]
  quotes: ImportQuoteInput[]
}): Promise<ImportResponse> {
  if (isMockMode())
    return Promise.reject(new Error('Add customer needs the live backend (remove ?mock=1).'))
  return req('/api/customers/import', 'POST', payload)
}

export function logInteraction(
  customerId: string,
  payload: InteractionCreate,
): Promise<InteractionLogResponse> {
  if (isMockMode()) return Promise.resolve(mockLogInteraction(payload))
  return req(`/api/customers/${customerId}/interactions`, 'POST', payload)
}

export function approveRecommendation(recId: string): Promise<Message> {
  if (isMockMode()) return Promise.resolve(mockApprove())
  return req(`/api/recommendations/${recId}/approve`, 'POST')
}

export function dismissRecommendation(recId: string): Promise<{ ok: boolean }> {
  if (isMockMode()) return Promise.resolve({ ok: true })
  return req(`/api/recommendations/${recId}/dismiss`, 'POST')
}

export function patchMessage(
  msgId: string,
  patch: { subject?: string; body?: string },
): Promise<Message> {
  if (isMockMode()) return Promise.resolve(mockPatchMessage(patch))
  return req(`/api/messages/${msgId}`, 'PATCH', patch)
}

export function sendMessage(msgId: string): Promise<SendResponse> {
  if (isMockMode()) return Promise.resolve(mockSend())
  return req(`/api/messages/${msgId}/send`, 'POST')
}

export function copilotRespond(payload: {
  customer_id: string
  utterance: string
  recent_context?: string
  channel?: string
}): Promise<RespondOutput> {
  if (isMockMode()) return Promise.resolve(mockRespond())
  return req('/api/copilot/respond', 'POST', payload)
}

export function copilotCollect(customerId: string): Promise<{ question: string }> {
  if (isMockMode()) return Promise.resolve(mockCollect())
  return req(`/api/copilot/collect/${customerId}`, 'GET')
}

// ── Live WhatsApp co-pilot ──────────────────────────────────────────────────

export function listCopilotSuggestions(customerId: string): Promise<CopilotSuggestion[]> {
  if (isMockMode()) return Promise.resolve([])
  return req(`/api/copilot/suggestions/${customerId}`, 'GET')
}

export function messagingSend(payload: {
  customer_id: string
  body: string
  channel: string // 'whatsapp' | 'sms'
  suggestion_id?: string
}): Promise<MessagingSendResponse> {
  if (isMockMode())
    return Promise.resolve({ ok: true, within_window: true, provider: { provider_id: 'mock' } })
  return req('/api/messaging/send', 'POST', payload)
}

/** Subscribe to live co-pilot suggestions over SSE. Returns an unsubscribe fn. */
export function subscribeCopilot(
  customerId: string,
  onEvent: (e: CopilotStreamEvent) => void,
): () => void {
  if (isMockMode() || typeof EventSource === 'undefined') return () => {}
  const es = new EventSource(`/api/copilot/stream/${customerId}`)
  es.onmessage = (m) => {
    try {
      onEvent(JSON.parse(m.data) as CopilotStreamEvent)
    } catch {
      /* ignore malformed frame */
    }
  }
  return () => es.close()
}
