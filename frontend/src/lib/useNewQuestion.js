// Lets the command palette's "New question" action reach AskPage's
// message state without CommandPalette importing AskPage directly — it
// mounts in AppShell, above every route, and shouldn't reach into a
// specific page's internals. AskPage registers its own clear-messages
// handler on mount; the palette calls whatever handler is currently
// registered (a no-op if AskPage isn't mounted).
import { createContext, createElement, useCallback, useContext, useEffect, useRef } from 'react'

const NewQuestionContext = createContext(null)

export function NewQuestionProvider({ children }) {
  const handlerRef = useRef(null)

  const setHandler = useCallback((handler) => {
    handlerRef.current = handler
  }, [])

  const requestNewQuestion = useCallback(() => {
    handlerRef.current?.()
  }, [])

  return createElement(NewQuestionContext.Provider, { value: { setHandler, requestNewQuestion } }, children)
}

export function useRegisterNewQuestionHandler(handler) {
  const context = useContext(NewQuestionContext)
  if (!context) {
    throw new Error('useRegisterNewQuestionHandler must be used within a NewQuestionProvider')
  }

  useEffect(() => {
    context.setHandler(handler)
    return () => context.setHandler(null)
  }, [context, handler])
}

export function useNewQuestion() {
  const context = useContext(NewQuestionContext)
  if (!context) {
    throw new Error('useNewQuestion must be used within a NewQuestionProvider')
  }
  return context.requestNewQuestion
}
