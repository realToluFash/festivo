import { useState } from 'react';

import { Glyph } from '../components/Glyph.tsx';
import type { Visit } from './guest.ts';
import {
  TABLE_6,
  TABLE_WORDS,
  companionLine,
  headingOf,
  placeOf,
  shownSeat,
} from './guestTable.ts';
import './guestTable.css';

/** sc-4022's Your table: under the answer, or between Where and The day on the event's day. */
export function YourTable({ visit, onTheDay = false }: { visit: Visit; onTheDay?: boolean }) {
  const [moved, setMoved] = useState(false);
  const shown = shownSeat(visit);

  if (shown?.seat == null) return null;
  const seat = moved ? TABLE_6 : shown.seat;
  const heading = headingOf(seat);

  return (
    <section
      className={onTheDay ? 'gp-day-block gp-table' : 'gp-block gp-table'}
      aria-label={heading}
    >
      <div className="gp-table-live" aria-live="polite">
        {onTheDay ? (
          <>
            <h2 className="gp-h2">{heading}</h2>
            <p className="gp-table-line">
              <Glyph name="seating" size={20} weight={2} />
              <span>{placeOf(seat)}</span>
            </p>
          </>
        ) : (
          <p className="gp-table-line is-lead">
            <Glyph name="seating" size={20} weight={2} />
            <span>{`${heading}: ${placeOf(seat)}`}</span>
          </p>
        )}
        {shown.elsewhere.length > 0 && (
          <ul className="gp-table-elsewhere">
            {shown.elsewhere.map((one, index) => (
              <li key={index}>{companionLine(one)}</li>
            ))}
          </ul>
        )}
      </div>
      {visit.tableMoves && (
        <div className="gp-prog-demo">
          <p>{TABLE_WORDS.demoMove}</p>
          {!moved && (
            <button type="button" className="gp-text" onClick={() => setMoved(true)}>
              {TABLE_WORDS.move}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
