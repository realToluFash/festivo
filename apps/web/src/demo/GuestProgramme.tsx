import { useState } from 'react';

import { EVENT, type Visit, dayOf, tagOf } from './guest.ts';
import {
  DEMO_CLOCK,
  type GuestItem,
  LIVE_MARKS,
  byDay,
  dateTimeOf,
  guestProgramme,
  headingOf,
  isHappening,
  laterBy,
  programmeWords,
  scheduleOf,
  showsPlaces,
  showsProgramme,
  timeText,
  wallIn,
} from './guestProgramme.ts';
import './guestProgramme.css';

/** sc-3899's The day (Programme across event days): time, title and, with more than one place, the place. */
export function Programme({ visit }: { visit: Visit }) {
  const [moved, setMoved] = useState(0);

  if (!showsProgramme(visit)) return null;

  const live = isHappening(visit)
    ? { at: laterBy(wallIn(visit.now, EVENT.timeZone), moved), marks: LIVE_MARKS }
    : null;
  const items = guestProgramme(scheduleOf(visit.programme), live);
  const days = byDay(items);
  const places = showsPlaces(items);
  const locale = tagOf(visit.lang);
  const words = programmeWords(visit.lang);

  return (
    <section className="gp-day-block gp-prog" aria-labelledby="gp-prog-h">
      <h2 id="gp-prog-h" className="gp-h2">
        {headingOf(items, visit.lang)}
      </h2>
      {visit.readerZone !== EVENT.timeZone && (
        <p className="gp-prog-zone">{words.zone(EVENT.timeZone)}</p>
      )}
      {days.length === 1 ? (
        <Items items={items} places={places} locale={locale} />
      ) : (
        <div className="gp-prog-days">
          {days.map((one) => (
            <div key={one.day} className="gp-prog-day">
              <h3 className="gp-prog-h3">{dayOf(one.day, visit.lang)}</h3>
              <Items items={one.items} places={places} locale={locale} />
            </div>
          ))}
        </div>
      )}
      {live != null && (
        <div className="gp-prog-demo">
          <p>{DEMO_CLOCK.line}</p>
          <button type="button" className="gp-text" onClick={() => setMoved((was) => was + 5)}>
            {DEMO_CLOCK.move}
          </button>
        </div>
      )}
    </section>
  );
}

function Items({
  items,
  places,
  locale,
}: {
  items: readonly GuestItem[];
  places: boolean;
  locale: string;
}) {
  return (
    <ul className="gp-prog-list">
      {items.map((one) => (
        <li key={one.id} className="gp-prog-item">
          <time className="gp-prog-time" dateTime={dateTimeOf(one.startsAt, EVENT.timeZone)}>
            {timeText(one, locale)}
          </time>
          <span className="gp-prog-what" dir="auto">
            <span className="gp-prog-title">{one.title}</span>
            {places && one.place != null && (
              <span className="gp-prog-place">{` · ${one.place}`}</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
