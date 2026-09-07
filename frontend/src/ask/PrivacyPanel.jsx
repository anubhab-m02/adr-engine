// Design principle 4 ("earn the privacy claim on-screen"): show exactly
// what left the machine for this answer instead of just asserting privacy.
// `cloudSynthesisFields` is read verbatim from QueryResponse rather than a
// hardcoded guess, so it can never drift out of sync with what
// synthesis/answer.py actually sends.
function PrivacyPanel({ sentToCloud, cloudSynthesisFields }) {
  if (!sentToCloud) {
    return (
      <p className="text-sm text-ink-muted">Nothing left this machine for this answer.</p>
    )
  }

  return (
    <div>
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
    </div>
  )
}

export default PrivacyPanel
