import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import useBookmarks from './useBookmarks.js'

const decision = { url: 'https://github.com/o/r/pull/1', title: 'Use Chroma' }

describe('useBookmarks', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('starts empty', () => {
    const { result } = renderHook(() => useBookmarks())

    expect(result.current.list()).toEqual([])
    expect(result.current.isBookmarked(decision.url)).toBe(false)
  })

  it('toggles a bookmark on and off', () => {
    const { result } = renderHook(() => useBookmarks())

    act(() => result.current.toggle(decision))
    expect(result.current.isBookmarked(decision.url)).toBe(true)
    expect(result.current.list()).toHaveLength(1)
    expect(result.current.list()[0]).toMatchObject(decision)
    expect(typeof result.current.list()[0].savedAt).toBe('string')

    act(() => result.current.toggle(decision))
    expect(result.current.isBookmarked(decision.url)).toBe(false)
    expect(result.current.list()).toEqual([])
  })

  it('persists across a simulated remount', () => {
    const { result: first, unmount } = renderHook(() => useBookmarks())
    act(() => first.current.toggle(decision))
    unmount()

    const { result: second } = renderHook(() => useBookmarks())

    expect(second.current.isBookmarked(decision.url)).toBe(true)
  })

  it('falls back to an empty list on corrupt JSON without throwing', () => {
    localStorage.setItem('bookmarks', '{not json')

    const { result } = renderHook(() => useBookmarks())

    expect(result.current.list()).toEqual([])
  })

  it('falls back to an empty list when stored JSON is not an array of entries', () => {
    localStorage.setItem('bookmarks', JSON.stringify({ url: 'x' }))

    const { result } = renderHook(() => useBookmarks())

    expect(result.current.list()).toEqual([])
  })

  describe('across instances', () => {
    const other = { url: 'https://github.com/o/r/pull/2', title: 'Use FastAPI' }

    it('keeps both bookmarks when two instances each toggle a different url', () => {
      const { result: a } = renderHook(() => useBookmarks())
      const { result: b } = renderHook(() => useBookmarks())

      act(() => a.current.toggle(decision))
      act(() => b.current.toggle(other))

      const stored = JSON.parse(localStorage.getItem('bookmarks')).map((e) => e.url)
      expect(stored).toEqual([decision.url, other.url])
      for (const hook of [a, b]) {
        expect(hook.current.isBookmarked(decision.url)).toBe(true)
        expect(hook.current.isBookmarked(other.url)).toBe(true)
      }
    })

    it('updates another mounted instance without a remount', () => {
      const { result: a } = renderHook(() => useBookmarks())
      const { result: b } = renderHook(() => useBookmarks())

      act(() => a.current.toggle(decision))

      expect(b.current.isBookmarked(decision.url)).toBe(true)
    })
  })
})
