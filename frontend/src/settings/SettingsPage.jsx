// UI-DESIGN.md's Settings page: single-column shell of per-concern
// sections.
import DataSection from './DataSection.jsx'
import GeminiSection from './GeminiSection.jsx'
import GitHubSection from './GitHubSection.jsx'
import ModelsSection from './ModelsSection.jsx'

function SettingsPage() {
  return (
    <div className="max-w-xl mx-auto px-4 lg:px-6 py-6">
      <h1 className="font-reading text-lg text-ink">Settings</h1>
      <div className="mt-4 flex flex-col gap-4">
        <GitHubSection />
        <GeminiSection />
        <ModelsSection />
        <DataSection />
      </div>
    </div>
  )
}

export default SettingsPage
