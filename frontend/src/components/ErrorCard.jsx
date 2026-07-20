import { MESSAGE_CARD_BASE } from './messageCardBase.js'

function ErrorCard({ message, onRetry, disabled }) {
  return (
    <div className={`${MESSAGE_CARD_BASE} border border-danger`}>
      <p className="text-base text-danger">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        disabled={disabled}
        className="mt-2 rounded-lg bg-danger text-white text-sm font-semibold px-4 py-2 disabled:opacity-50"
      >
        Retry
      </button>
    </div>
  )
}

export default ErrorCard
