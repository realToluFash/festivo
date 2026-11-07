import { Link } from 'react-router';

import { Brand } from '../components/Brand.tsx';
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
  ['Vendors', 'vendors'],
];

const FOLAKE: SidebarPerson = { name: SAMPLE.name, initials: 'FA', role: 'Owner' };

export interface SidebarPerson {
  name: string;
  initials: string;
  role: string;
}

/** The iPad's sidebar at a desk: the places, your events by colour, and the person at its foot. Events, Calendar, Vendors or Settings selects its place; Settings names who is looking. A member has no Vendors (sc-82). */
export function TodaySidebar({
  events,
  tell,
  onToday,
  settings = false,
  listing = false,
  calendar = false,
  vendors = false,
  person = FOLAKE,
  inert = false,
}: {
  events: readonly EventKey[];
  tell: Tell;
  onToday?: () => void;
  settings?: boolean;
  listing?: boolean;
  calendar?: boolean;
  vendors?: boolean;
  person?: SidebarPerson;
  inert?: boolean;
}) {
  return (
    <nav className="today-side" aria-label="Soirely" inert={inert}>
      <div className="today-logo">
        <Brand lockup />
      </div>
      <OrgSwitcher tell={tell} toast={settings} />
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
        {PLACES.filter(([label]) => label !== 'Vendors' || person.role !== 'Member').map(
          ([label, glyph]) => (
            <li key={label}>
              {label === 'Vendors' ? (
                <Link
                  className={vendors ? 'today-place is-on' : 'today-place'}
                  to="/demo/vendors"
                  aria-current={vendors ? 'page' : undefined}
                >
                  <Glyph name={glyph} />
                  {label}
                </Link>
              ) : label === 'Events' ? (
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
              ) : (settings || listing || calendar || vendors) && label === 'Today' ? (
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
          ),
        )}
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
      <div className="today-grow" />
      <div className="today-places">
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
          aria-label={`${person.name}, ${person.role}`}
          onClick={() => tell('Your account has its own design.')}
        >
          <span className="today-avatar today-cover is-draft" aria-hidden="true">
            {person.initials}
          </span>
          <span className="today-grow today-person-words" aria-hidden="true">
            <span className="today-person-name">{person.name}</span>
            <span className="today-person-role">{person.role}</span>
          </span>
          <Glyph name="updown" size={15} />
        </button>
      </div>
    </nav>
  );
}
