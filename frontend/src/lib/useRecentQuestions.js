import { useCallback, useState } from 'react'

const STORAGE_KEY = 'recentQuestions'
const MAX_QUESTIONS = 10

function readStored() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (!Array.isArray(parsed)) return []
    return parsed.filter((q) => typeof q === 'string').slice(0, MAX_QUESTIONS)
  } catch {
    return []
  }
}

function persist(questions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(questions))
  } catch {
    // Storage full/unavailable: keep the in-memory state for this session.
  }
}

// The last 10 distinct questions asked, newest first, kept in localStorage
// only. Distinctness compares trimmed text; re-adding moves a question to the
// front. Missing or corrupt stored JSON falls back to an empty list.
function useRecentQuestions() {
  const [questions, setQuestions] = useState(readStored)

  const add = useCallback((question) => {
    const text = typeof question === 'string' ? question.trim() : ''
    if (!text) return
    setQuestions((current) => {
      const next = [text, ...current.filter((q) => q.trim() !== text)].slice(0, MAX_QUESTIONS)
      persist(next)
      return next
    })
  }, [])

  const clear = useCallback(() => {
    setQuestions([])
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Storage unavailable: in-memory state is already cleared.
    }
  }, [])

  return { questions, add, clear }
}

export default useRecentQuestions
