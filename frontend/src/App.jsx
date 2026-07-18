function App() {
  return (
    <div className="min-h-svh bg-surface text-ink flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-panel rounded-xl p-4 gap-4 flex flex-col shadow">
        <h1 className="text-lg font-semibold">adr-engine</h1>
        <p className="text-base">
          "Why Did We Build It This Way?" — ask a question about the
          indexed repos and get a cited answer.
        </p>
        <p className="text-sm text-ink-muted">
          Design tokens wired up: surface, panel, ink, ink-muted.
        </p>
        <button
          type="button"
          className="rounded-lg bg-accent text-white px-4 py-2 text-sm font-semibold self-start"
        >
          Accent button
        </button>
      </div>
    </div>
  )
}

export default App
