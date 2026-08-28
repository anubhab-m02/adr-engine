import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import useReadingPreferences from './useReadingPreferences.js'

describe('useReadingPreferences', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('defaults density to comfortable', () => {
    const { result } = renderHook(() => useReadingPreferences())

    expect(result.current.density).toBe('comfortable')
  })

  it('updates density and persists it to localStorage', () => {
    const { result } = renderHook(() => useReadingPreferences())

    act(() => {
      result.current.setDensity('compact')
    })

    expect(result.current.density).toBe('compact')
    expect(JSON.parse(localStorage.getItem('readingPreferences'))).toMatchObject({ density: 'compact' })
  })

  it('reads a previously persisted density across a simulated remount', () => {
    const { result: first } = renderHook(() => useReadingPreferences())
    act(() => {
      first.current.setDensity('compact')
    })

    const { result: second } = renderHook(() => useReadingPreferences())

    expect(second.current.density).toBe('compact')
  })

  it('falls back to defaults when localStorage holds malformed JSON', () => {
    localStorage.setItem('readingPreferences', 'not json')

    const { result } = renderHook(() => useReadingPreferences())

    expect(result.current.density).toBe('comfortable')
  })
})
