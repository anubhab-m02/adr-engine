// UI-DESIGN.md's Settings page: single-column shell of per-concern
// sections. DataSection lands in a following issue.
import GeminiSection from './GeminiSection.jsx'
import GitHubSection from './GitHubSection.jsx'
import ModelsSection from './ModelsSection.jsx'

function SettingsPage() {
  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <h1 className="font-reading text-lg text-ink">Settings</h1>
      <div className="mt-4 flex flex-col gap-4">
        <GitHubSection />
        <GeminiSection />
        <ModelsSection />
      </div>
    </div>
  )
}

export default SettingsPage
