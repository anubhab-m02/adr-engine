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
    for (const link of screen.getAllByRole('link', { name: /Citation:/ })) {
      expect(link).toHaveAttribute('href', citation.url)
    }
  })

  describe('>=1280px margin grid', () => {
    it('places a cited paragraph in the reading column and its source card in the margin column, same grid row', () => {
      const { container } = render(
        <AnswerPage
          question="Why OAuth2?"
          answer="We use OAuth2 for auth [owner/repo:pr:42]."
          citations={[citation]}
          repos={repos}
          selectedRepos={['owner/repo']}
        />,
      )

      const grid = container.querySelector('.xl\\:grid')
      expect(grid).toBeInTheDocument()

      const paragraph = screen.getByText(/We use OAuth2 for auth/).closest('p')
      expect(paragraph).toHaveClass('xl:col-start-1')

      const marginGroup = grid.querySelector('.xl\\:col-start-2')
      expect(marginGroup).toBeInTheDocument()
      expect(marginGroup).toHaveClass('hidden', 'xl:flex')
      const marginLink = marginGroup.querySelector('a')
      expect(marginLink).toHaveAttribute('href', citation.url)

      // paragraph and its margin group are siblings under the same
      // xl:contents wrapper, i.e. the same implicit grid row.
      expect(paragraph.parentElement).toBe(marginGroup.parentElement)
    })

    it('renders no margin-column element for a paragraph that cites nothing', () => {
      const { container } = render(
        <AnswerPage
          question="Why OAuth2?"
          answer="No citation in this one."
          citations={[citation]}
          repos={repos}
          selectedRepos={['owner/repo']}
        />,
      )

      expect(container.querySelector('.xl\\:col-start-2')).not.toBeInTheDocument()
    })

    it('gives each margin source card its marker number', () => {
      const other = { ...citation, id: 'owner/repo:commit:abc', url: 'https://github.com/owner/repo/commit/abc' }
      render(
        <AnswerPage
          question="Why OAuth2?"
          answer={'First [owner/repo:pr:42].\n\nSecond [owner/repo:commit:abc].'}
          citations={[citation, other]}
          repos={repos}
          selectedRepos={['owner/repo']}
        />,
      )

      expect(screen.getAllByText('1')).not.toHaveLength(0)
      expect(screen.getAllByText('2')).not.toHaveLength(0)
    })
  })
})
