import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import AnswerPage from './AnswerPage.jsx'

const citation = {
  id: 'owner/repo:pr:42',
  kind: 'pr',
  ref: '42',
  url: 'https://github.com/owner/repo/pull/42',
  title: 'Switch auth to OAuth2 for third-party integrations',
  author: 'octocat',
  date: '2024-01-01T00:00:00Z',
  repo: 'owner/repo',
}

const repos = [
  { repo: 'owner/repo', indexed_units: 30 },
  { repo: 'owner/other', indexed_units: 8 },
]

describe('AnswerPage', () => {
  it('renders the question as a heading', () => {
    render(
      <AnswerPage
        question="Why OAuth2?"
        answer="We use OAuth2 for auth."
        citations={[]}
        repos={repos}
        selectedRepos={['owner/repo']}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Why OAuth2?' })).toBeInTheDocument()
  })

  it('renders a provenance dek computed from selectedRepos and their indexed_units', () => {
    render(
      <AnswerPage
        question="Why OAuth2?"
        answer="We use OAuth2 for auth."
        citations={[]}
        repos={repos}
        selectedRepos={['owner/repo', 'owner/other']}
      />,
    )

    expect(screen.getByText('searched 2 repos · 38 decisions')).toBeInTheDocument()
  })

  it('singularizes the dek for one repo and one decision', () => {
    render(
      <AnswerPage
        question="Why OAuth2?"
        answer="We use OAuth2 for auth."
        citations={[]}
        repos={[{ repo: 'owner/repo', indexed_units: 1 }]}
        selectedRepos={['owner/repo']}
      />,
    )

    expect(screen.getByText('searched 1 repo · 1 decision')).toBeInTheDocument()
  })

  it('only counts indexed_units for selected repos', () => {
    render(
      <AnswerPage
        question="Why OAuth2?"
        answer="We use OAuth2 for auth."
        citations={[]}
        repos={repos}
        selectedRepos={['owner/repo']}
      />,
    )

    expect(screen.getByText('searched 1 repo · 30 decisions')).toBeInTheDocument()
  })

  it('renders the answer body with its citation and sources', () => {
    render(
      <AnswerPage
        question="Why OAuth2?"
        answer="We use OAuth2 for auth [owner/repo:pr:42]."
        citations={[citation]}
        repos={repos}
        selectedRepos={['owner/repo']}
      />,
    )

    expect(screen.getByText(/We use OAuth2 for auth/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Citation:/ })).toHaveAttribute('href', citation.url)
  })
})
