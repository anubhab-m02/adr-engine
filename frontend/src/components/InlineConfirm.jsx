// Shared "confirm a destructive action inline, no modal" shape — used
// by RepoRow (remove repo), GitHubSection (disconnect), and GeminiSection
// (remove key), per UI-DESIGN.md's inline-confirm pattern. Callers own
// their own outer container styling (a bare row vs. inside an already
// bg-panel'd section); this only owns the message + button pair.
function InlineConfirm({ message, confirmLabel = 'Remove', onConfirm, onCancel, disabled, error }) {
  return (
    <>
      <p className="text-sm text-ink">
        {message}
        {error && (
          <span role="alert" className="block text-danger">
            {error}
          </span>
        )}
      </p>
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          disabled={disabled}
          onClick={onConfirm}
          className="text-sm font-semibold text-danger disabled:opacity-50"
        >
          {confirmLabel}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-ink-muted">
          Cancel
        </button>
      </div>
    </>
  )
}

export default InlineConfirm
