import SourceCard from './SourceCard.jsx'

// Shared "render one SourceCard per citation" shape, used both under a
// synthesized answer (MessageList, wrapped) and in SourcesView's
// degraded mode (stacked). Layout differs by className; the list logic
// doesn't.
function SourceCardList({ citations, className = 'flex flex-wrap gap-4' }) {
  return (
    <div className={className}>
      {citations.map((unit) => (
        <SourceCard key={unit.url} unit={unit} />
      ))}
    </div>
  )
}

export default SourceCardList
