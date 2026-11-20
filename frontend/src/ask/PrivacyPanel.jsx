// Design principle 4 ("earn the privacy claim on-screen"): show exactly
// what left the machine for this answer instead of just asserting privacy.
// `cloudSynthesisFields` is read verbatim from QueryResponse rather than a
// hardcoded guess, so it can never drift out of sync with what
// synthesis/answer.py actually sends.
const REGION_LABEL = 'Privacy: what was sent to the cloud'

function PrivacyPanel({ sentToCloud, cloudSynthesisFields }) {
  if (!sentToCloud) {
    return (
      <section aria-label={REGION_LABEL}>
        <p className="text-sm text-ink-muted">Nothing left this machine for this answer.</p>
      </section>
    )
  }

  return (
    <section aria-label={REGION_LABEL}>
      <p className="text-sm text-ink-muted">
        These fields were sent to the cloud model to synthesize this answer:
      </p>
      <ul className="mt-1 list-disc pl-5 text-sm text-ink-muted">
        {(cloudSynthesisFields ?? []).map((field) => (
          <li key={field} className="font-mono">
            {field}
          </li>
        ))}
      </ul>
    </section>
  )
}

export default PrivacyPanel
