import { describe, test, expect } from 'vitest'
import { scoreBand, relativeTime } from './format'

describe('scoreBand', () => {
  test('below 40 is low', () => {
    expect(scoreBand(0)).toBe('low')
    expect(scoreBand(39)).toBe('low')
  })
  test('40 to 70 inclusive is mid', () => {
    expect(scoreBand(40)).toBe('mid')
    expect(scoreBand(70)).toBe('mid')
  })
  test('above 70 is high', () => {
    expect(scoreBand(71)).toBe('high')
    expect(scoreBand(100)).toBe('high')
  })
  test('null is unknown', () => {
    expect(scoreBand(null)).toBe('unknown')
  })
})

describe('relativeTime', () => {
  const now = new Date('2026-06-20T12:00:00Z')
  test('seconds ago reads as just now', () => {
    expect(relativeTime('2026-06-20T11:59:30Z', now)).toBe('just now')
  })
  test('minutes ago', () => {
    expect(relativeTime('2026-06-20T11:30:00Z', now)).toBe('30 min ago')
  })
  test('hours ago', () => {
    expect(relativeTime('2026-06-20T09:00:00Z', now)).toBe('3 hours ago')
  })
  test('one day ago is singular', () => {
    expect(relativeTime('2026-06-19T12:00:00Z', now)).toBe('1 day ago')
  })
  test('days ago', () => {
    expect(relativeTime('2026-06-14T12:00:00Z', now)).toBe('6 days ago')
  })
  test('null reads as never', () => {
    expect(relativeTime(null, now)).toBe('never')
  })
  test('invalid date reads as never (not "NaN days ago")', () => {
    expect(relativeTime('not-a-date', now)).toBe('never')
  })
  test('future timestamp reads as soon, not "just now"', () => {
    expect(relativeTime('2026-06-22T12:00:00Z', now)).toBe('in 2 days')
  })
  test('near-future (within a minute) reads as soon', () => {
    expect(relativeTime('2026-06-20T12:00:20Z', now)).toBe('soon')
  })
})
