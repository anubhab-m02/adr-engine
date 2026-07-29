import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AnswerPassage from './AnswerPassage.jsx'

const citations = [
  { id: 'unit-a', url: 'https://github.com/owner/repo/pull/1' },
  { id: 'unit-b', url: 'https://github.com/owner/repo/commit/abc' },
]

function stubMatchMedia(matches) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
}

describe('AnswerPassage', () => {
  afterEach(() => {
    delete window.matchMedia
  })

  it('renders the answer text', () => {
    render(<AnswerPassage answer="We use OAuth2 for auth [unit-a]." citations={citations} />)

    expect(screen.getByText(/We use OAuth2 for auth/)).toBeInTheDocument()
  })

  it('fades up on arrival and staggers its markers ink-in by default', () => {
    stubMatchMedia(false)
    render(<AnswerPassage answer="Redis was chosen [unit-b]." citations={citations} />)

    expect(screen.getByText(/Redis was chosen/).closest('p')).toHaveClass('animate-answer-settle')
    expect(screen.getByRole('link')).toHaveClass('animate-citation-ink-in')
  })

  it('skips the fade-up and marker stagger when reduced motion is preferred', () => {
    stubMatchMedia(true)
    render(<AnswerPassage answer="Redis was chosen [unit-b]." citations={citations} />)

    expect(screen.getByText(/Redis was chosen/).closest('p')).not.toHaveClass('animate-answer-settle')
    const link = screen.getByRole('link')
    expect(link).not.toHaveClass('animate-citation-ink-in')
    expect(link.style.animationDelay).toBe('')
  })

  it('renders citation markers numbered by first appearance in the text', () => {
    render(
      <AnswerPassage
        answer="Redis was chosen [unit-b] over Postgres, first proposed [unit-a]."
        citations={citations}
      />,
    )

    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveAccessibleName('Jump to source 1')
    expect(links[0]).toHaveTextContent('1')
    expect(links[1]).toHaveAccessibleName('Jump to source 2')
    expect(links[1]).toHaveTextContent('2')
  })

  it('reuses the same marker number when a citation repeats', () => {
    render(<AnswerPassage answer="[unit-a] and again [unit-a]." citations={citations} />)

    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveAccessibleName('Jump to source 1')
    expect(links[1]).toHaveAccessibleName('Jump to source 1')
  })

  it('renders unresolved bracket text as plain text, not a marker', () => {
    render(<AnswerPassage answer="Mentioned [not-a-citation] here." citations={citations} />)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText(/\[not-a-citation\]/)).toBeInTheDocument()
  })

  it('renders no markers when there are no citations', () => {
    render(<AnswerPassage answer="Nothing in the indexed history covers this." citations={[]} />)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
