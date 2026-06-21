import { describe, test, expect } from 'vitest'
import {
  scoreBand,
  relativeTime,
  humanizeLabel,
  motivationLabel,
  confidencePct,
} from './format'

describe('scoreBand', () => {
  test('0–39 is cold', () => {
    expect(scoreBand(0)).toBe('cold')
    expect(scoreBand(39)).toBe('cold')
  })
  test('40–59 is cool', () => {
    expect(scoreBand(40)).toBe('cool')
    expect(scoreBand(59)).toBe('cool')
  })
  test('60–79 is warm', () => {
    expect(scoreBand(60)).toBe('warm')
    expect(scoreBand(79)).toBe('warm')
  })
  test('80–100 is hot', () => {
    expect(scoreBand(80)).toBe('hot')
    expect(scoreBand(100)).toBe('hot')
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

describe('humanizeLabel', () => {
  test('underscores become words, sentence-cased', () => {
    expect(humanizeLabel('peace_of_mind')).toBe('Peace of mind')
  })
  test('redundant layer prefix is dropped', () => {
    expect(humanizeLabel('MOTIVATION: peace_of_mind')).toBe('Peace of mind')
  })
  test('key:value with severity reads as "Key · High"', () => {
    expect(humanizeLabel('multi_quote_risk: HIGH')).toBe('Multi quote risk · High')
  })
  test('non-layer key:value is kept and formatted', () => {
    expect(humanizeLabel('decision: husband + wife')).toBe('Decision · Husband + wife')
  })
  test('empty input is safe', () => {
    expect(humanizeLabel('')).toBe('')
  })
})

describe('motivationLabel', () => {
  test('known motivation maps to friendly phrase', () => {
    expect(motivationLabel('independence')).toBe('Energy independence')
  })
  test('unknown motivation falls back to sentence case', () => {
    expect(motivationLabel('curiosity')).toBe('Curiosity')
  })
  test('null is empty', () => {
    expect(motivationLabel(null)).toBe('')
  })
})

describe('confidencePct', () => {
  test('0.8 → 80% sure', () => {
    expect(confidencePct(0.8)).toBe('80% sure')
  })
  test('null → null (caller omits)', () => {
    expect(confidencePct(null)).toBeNull()
  })
})
