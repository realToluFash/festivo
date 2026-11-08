import { Link } from 'react-router';

import { Brand } from '../components/Brand.tsx';
import { AREAS, type Area, type Card, type SampleEvent, cardOf } from './events.ts';
import { Thumb } from './EventParts.tsx';
import { Glyph, type GlyphName } from '../components/Glyph.tsx';
import { OrgSwitcher } from './OrgSwitcher.tsx';
import { SAMPLE } from './rules.ts';
import type { Tell } from '../components/SettingsParts.tsx';

const GLYPHS: Record<Area, GlyphName> = {
  overview: 'overview',
  guests: 'users',
  menu: 'menu',
  seating: 'seating',
  messages: 'messages',
  schedule: 'clock',
  staff: 'staff',
  people: 'people',
  budget: 'budget',
  reports: 'reports',
};

function whenOf(card: Card): string {
  return card.tags.map((tag) => tag.word).join(' · ');
}

/** Inside an event the sidebar is the event's, as on the web's People branch (sc-29915): ‹ Events and the event, its areas, Settings and you. The lit area is Ink, as the shell's. */
export function EventSidebar({
  event,
  area,
  now,
  tell,
  inert,
  waiting = null,
  without = [],
}: {
  event: SampleEvent;
  area: Area;
  now: Date;
  tell: Tell;
  inert: boolean;
  waiting?: { line: string; name: string } | null;
  without?: readonly Area[];
}) {
  return (
    <nav className="today-side ev-side" aria-label={event.name} inert={inert}>
      <div className="today-logo">
        <Brand lockup />
      </div>
      <OrgSwitcher tell={tell} toast />
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
      <div className="ev-side-event">
        <Link className="today-place ev-side-back" to="/demo/events">
          <Glyph name="back" size={17} weight={2.4} />
          Events
        </Link>
        <div className="ev-side-card">
          <Thumb event={event} size={40} />
          <span className="today-grow">
            <span className="ev-side-name">{event.name}</span>
            <span className="ev-side-when">{whenOf(cardOf(event, now))}</span>
          </span>
        </div>
      </div>
      <ul className="today-places">
        {AREAS.filter((one) => !without.includes(one.area)).map((one) => (
          <li key={one.area}>
            <Link
              className={[
                'today-place',
                one.area === area && 'is-on',
                one.area === 'messages' && waiting != null && 'has-line',
              ]
                .filter(Boolean)
                .join(' ')}
              to={
                one.area === 'people'
                  ? '/demo/people'
                  : one.area === 'overview'
                    ? `/demo/events/${event.id}`
                    : one.area === 'messages'
                      ? `/demo/events/${event.id}/messages`
                      : `/demo/events/${event.id}?area=${one.area}`
              }
              aria-current={one.area === area ? 'page' : undefined}
              aria-label={one.area === 'messages' && waiting != null ? waiting.name : undefined}
            >
              <Glyph name={GLYPHS[one.area]} />
              {one.area === 'messages' && waiting != null ? (
                <span className="ev-side-two">
                  <span>{one.name}</span>
                  <span className="ev-side-sub">{waiting.line}</span>
                </span>
              ) : (
                one.name
              )}
            </Link>
          </li>
        ))}
      </ul>
      <div className="today-grow" />
      <div className="today-places">
        <Link className="today-place" to="/demo/settings">
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
