import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import useDocumentTitle from './useDocumentTitle.js'

beforeEach(() => {
  document.title = 'original'
})

describe('useDocumentTitle', () => {
  it('sets the title on mount', () => {
    renderHook(() => useDocumentTitle('Ask — adr-engine'))

    expect(document.title).toBe('Ask — adr-engine')
  })

  it('updates the title when the argument changes', () => {
    const { rerender } = renderHook(({ title }) => useDocumentTitle(title), {
      initialProps: { title: 'One' },
    })

    rerender({ title: 'Two' })

    expect(document.title).toBe('Two')
  })

  it('restores the previous title on unmount', () => {
    const { unmount } = renderHook(() => useDocumentTitle('Ask — adr-engine'))

    unmount()

    expect(document.title).toBe('original')
  })
})
