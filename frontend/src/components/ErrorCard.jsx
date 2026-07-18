function ErrorCard({ message, onRetry }) {
  return (
    <div className="max-w-3xl rounded-xl bg-panel border border-danger p-4">
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
