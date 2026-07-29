import SourceCardList from './SourceCardList.jsx'

// Degraded-mode rendering for `/query`'s `mode: "sources_only"` — no
// Gemini key configured, so we show the retrieved units directly instead
// of a synthesized passage. Per UI-DESIGN.md this is a product state, not
// an error, so it gets the same reading-room treatment, not danger styling.
function SourcesView({ citations }) {
  return (
    <div className="max-w-3xl">
      <p className="font-reading text-ink text-[1.0625rem] leading-[1.7]">
        No Gemini key configured — showing retrieved sources directly.
      </p>
      <SourceCardList citations={citations} className="mt-4 flex flex-col gap-4" />
    </div>
  )
}

export default SourcesView
