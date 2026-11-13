import { type Contact, UNDELIVERABLE_WORDS as W } from './account.ts';
import './undeliverable.css';

/** Closing Email addresses, one line per address Soirely stopped sending to, each with Change email. */
export function UndeliverableLines({
  rows,
  onChange,
}: {
  rows: readonly Contact[];
  onChange: (row: Contact) => void;
}) {
  if (rows.length === 0) return null;

  return (
    <ul className="undeliverable-lines" data-testid="account.undeliverable">
      {rows.map((row) => (
        <li key={row.id} className="undeliverable-line">
          <span className="undeliverable-lead" aria-hidden="true">
            <span className="undeliverable-mark">
              <svg width="10" height="10" viewBox="0 0 10 10">
                <path
                  d="M2.2 2.2l5.6 5.6M7.8 2.2l-5.6 5.6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </span>
          <div className="undeliverable-words">
            <p>{W.line(row.shown)}</p>
            <button
              type="button"
              className="desk-text"
              aria-label={W.changeFor(row.shown)}
              onClick={() => onChange(row)}
            >
              {W.change}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
