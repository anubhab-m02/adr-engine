// Full-screen onboarding flow (UI-DESIGN.md `/onboarding`), no app
// shell. Composes ConnectStep -> RepoPickerStep -> IndexStep -> the
// optional GeminiKeyStep into a small state machine driven by GET
// /setup/state, so a refresh resumes at the furthest incomplete step
// rather than restarting from Connect every time.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getConfig, getSetupState } from '../api.js'
import ConnectStep from './ConnectStep.jsx'
import GeminiKeyStep from './GeminiKeyStep.jsx'
import IndexStep from './IndexStep.jsx'
import RepoPickerStep from './RepoPickerStep.jsx'

const DOT_STEPS = ['connect', 'repos', 'index']

function Dots({ step }) {
  const current = DOT_STEPS.indexOf(step)
  if (current === -1) return null

  return (
    <div className="flex justify-center gap-2 pt-8">
      {DOT_STEPS.map((name, index) => (
        <span
          key={name}
          className={`h-1.5 w-1.5 rounded-full ${index === current ? 'bg-accent' : 'bg-ink-muted'}`}
        />
      ))}
    </div>
  )
}

function OnboardingPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(null)
  const [repos, setRepos] = useState([])

  useEffect(() => {
    let cancelled = false

    getSetupState()
      .then(async (state) => {
        if (cancelled) return

        if (!state.github_connected) {
          setStep('connect')
          return
        }
        if (!state.repos_selected) {
          setStep('repos')
          return
        }
        if (!state.first_index_done) {
          const config = await getConfig()
          if (cancelled) return
          setRepos(config.indexed_repos)
          setStep('index')
          return
        }
        if (!state.gemini_key_set) {
          setStep('gemini')
          return
        }
        navigate('/')
      })
      .catch(() => {
        if (!cancelled) setStep('connect')
      })

    return () => {
      cancelled = true
    }
  }, [navigate])

  function handleRepoPickerNext(selected) {
    setRepos(selected)
    setStep('index')
  }

  if (step === null) return null

  return (
    <div className="min-h-svh bg-surface flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
        {step === 'connect' && <ConnectStep onAuthorized={() => setStep('repos')} />}
        {step === 'repos' && <RepoPickerStep onNext={handleRepoPickerNext} />}
        {step === 'index' && <IndexStep repos={repos} onComplete={() => setStep('gemini')} />}
        {step === 'gemini' && <GeminiKeyStep onComplete={() => navigate('/')} />}
      </div>
      <Dots step={step} />
    </div>
  )
}

export default OnboardingPage
