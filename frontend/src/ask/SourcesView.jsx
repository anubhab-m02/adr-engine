import { useState } from 'react'
import SourceCardList from './SourceCardList.jsx'

const BANNER_DISMISSED_KEY = 'sourcesViewBannerDismissed'

// Degraded-mode rendering for `/query`'s `mode: "sources_only"` — no
// Gemini key configured, so we show the retrieved units directly instead
// of a synthesized passage. Per UI-DESIGN.md this is a product state, not
// an error, so it gets the same reading-room treatment, not danger styling:
// a serif lead-in stating the count, expanded SourceCards carrying the
// extracted decision/rationale text in place of the synthesized passage,
// and a quiet banner pointing at Settings. The banner dismissal is kept in
// `sessionStorage` (not `localStorage`) because the spec calls it a
// per-session quieting, not a permanent one.
function SourcesView({ citations }) {
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(BANNER_DISMISSED_KEY) === 'true',
  )

  function dismissBanner() {
    sessionStorage.setItem(BANNER_DISMISSED_KEY, 'true')
    setDismissed(true)
  }

  return (
    <div className="max-w-3xl">
      {!dismissed && (
        <div className="flex items-center justify-between gap-4 rounded-xl bg-highlight px-4 py-3 mb-4">
          <p className="font-ui text-sm text-ink">
            Add a Gemini key in Settings to get synthesized answers.
          </p>
          <button
            type="button"
            onClick={dismissBanner}
            aria-label="Dismiss"
            className="font-ui text-xs text-ink-muted hover:text-ink"
          >
            Dismiss
          </button>
        </div>
      )}
      <p className="font-reading text-ink text-[1.0625rem] leading-[1.7]">
        {citations.length} decision{citations.length === 1 ? '' : 's'} found —
      </p>
      <SourceCardList citations={citations} className="mt-4 flex flex-col gap-4" expanded />
    </div>
  )
}

export default SourcesView
