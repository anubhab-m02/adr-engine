import { MESSAGE_CARD_BASE } from './messageCardBase.js'

function ErrorCard({ message, onRetry }) {
  return (
    <div className={`${MESSAGE_CARD_BASE} border border-danger`}>
      <p className="text-base text-danger">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 rounded-lg bg-danger text-white text-sm font-semibold px-4 py-2"
      >
        Retry
      </button>
    </div>
  )
}

export default ErrorCard
