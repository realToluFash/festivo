import { Link, useSearchParams } from 'react-router';
import type { ReactNode } from 'react';

import { DeskEvents } from '../components/DeskEvents.tsx';
import { DeskPersonFace, type DeskPerson, DeskSidebar } from '../components/DeskSidebar.tsx';
import { sampleEvents, TODAY_IDS } from './events.ts';
import { Glyph, type GlyphName } from '../components/Glyph.tsx';
import { OrgSwitcher } from './OrgSwitcher.tsx';
import { SearchRow } from './Search.tsx';
import { usePaused, useWhere } from './switcher.ts';
import { SAMPLE } from './rules.ts';
import { EVENTS, type EventKey } from './today.ts';
import './narrowDesk.css';
import './wideDesk.css';
import './deskReflow.css';
import type { Tell } from '../components/SettingsParts.tsx';
import type { ShownEvent } from '../components/today.ts';

const PLACES: readonly (readonly [string, GlyphName])[] = [
  ['Today', 'today'],
  ['Events', 'events'],
  ['Calendar', 'calendar'],
  ['Menu library', 'menu'],
];

const WITH_ENQUIRIES: readonly (readonly [string, GlyphName])[] = [
  ...PLACES.slice(0, 2),
  ['Enquiries', 'message'],
  ...PLACES.slice(2),
];

/** Two-factor overdue grants nothing, so only the places that need no permission stay, as the product's sidebar has it (sc-609, sc-93443). */
const OPEN_TO_ALL: readonly string[] = ['Today', 'Events', 'Calendar'];

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
  library = false,
  hideLibrary = false,
  person = FOLAKE,
  inert = false,
  phone = false,
  enquiries = false,
  free = false,
  bell,
}: {
  events: readonly EventKey[];
  tell: Tell;
  onToday?: () => void;
  settings?: boolean;
  listing?: boolean;
  calendar?: boolean;
  library?: boolean;
  hideLibrary?: boolean;
  person?: DeskPerson | undefined;
  inert?: boolean;
  /** At 40rem and under the sidebar is the phone's bar: the switcher and Menu (sc-13413), as on Today, Events and Calendar (sc-57468). */
  phone?: boolean;
  /** On Enquiries, which an Enterprise organisation has right after Events (sc-31226). */
  enquiries?: boolean;
  /** A Free organisation has no Enquiries; every other screen of the sample is Enterprise and lists it, and `?plan=free` shows any of them as Free (sc-31226). */
  free?: boolean;
  /** At 40rem and under on Settings, the bell at the bar's end, after Menu, as the product's shell has it (sc-13413). */
  bell?: ReactNode;
}) {
  const [params] = useSearchParams();
  const shown = usePaused() ? { ...person, role: null } : person;
  const listed = sideEvents(events, params.get('sidebar'));
  const { overdue } = useWhere();
  const offered = free || params.get('plan') === 'free' ? PLACES : WITH_ENQUIRIES;
  const places = overdue ? offered.filter(([label]) => OPEN_TO_ALL.includes(label)) : offered;

  return (
    <DeskSidebar
      label="Soirely"
      inert={inert}
      pill={<OrgSwitcher tell={tell} toast={settings} />}
      foot={
        <>
          <Link
            className={settings ? 'today-place is-on' : 'today-place'}
            to={settings || overdue ? '/demo/settings' : '/demo'}
            aria-current={settings ? 'page' : undefined}
          >
            <Glyph name="settings" />
            Settings
          </Link>
          <button
            type="button"
            className="today-person"
            aria-label={shown.role == null ? shown.name : `${shown.name}, ${shown.role}`}
            onClick={() => tell('Your account has its own design.')}
          >
            <DeskPersonFace person={shown} />
          </button>
        </>
      }
    >
      {phone && (
        <button
          type="button"
          className="dp-menu"
          onClick={() => tell('Menu has its own design (sc-13413).')}
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="M2 4h12M2 8h12M2 12h12" strokeLinecap="round" />
          </svg>
          Menu
        </button>
      )}
      {phone && bell}
      <SearchRow />
      <ul className="today-places">
        {places
          .filter(([label]) => !hideLibrary || label !== 'Menu library')
          .map(([label, glyph]) => (
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
              ) : label === 'Enquiries' ? (
                <Link
                  className={enquiries ? 'today-place is-on' : 'today-place'}
                  to="/demo/enquiries"
                  aria-current={enquiries ? 'page' : undefined}
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
              ) : label === 'Menu library' ? (
                <Link
                  className={library ? 'today-place is-on' : 'today-place'}
                  to="/demo/menu-library"
                  aria-current={library ? 'page' : undefined}
                >
                  <Glyph name={glyph} />
                  {label}
                </Link>
              ) : (settings || listing || calendar || library || enquiries) && label === 'Today' ? (
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
