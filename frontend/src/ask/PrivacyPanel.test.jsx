import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import PrivacyPanel from './PrivacyPanel.jsx'

describe('PrivacyPanel', () => {
  it('states nothing left the machine for a sources_only-mode response', () => {
    render(<PrivacyPanel sentToCloud={false} cloudSynthesisFields={null} />)

    expect(screen.getByText('Nothing left this machine for this answer.')).toBeInTheDocument()
  })

  it('lists the real field names for a synthesized-mode response', () => {
    render(
      <PrivacyPanel
        sentToCloud={true}
        cloudSynthesisFields={['id', 'title', 'decision', 'rationale', 'url']}
      />,
    )

    expect(screen.getByText('id')).toBeInTheDocument()
    expect(screen.getByText('title')).toBeInTheDocument()
    expect(screen.getByText('decision')).toBeInTheDocument()
    expect(screen.getByText('rationale')).toBeInTheDocument()
    expect(screen.getByText('url')).toBeInTheDocument()
    expect(screen.queryByText('source_excerpt')).not.toBeInTheDocument()
  })

  it('is a labelled region in both the not-sent and sent branches', () => {
    const name = 'Privacy: what was sent to the cloud'
    const { rerender } = render(<PrivacyPanel sentToCloud={false} cloudSynthesisFields={null} />)
    expect(screen.getByRole('region', { name })).toBeInTheDocument()

    rerender(<PrivacyPanel sentToCloud={true} cloudSynthesisFields={['id']} />)
    expect(screen.getByRole('region', { name })).toBeInTheDocument()
  })

  it('does not claim anything was sent when sentToCloud is false even if fields are present', () => {
    render(<PrivacyPanel sentToCloud={false} cloudSynthesisFields={['id']} />)

    expect(screen.getByText('Nothing left this machine for this answer.')).toBeInTheDocument()
    expect(screen.queryByText('id')).not.toBeInTheDocument()
  })
})
