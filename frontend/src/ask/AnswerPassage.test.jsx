import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AnswerPassage, { AnswerParagraph } from './AnswerPassage.jsx'
import { parseAnswer } from './parseAnswer.js'

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

  it('renders one <p> per paragraph for a multi-paragraph answer', () => {
    const { container } = render(
      <AnswerPassage
        answer={'Redis was chosen for caching [unit-a].\n\nPostgres stayed for the ledger [unit-b].'}
        citations={citations}
      />,
    )

    const paragraphs = container.querySelectorAll('p')
    expect(paragraphs).toHaveLength(2)
    expect(paragraphs[0]).toHaveTextContent('Redis was chosen for caching')
    expect(paragraphs[1]).toHaveTextContent('Postgres stayed for the ledger')
  })

  it('numbers markers by first appearance across the whole answer, not reset per paragraph', () => {
    render(
      <AnswerPassage
        answer={'Redis was chosen [unit-b].\n\nFirst proposed by [unit-a], then [unit-b] again.'}
        citations={citations}
      />,
    )

    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(3)
    expect(links[0]).toHaveAccessibleName('Jump to source 1')
    expect(links[1]).toHaveAccessibleName('Jump to source 2')
    expect(links[2]).toHaveAccessibleName('Jump to source 1')
  })

  it('renders a single <p> for a single-paragraph answer, unchanged from before', () => {
    const { container } = render(
      <AnswerPassage answer="Redis was chosen [unit-b]." citations={citations} />,
    )

    expect(container.querySelectorAll('p')).toHaveLength(1)
  })

  describe('reading density', () => {
    const [paragraph] = parseAnswer('Redis was chosen [unit-b].', citations)

    it('defaults to comfortable spacing', () => {
      render(<AnswerParagraph paragraph={paragraph} reducedMotion={false} />)

      const p = screen.getByText(/Redis was chosen/).closest('p')
      expect(p).toHaveClass('leading-[1.7]', 'mb-6')
    })

    it('renders tighter spacing classes for compact density', () => {
      render(<AnswerParagraph paragraph={paragraph} reducedMotion={false} density="compact" />)

      const p = screen.getByText(/Redis was chosen/).closest('p')
      expect(p).toHaveClass('leading-[1.4]', 'mb-3')
      expect(p).not.toHaveClass('leading-[1.7]', 'mb-6')
    })
  })

  describe('reading measure', () => {
    const [paragraph] = parseAnswer('Redis was chosen [unit-b].', citations)

    it('defaults to the 70ch column width', () => {
      render(<AnswerParagraph paragraph={paragraph} reducedMotion={false} />)

      expect(screen.getByText(/Redis was chosen/).closest('p')).toHaveClass('max-w-[70ch]')
    })

    it.each([
      ['narrow', 'max-w-[54ch]'],
      ['default', 'max-w-[70ch]'],
      ['wide', 'max-w-[86ch]'],
    ])('maps measure %s to %s', (measure, expectedClass) => {
      render(<AnswerParagraph paragraph={paragraph} reducedMotion={false} measure={measure} />)

      expect(screen.getByText(/Redis was chosen/).closest('p')).toHaveClass(expectedClass)
    })
  })
})
