import { useEffect } from 'react'

// WCAG 2.4.2 (Page Titled): sets document.title while the calling page is
// mounted and restores the previous title on unmount or change.
function useDocumentTitle(title) {
  useEffect(() => {
    const previous = document.title
    document.title = title
    return () => {
      document.title = previous
    }
  }, [title])
}

export default useDocumentTitle
