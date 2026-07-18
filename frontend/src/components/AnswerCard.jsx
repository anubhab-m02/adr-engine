import CitationCard from './CitationCard.jsx'

function AnswerCard({ answer, citations }) {
  const hasCitations = citations.length > 0

  return (
    <div
      className={`max-w-3xl rounded-xl bg-panel p-4 ${hasCitations ? 'text-ink' : 'text-ink-muted'}`}
    >
      <p className="text-base">{answer}</p>
      {hasCitations && (
        <div className="mt-4 flex flex-wrap gap-4">
          {citations.map((unit) => (
            <CitationCard key={unit.url} unit={unit} />
          ))}
        </div>
      )}
    </div>
  )
}

export default AnswerCard
