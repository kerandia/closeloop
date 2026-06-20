import { describe, test, expect, afterEach } from 'vitest'
import { withMock } from './nav'

function setSearch(search: string) {
  window.history.replaceState({}, '', `/${search}`)
}
afterEach(() => setSearch(''))

describe('withMock', () => {
  test('returns the path unchanged when not in mock mode', () => {
    setSearch('')
    expect(withMock('/customers/abc')).toBe('/customers/abc')
  })
  test('appends ?mock=1 when in mock mode', () => {
    setSearch('?mock=1')
    expect(withMock('/customers/abc')).toBe('/customers/abc?mock=1')
  })
  test('uses & when the path already has a query', () => {
    setSearch('?mock=1')
    expect(withMock('/customers/abc?foo=1')).toBe('/customers/abc?foo=1&mock=1')
  })
})
