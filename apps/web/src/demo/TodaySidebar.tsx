import { Link } from 'react-router';

import { Brand } from '../components/Brand.tsx';
import { Glyph, type GlyphName } from './Glyph.tsx';
import { SAMPLE } from './rules.ts';
import { EVENTS, type EventKey } from './today.ts';
import type { Tell } from './TodayParts.tsx';

const PLACES: readonly (readonly [string, GlyphName])[] = [
  ['Today', 'today'],
  ['Events', 'events'],
  ['Calendar', 'calendar'],
];

/** The iPad's sidebar at a desk: the places, your events by colour, and the person at its foot. */
export function TodaySidebar({
  events,
  tell,
  onToday,
}: {
  events: readonly EventKey[];
  tell: Tell;
  onToday: () => void;
}) {
  return (
    <nav className="today-side" aria-label="Soirely">
      <div className="today-logo">
        <Brand lockup />
      </div>
      <button
        type="button"
        className="today-org"
        aria-label={`${SAMPLE.organisation}. Switch organisation`}
        onClick={() => tell('Switching organisation has its own design.')}
      >
        <span className="today-org-tile" aria-hidden="true">
          IE
        </span>
        <span className="today-grow">{SAMPLE.organisation}</span>
        <Glyph name="updown" size={15} />
      </button>
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
            <button
              type="button"
              className={label === 'Today' ? 'today-place is-on' : 'today-place'}
              aria-current={label === 'Today' ? 'page' : undefined}
              onClick={() => (label === 'Today' ? onToday() : tell(`${label} has its own design.`))}
            >
              <Glyph name={glyph} />
              {label}
            </button>
          </li>
        ))}
      </ul>
      {events.length > 0 && (
        <div className="today-side-events">
          <h2 className="today-caps">Your events</h2>
          <ul className="today-places">
            {events.map((key) => (
              <li key={key}>
                <button
                  type="button"
                  className="today-place"
                  onClick={() => tell(`${EVENTS[key].name} has its own design.`)}
                >
                  <span className={`today-dot is-${key} is-side`} aria-hidden="true" />
                  <span className="today-grow today-ellipsis">{EVENTS[key].name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="today-grow" />
      <div className="today-places">
        <Link className="today-place" to="/demo">
          <Glyph name="settings" />
          Settings
        </Link>
        <button
          type="button"
          className="today-person"
          aria-label={`${SAMPLE.name}, Owner`}
          onClick={() => tell('Your account has its own design.')}
        >
          <span className="today-avatar today-cover is-draft" aria-hidden="true">
            FA
          </span>
          <span className="today-grow today-person-words" aria-hidden="true">
            <span className="today-person-name">{SAMPLE.name}</span>
            <span className="today-person-role">Owner</span>
          </span>
          <Glyph name="updown" size={15} />
        </button>
      </div>
    </nav>
  );
}
