import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function getPreference() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia(QUERY).matches
}

// Single source of truth for `prefers-reduced-motion` — components must
// not read `window.matchMedia` directly, so every animated surface stays
// consistent and there is one place to mock in tests.
function usePrefersReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(getPreference)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mediaQueryList = window.matchMedia(QUERY)
    const handleChange = (event) => setReducedMotion(event.matches)

    mediaQueryList.addEventListener('change', handleChange)
    return () => mediaQueryList.removeEventListener('change', handleChange)
  }, [])

  return reducedMotion
}

export default usePrefersReducedMotion
