import { Link, useSearchParams } from 'react-router';

import { DeskEvents } from '../components/DeskEvents.tsx';
import { DeskPersonFace, type DeskPerson, DeskSidebar } from '../components/DeskSidebar.tsx';
import { sampleEvents, TODAY_IDS } from './events.ts';
import { Glyph, type GlyphName } from '../components/Glyph.tsx';
import { OrgSwitcher } from './OrgSwitcher.tsx';
import { SearchRow } from './Search.tsx';
import { SAMPLE } from './rules.ts';
import { EVENTS, type EventKey } from './today.ts';
import type { Tell } from '../components/SettingsParts.tsx';
import type { ShownEvent } from '../components/today.ts';

const PLACES: readonly (readonly [string, GlyphName])[] = [
  ['Today', 'today'],
  ['Events', 'events'],
  ['Calendar', 'calendar'],
];

const FOLAKE: DeskPerson = { name: SAMPLE.name, initials: 'FA', role: 'Owner' };

/** `?sidebar=none` lists nothing and `?sidebar=many` all twenty sample events, past ones borrowed only for length, longer than the sidebar at 1280 × 800, on every screen that has it (sc-39290). */
function sideEvents(events: readonly EventKey[], asked: string | null): ShownEvent[] {
  if (asked === 'none') return [];
  if (asked === 'many') return sampleEvents().map(({ id, name, mesh }) => ({ id, name, mesh }));

  return events.map((key) => ({ id: TODAY_IDS[key], name: EVENTS[key].name, mesh: key }));
}

/** The iPad's sidebar at a desk: the places, your events by colour, and the person at its foot. With no events it has no heading; a list longer than the sidebar scrolls inside it, under the places and over the foot. Events, Calendar or Settings selects its place; Settings names who is looking. */
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
  const [params] = useSearchParams();
  const listed = sideEvents(events, params.get('sidebar'));

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
      <SearchRow />
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
      <DeskEvents heading="Your events" events={listed} to={(id) => `/demo/events/${id}`} />
    </DeskSidebar>
  );
}
