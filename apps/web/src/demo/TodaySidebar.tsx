import { Link } from 'react-router';

import { DeskPersonFace, type DeskPerson, DeskSidebar } from '../components/DeskSidebar.tsx';
import { TODAY_IDS } from './events.ts';
import { Glyph, type GlyphName } from '../components/Glyph.tsx';
import { OrgSwitcher } from './OrgSwitcher.tsx';
import { SAMPLE } from './rules.ts';
import { EVENTS, type EventKey } from './today.ts';
import type { Tell } from '../components/SettingsParts.tsx';

const PLACES: readonly (readonly [string, GlyphName])[] = [
  ['Today', 'today'],
  ['Events', 'events'],
  ['Calendar', 'calendar'],
];

const FOLAKE: DeskPerson = { name: SAMPLE.name, initials: 'FA', role: 'Owner' };

/** The iPad's sidebar at a desk: the places, your events by colour, and the person at its foot. Events, Calendar or Settings selects its place; Settings names who is looking. */
export function TodaySidebar({
  events,
  tell,
  onToday,
  settings = false,
  listing = false,
  calendar = false,
  person = FOLAKE,
  inert = false,
}: {
  events: readonly EventKey[];
  tell: Tell;
  onToday?: () => void;
  settings?: boolean;
  listing?: boolean;
  calendar?: boolean;
  person?: DeskPerson | undefined;
  inert?: boolean;
}) {
  return (
    <DeskSidebar
      label="Soirely"
      inert={inert}
      pill={<OrgSwitcher tell={tell} toast={settings} />}
      foot={
        <>
          <Link
            className={settings ? 'today-place is-on' : 'today-place'}
            to={settings ? '/demo/settings' : '/demo'}
            aria-current={settings ? 'page' : undefined}
          >
            <Glyph name="settings" />
            Settings
          </Link>
          <button
            type="button"
            className="today-person"
            aria-label={person.role == null ? person.name : `${person.name}, ${person.role}`}
            onClick={() => tell('Your account has its own design.')}
          >
            <DeskPersonFace person={person} />
          </button>
        </>
      }
    >
      <button
        type="button"
        className="today-search"
        aria-keyshortcuts="Meta+K Control+K"
        onClick={() => tell('Search has its own design.')}
      >
        <Glyph name="search" size={16} />
        <span className="today-grow">Search</span>
        <kbd className="today-key">⌘K</kbd>
      </button>
      <ul className="today-places">
        {PLACES.map(([label, glyph]) => (
          <li key={label}>
            {label === 'Events' ? (
              <Link
                className={listing ? 'today-place is-on' : 'today-place'}
                to="/demo/events"
                aria-current={listing ? 'page' : undefined}
              >
                <Glyph name={glyph} />
                {label}
              </Link>
            ) : label === 'Calendar' ? (
              <Link
                className={calendar ? 'today-place is-on' : 'today-place'}
                to="/demo/calendar"
                aria-current={calendar ? 'page' : undefined}
              >
                <Glyph name={glyph} />
                {label}
              </Link>
            ) : (settings || listing || calendar) && label === 'Today' ? (
              <Link className="today-place" to="/demo/today">
                <Glyph name={glyph} />
                {label}
              </Link>
            ) : (
              <button
                type="button"
                className={label === 'Today' ? 'today-place is-on' : 'today-place'}
                aria-current={label === 'Today' ? 'page' : undefined}
                onClick={() =>
                  label === 'Today' ? onToday?.() : tell(`${label} has its own design.`)
                }
              >
                <Glyph name={glyph} />
                {label}
              </button>
            )}
          </li>
        ))}
      </ul>
      {events.length > 0 && (
        <div className="today-side-events">
          <h2 className="today-caps">Your events</h2>
          <ul className="today-places">
            {events.map((key) => (
              <li key={key}>
                <Link className="today-place" to={`/demo/events/${TODAY_IDS[key]}`}>
                  <span className={`today-dot is-${key} is-side`} aria-hidden="true" />
                  <span className="today-grow today-ellipsis">{EVENTS[key].name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </DeskSidebar>
  );
}
