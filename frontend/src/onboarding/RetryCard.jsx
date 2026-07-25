// Shared shape for onboarding's several "something went wrong, retry"
// states (UI-DESIGN.md names this the "ErrorCard pattern"). Used by
// ConnectStep, DeviceCodeCard, and RepoPickerStep instead of each
// hand-rolling its own panel/message/button markup.
function RetryCard({ message, messageTone = 'muted', bordered = false, buttonLabel = 'Retry', buttonTone = 'accent', onRetry }) {
  return (
    <div className={`rounded-xl bg-panel p-4 ${bordered ? 'border border-danger' : ''}`}>
      <p className={`text-sm ${messageTone === 'danger' ? 'text-danger' : 'text-ink-muted'}`}>{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className={`mt-2 rounded-lg text-white text-sm font-semibold px-4 py-2 ${
          buttonTone === 'danger' ? 'bg-danger' : 'bg-accent'
        }`}
      >
        {buttonLabel}
      </button>
    </div>
  )
}

export default RetryCard
