import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { badgeText, dateGroupLabel, groupByDate, relativeDate } from './sourceFormat'

describe('badgeText', () => {
  it('labels a PR with its number', () => {
    expect(badgeText({ kind: 'pr', ref: '42' })).toBe('PR #42')
  })

  it('labels a commit with the first 7 chars of the sha', () => {
    expect(badgeText({ kind: 'commit', ref: '0123456789abcdef' })).toBe('commit 0123456')
  })
})

describe('groupByDate', () => {
  // Local-time constructors keep the grouping independent of the runner's timezone.
  const at = (y, m, d, h) => new Date(y, m, d, h).toISOString()

  it('groups same-day units and keeps newest-first order', () => {
    const units = [
      { id: 'a', date: at(2026, 4, 10, 15) },
      { id: 'b', date: at(2026, 4, 10, 9) },
      { id: 'c', date: at(2026, 4, 8, 12) },
    ]
    const groups = groupByDate(units)
    expect(groups.map((g) => g.units.map((u) => u.id))).toEqual([['a', 'b'], ['c']])
    expect(groups.map((g) => g.label)).toEqual([
      dateGroupLabel(units[0].date),
      dateGroupLabel(units[2].date),
    ])
  })

  it('returns [] for no units', () => {
    expect(groupByDate([])).toEqual([])
  })
})

describe('relativeDate', () => {
  const now = new Date('2026-06-15T12:00:00Z')
  const offset = (seconds) => new Date(now.getTime() + seconds * 1000).toISOString()
  const DAY = 86400

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('formats seconds', () => {
    expect(relativeDate(offset(-10))).toBe('10 seconds ago')
  })

  it('formats days', () => {
    expect(relativeDate(offset(-3 * DAY))).toBe('3 days ago')
  })

  it('formats months', () => {
    expect(relativeDate(offset(-120 * DAY))).toBe('4 months ago')
  })

  it('formats years', () => {
    expect(relativeDate(offset(-800 * DAY))).toBe('2 years ago')
  })

  it('formats a future date', () => {
    expect(relativeDate(offset(3 * DAY))).toBe('in 3 days')
  })
})
