/** Members' first read: the card sunk, with four people's rows under it. */
export function MembersLoading({ words }: { words: string }) {
  return (
    <div className="desk-loading" role="status" aria-label={words}>
      <span className="desk-unseen" data-page-waits>
        {words}
      </span>
      <span className="desk-sunk is-card" aria-hidden="true" />
      <ul className="desk-rows has-lead" aria-hidden="true">
        {[1, 2, 3, 4].map((bar) => (
          <li key={bar} className="desk-row is-bones">
            <span className="desk-sunk is-face" />
            <span className="desk-row-words">
              <span className={`desk-sunk is-title b${bar}`} />
              <span className={`desk-sunk is-line b${bar}`} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
