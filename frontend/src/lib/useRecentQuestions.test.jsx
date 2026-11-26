import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import useRecentQuestions from './useRecentQuestions.js'

describe('useRecentQuestions', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('starts empty', () => {
    const { result } = renderHook(() => useRecentQuestions())

    expect(result.current.questions).toEqual([])
  })

  it('orders newest first and dedupes by trimmed text', () => {
    const { result } = renderHook(() => useRecentQuestions())

    act(() => result.current.add('Why Chroma?'))
    act(() => result.current.add('Why FastAPI?'))
    act(() => result.current.add('  Why Chroma?  '))

    expect(result.current.questions).toEqual(['Why Chroma?', 'Why FastAPI?'])
  })

  it('ignores blank questions', () => {
    const { result } = renderHook(() => useRecentQuestions())

    act(() => result.current.add('   '))
    act(() => result.current.add(''))

    expect(result.current.questions).toEqual([])
    expect(localStorage.getItem('recentQuestions')).toBeNull()
  })

  it('drops the oldest when an 11th distinct question is added', () => {
    const { result } = renderHook(() => useRecentQuestions())

    for (let i = 1; i <= 11; i += 1) {
      act(() => result.current.add(`Question ${i}`))
    }

    expect(result.current.questions).toHaveLength(10)
    expect(result.current.questions[0]).toBe('Question 11')
    expect(result.current.questions).not.toContain('Question 1')
  })

  it('clear() empties state and storage', () => {
    const { result } = renderHook(() => useRecentQuestions())
    act(() => result.current.add('Why Chroma?'))

    act(() => result.current.clear())

    expect(result.current.questions).toEqual([])
    expect(localStorage.getItem('recentQuestions')).toBeNull()
  })

  it('yields [] for corrupt JSON', () => {
    localStorage.setItem('recentQuestions', '{not json')

    const { result } = renderHook(() => useRecentQuestions())

    expect(result.current.questions).toEqual([])
  })

  it('yields [] for non-array JSON', () => {
    localStorage.setItem('recentQuestions', JSON.stringify({ a: 1 }))

    const { result } = renderHook(() => useRecentQuestions())

    expect(result.current.questions).toEqual([])
  })

  it('persists across remounts', () => {
    const first = renderHook(() => useRecentQuestions())
    act(() => first.result.current.add('Why Chroma?'))
    first.unmount()

    const second = renderHook(() => useRecentQuestions())

    expect(second.result.current.questions).toEqual(['Why Chroma?'])
  })
})
