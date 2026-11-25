import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import useAnnotations from './useAnnotations.js'

const url = 'https://github.com/o/r/pull/1'

describe('useAnnotations', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('returns undefined for an unannotated url', () => {
    const { result } = renderHook(() => useAnnotations())

    expect(result.current.get(url)).toBeUndefined()
  })

  it('sets a note with updatedAt, then removes it', () => {
    const { result } = renderHook(() => useAnnotations())

    act(() => result.current.set(url, 'because auth'))
    expect(result.current.get(url)).toMatchObject({ url, note: 'because auth' })
    expect(typeof result.current.get(url).updatedAt).toBe('string')

    act(() => result.current.remove(url))
    expect(result.current.get(url)).toBeUndefined()
  })

  it('replaces an existing note rather than duplicating it', () => {
    const { result } = renderHook(() => useAnnotations())

    act(() => result.current.set(url, 'one'))
    act(() => result.current.set(url, 'two'))

    expect(result.current.get(url).note).toBe('two')
    expect(JSON.parse(localStorage.getItem('annotations'))).toHaveLength(1)
  })

  it('removes the entry when the note is empty or whitespace', () => {
    const { result } = renderHook(() => useAnnotations())

    act(() => result.current.set(url, 'note'))
    act(() => result.current.set(url, '   '))

    expect(result.current.get(url)).toBeUndefined()
  })

  it('persists across remounts', () => {
    const first = renderHook(() => useAnnotations())
    act(() => first.result.current.set(url, 'kept'))
    first.unmount()

    const second = renderHook(() => useAnnotations())

    expect(second.result.current.get(url).note).toBe('kept')
  })

  it('falls back to empty state on corrupt JSON', () => {
    localStorage.setItem('annotations', '{not json')

    const { result } = renderHook(() => useAnnotations())

    expect(result.current.get(url)).toBeUndefined()
    act(() => result.current.set(url, 'works after corruption'))
    expect(result.current.get(url).note).toBe('works after corruption')
  })

  it('ignores malformed entries in stored JSON', () => {
    localStorage.setItem('annotations', JSON.stringify([{ nope: 1 }, { url, note: 'ok', updatedAt: 'x' }]))

    const { result } = renderHook(() => useAnnotations())

    expect(result.current.get(url).note).toBe('ok')
  })
})
