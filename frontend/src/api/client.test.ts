import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import * as api from './client'

function mockFetch(body: unknown, ok = true, status = 200) {
  const fn = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  } as Response)
  vi.stubGlobal('fetch', fn)
  return fn
}

beforeEach(() => {
  // ensure not in mock mode for these network tests
  window.history.replaceState({}, '', '/')
})
afterEach(() => vi.unstubAllGlobals())

describe('api client', () => {
  test('listCustomers hits ranked endpoint', async () => {
    const fn = mockFetch([])
    await api.listCustomers()
    expect(fn).toHaveBeenCalledWith(
      '/api/customers?sort=sign_likelihood&order=desc',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  test('getCustomer hits detail endpoint', async () => {
    const fn = mockFetch({})
    await api.getCustomer('abc')
    expect(fn).toHaveBeenCalledWith('/api/customers/abc', expect.objectContaining({ method: 'GET' }))
  })

  test('logInteraction POSTs the body as JSON', async () => {
    const fn = mockFetch({})
    await api.logInteraction('cid', { channel: 'visit', content: 'wife hesitant' })
    const [url, opts] = fn.mock.calls[0]
    expect(url).toBe('/api/customers/cid/interactions')
    expect(opts.method).toBe('POST')
    expect(opts.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(opts.body)).toEqual({ channel: 'visit', content: 'wife hesitant' })
  })

  test('approveRecommendation POSTs to approve', async () => {
    const fn = mockFetch({})
    await api.approveRecommendation('rid')
    expect(fn).toHaveBeenCalledWith(
      '/api/recommendations/rid/approve',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  test('patchMessage sends PATCH with body', async () => {
    const fn = mockFetch({})
    await api.patchMessage('mid', { body: 'edited' })
    const [url, opts] = fn.mock.calls[0]
    expect(url).toBe('/api/messages/mid')
    expect(opts.method).toBe('PATCH')
    expect(JSON.parse(opts.body)).toEqual({ body: 'edited' })
  })

  test('sendMessage POSTs to send', async () => {
    const fn = mockFetch({})
    await api.sendMessage('mid')
    expect(fn).toHaveBeenCalledWith(
      '/api/messages/mid/send',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  test('copilotRespond POSTs utterance', async () => {
    const fn = mockFetch({})
    await api.copilotRespond({ customer_id: 'cid', utterance: 'hi' })
    const [url, opts] = fn.mock.calls[0]
    expect(url).toBe('/api/copilot/respond')
    expect(JSON.parse(opts.body)).toEqual({ customer_id: 'cid', utterance: 'hi' })
  })

  test('throws on non-ok response', async () => {
    mockFetch({ detail: 'nope' }, false, 500)
    await expect(api.listCustomers()).rejects.toThrow()
  })
})
