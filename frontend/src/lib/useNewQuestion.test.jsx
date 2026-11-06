import { render, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NewQuestionProvider, useNewQuestion, useRegisterNewQuestionHandler } from './useNewQuestion.js'

describe('NewQuestionProvider', () => {
  it('calls the registered handler via useNewQuestion()', () => {
    const handler = vi.fn()
    const { result } = renderHook(
      () => {
        useRegisterNewQuestionHandler(handler)
        return useNewQuestion()
      },
      { wrapper: NewQuestionProvider },
    )

    result.current()

    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('is a no-op once the registering component unmounts', () => {
    const handler = vi.fn()
    function Registrar() {
      useRegisterNewQuestionHandler(handler)
      return null
    }
    let request
    function Caller() {
      request = useNewQuestion()
      return null
    }
    const { rerender } = render(
      <NewQuestionProvider>
        <Registrar />
        <Caller />
      </NewQuestionProvider>,
    )
    request()
    expect(handler).toHaveBeenCalledTimes(1)

    rerender(
      <NewQuestionProvider>
        <Caller />
      </NewQuestionProvider>,
    )
    expect(() => request()).not.toThrow()
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('is a no-op when no handler was ever registered', () => {
    const { result } = renderHook(() => useNewQuestion(), { wrapper: NewQuestionProvider })
    expect(() => result.current()).not.toThrow()
  })
})

describe('outside NewQuestionProvider', () => {
  it('useNewQuestion throws its documented error', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useNewQuestion())).toThrow(
      'useNewQuestion must be used within a NewQuestionProvider',
    )
    vi.restoreAllMocks()
  })

  it('useRegisterNewQuestionHandler throws its documented error', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useRegisterNewQuestionHandler(() => {}))).toThrow(
      'useRegisterNewQuestionHandler must be used within a NewQuestionProvider',
    )
    vi.restoreAllMocks()
  })
})
