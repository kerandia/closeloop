import type {
  CustomerListItem,
  CustomerDetail,
  InteractionCreate,
  InteractionLogResponse,
  Message,
  RespondOutput,
  SendResponse,
} from './types'
import { mockListCustomers, mockGetCustomer, mockRespond } from '../mock/muller'

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
  return req('/api/customers?sort=sign_likelihood&order=desc', 'GET')
}

export function getCustomer(id: string): Promise<CustomerDetail> {
  if (isMockMode()) return Promise.resolve(mockGetCustomer())
  return req(`/api/customers/${id}`, 'GET')
}

export function logInteraction(
  customerId: string,
  payload: InteractionCreate,
): Promise<InteractionLogResponse> {
  return req(`/api/customers/${customerId}/interactions`, 'POST', payload)
}

export function approveRecommendation(recId: string): Promise<Message> {
  return req(`/api/recommendations/${recId}/approve`, 'POST')
}

export function dismissRecommendation(recId: string): Promise<{ ok: boolean }> {
  return req(`/api/recommendations/${recId}/dismiss`, 'POST')
}

export function patchMessage(
  msgId: string,
  patch: { subject?: string; body?: string },
): Promise<Message> {
  return req(`/api/messages/${msgId}`, 'PATCH', patch)
}

export function sendMessage(msgId: string): Promise<SendResponse> {
  return req(`/api/messages/${msgId}/send`, 'POST')
}

export function copilotRespond(payload: {
  customer_id: string
  utterance: string
  recent_context?: string
}): Promise<RespondOutput> {
  if (isMockMode()) return Promise.resolve(mockRespond())
  return req('/api/copilot/respond', 'POST', payload)
}

export function copilotCollect(customerId: string): Promise<{ question: string }> {
  return req(`/api/copilot/collect/${customerId}`, 'GET')
}
