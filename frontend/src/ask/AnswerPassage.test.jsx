import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import AnswerPassage from './AnswerPassage.jsx'

const citations = [
  { id: 'unit-a', url: 'https://github.com/owner/repo/pull/1' },
  { id: 'unit-b', url: 'https://github.com/owner/repo/commit/abc' },
]

describe('AnswerPassage', () => {
  it('renders the answer text', () => {
    render(<AnswerPassage answer="We use OAuth2 for auth [unit-a]." citations={citations} />)

    expect(screen.getByText(/We use OAuth2 for auth/)).toBeInTheDocument()
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
