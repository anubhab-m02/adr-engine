// Saved decisions (bookmarked from a SourceCard), shown on the Library page.
// Each item links to its original commit/PR URL.
import useBookmarks from '../lib/useBookmarks.js'

function BookmarksList() {
  const { list, toggle } = useBookmarks()
  const bookmarks = list()

  return (
    <section className="mt-8" aria-labelledby="saved-decisions-heading">
      <h2 id="saved-decisions-heading" className="font-reading text-ink">
        Saved decisions
      </h2>
      {bookmarks.length === 0 ? (
        <p className="mt-2 text-sm text-ink-muted">
          No saved decisions yet. Use the Save button on a source card to keep one here.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {bookmarks.map((bookmark) => (
            <li key={bookmark.url} className="flex items-center justify-between gap-3">
              <a
                href={bookmark.url}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-ink underline"
              >
                {bookmark.title || bookmark.url}
              </a>
              <button
                type="button"
                onClick={() => toggle(bookmark)}
                aria-label={`Remove saved decision: ${bookmark.title || bookmark.url}`}
                className="text-sm text-ink-muted underline"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default BookmarksList
