import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Link, useNavigate } from 'react-router';

import { Brand } from '../components/Brand.tsx';
import { SIDE_AREA_GLYPHS } from '../components/eventSideAreas.ts';
import { Glyph, type GlyphName } from '../components/Glyph.tsx';
import { Avatar, Chevron, RowWords, type Tell } from '../components/SettingsParts.tsx';
import { Toast } from '../components/Toast.tsx';
import { DOOR_EVENT, DOOR_PLACE } from './doorCode.ts';
import {
  JOINED,
  NO_ORG,
  NO_ORG_VENUE,
  type NoOrgState,
  levelLine as doorLevelLine,
  noOrgStart,
  whenLine as doorWhenLine,
} from './noOrg.ts';
import {
  NO_ORG_HOME,
  OUTSIDE,
  type Outside,
  type OutsideArea,
  type OutsideEvent,
  type OutsidePage,
  VENUES,
  type WayBack,
  areasAt,
  askAgain,
  coverOf,
  inOrder,
  levelLine,
  onEventOf,
  openingOf,
  outsideEvent,
  rowLabel,
  startOutside,
  underWay,
  useOutside,
  wallClock,
  wallDay,
  wayBack,
  whenLine,
} from './outsideEvents.ts';
import { EventRowWords, PlaceRowWords } from './OutsideRows.tsx';
import { SAMPLE } from './rules.ts';
import { switchTo, useWhere } from './switcher.ts';
import './today.css';
import '../components/SettingsParts.css';
import '../components/eventPage.css';
import './events.css';
import './people.css';
import './doorCode.css';
import './outsideEvents.css';

const WORDS: Record<OutsideArea, string> = {
  overview: NO_ORG.overview,
  guests: NO_ORG.guests,
  menu: 'Menu',
  seating: NO_ORG.seating,
  messages: 'Messages',
  schedule: NO_ORG.schedule,
  staff: 'Staff',
  people: NO_ORG.people,
  reports: 'Reports',
};

const GLYPHS: Record<OutsideArea, GlyphName> = SIDE_AREA_GLYPHS;

const PIECES = [1, 2, 3, 4, 5, 6];

const EDGE = 12;

interface Person {
  name: string;
  initials: string;
  tone: number;
  role: string;
}

type Groups = ((close: (back: boolean) => void) => ReactNode) | null;

function MenuGroups({
  groups,
  close,
}: {
  groups: NonNullable<Groups>;
  close: (back: boolean) => void;
}) {
  return groups(close);
}

function useTell(): [string | null, Tell, () => void] {
  const [told, setTold] = useState<string | null>(null);
  const tell = useCallback<Tell>((words) => setTold(words), []);

  return [told, tell, () => setTold(null)];
}

/** Inside the event it joined, at a desk, for an account with no organisation: its level's areas only, and Your account and Sign out from the person button (sc-71). */
export function NoOrgEvent({ state }: { state: NoOrgState }) {
  const [start] = useState(() => noOrgStart(state));
  const [told, tell, clear] = useTell();

  return (
    <Shell
      card={{ name: DOOR_EVENT, when: DOOR_PLACE.when, cover: 'wed' }}
      areas={start.areas}
      current="overview"
      person={{ ...start, role: start.code.role }}
      opening={start.menu}
      groups={null}
      tell={tell}
      told={told}
      onToastClose={clear}
    >
      <EventMain
        name={DOOR_EVENT}
        cover="wed"
        when={doorWhenLine()}
        venue={NO_ORG_VENUE}
        level={doorLevelLine(start.code)}
        guests={NO_ORG.guestsLine}
        onEvent={start.onEvent}
        tell={tell}
      />
    </Shell>
  );
}

function shellOf(now: Outside, way: WayBack | null, from: string | null): string | undefined {
  if (way?.kind === 'event') return way.event.id;

  return from != null && !now.gone.includes(from) ? from : undefined;
}

/** An event joined from outside (sc-68438): the person menu lists the account's other events, and a member's organisations. */
export function OutsideEventPage({
  id,
  page,
  from,
  menu,
}: {
  id: string;
  page: OutsidePage;
  from: string | null;
  menu: boolean;
}) {
  const [opening] = useState(() => {
    if (page === 'outside-gone-page' && from == null) startOutside('outside-several');
    if (page === 'outside-in' || page === 'outside-gone-page') return menu;

    startOutside(page);
    return true;
  });
  const outside = useOutside();
  const where = useWhere();
  const navigate = useNavigate();
  const [told, tell, clear] = useTell();
  const gone = page === 'outside-gone-page';
  const way = gone ? wayBack(outside, id, from) : null;
  const event = outsideEvent(gone ? shellOf(outside, way, from) : id);
  const [name, initials, tone] = JOINED.joao;
  const person: Person = outside.member
    ? { name: SAMPLE.name, initials: 'FA', tone: 1, role: event.role }
    : { name, initials, tone, role: event.role };
  const listed = outside.held.length > 1;

  const groups: Groups =
    !outside.member && !listed
      ? null
      : (close) => (
          <>
            {outside.member && (
              <Group heading={OUTSIDE.yourOrganisations}>
                {where.places.map((place) => (
                  <button
                    key={place.id}
                    type="button"
                    role="menuitem"
                    tabIndex={-1}
                    className="desk-menu-item oe-row"
                    aria-label={`${place.name}. ${place.role}`}
                    onClick={() => {
                      switchTo(place, '/demo/today');
                      void navigate('/demo/today');
                    }}
                  >
                    <PlaceRowWords id={place.id} name={place.name} role={place.role} />
                  </button>
                ))}
              </Group>
            )}
            {listed && (
              <Group heading={OUTSIDE.yourEvents}>
                {inOrder(outside.held).map((one) => {
                  const here = one.id === event.id;

                  return (
                    <button
                      key={one.id}
                      type="button"
                      role="menuitem"
                      tabIndex={-1}
                      className="desk-menu-item oe-row"
                      aria-label={rowLabel(one, { now: underWay(one), here })}
                      onClick={() => {
                        close(here);
                        if (!here) void navigate(openingOf(one, event.id, outside));
                      }}
                    >
                      <EventRowWords event={one} here={here} />
                    </button>
                  );
                })}
              </Group>
            )}
          </>
        );

  return (
    <Shell
      card={{ name: event.name, when: shortWhen(event), cover: coverOf(event) }}
      areas={areasAt(event.role)}
      current={gone ? null : 'overview'}
      person={person}
      opening={opening}
      groups={groups}
      tell={tell}
      told={told}
      onToastClose={clear}
    >
      {way != null ? (
        <NotFound
          way={way}
          onBack={() => {
            askAgain(id);
            if (way.kind === 'event')
              void navigate(`/demo/events/${way.event.id}?state=outside-in&menu=open`);
            else if (way.kind === 'continue') void navigate(NO_ORG_HOME);
          }}
        />
      ) : (
        <EventMain
          name={event.name}
          cover={coverOf(event)}
          when={whenLine(event)}
          venue={VENUES[event.id] ?? NO_ORG_VENUE}
          level={levelLine(event)}
          guests={event.role === 'Can edit' ? null : NO_ORG.guestsLine}
          onEvent={onEventOf(event.id)}
          tell={tell}
        />
      )}
    </Shell>
  );
}

function shortWhen(event: OutsideEvent): string {
  return underWay(event)
    ? `${OUTSIDE.underWay} · until ${wallClock(event.endsAt)}`
    : `${wallDay(event.startsAt)} · ${wallClock(event.startsAt)}`;
}

function Group({ heading, children }: { heading: string; children: ReactNode }) {
  const id = useId();

  return (
    <div role="group" aria-labelledby={id} className="oe-group">
      <span id={id} className="oe-heading">
        {heading}
      </span>
      {children}
    </div>
  );
}

/** The sidebar of an event held from outside (sc-71): its card, its level's areas and the person, with no organisation, Search or Events. */
export function OutsideSide({
  card,
  areas,
  current,
  person,
  opening = false,
  groups = null,
  tell,
  inert = false,
}: {
  card: { name: string; when: string; cover: string };
  areas: readonly OutsideArea[];
  current: OutsideArea | null;
  person: Person;
  opening?: boolean;
  groups?: Groups;
  tell: Tell;
  inert?: boolean;
}) {
  return (
    <nav className="today-side people-side" aria-label={card.name} inert={inert}>
      <div className="today-logo">
        <Brand lockup />
      </div>
      <div className="people-event">
        <div className="people-event-card">
          <span className={`today-cover is-${card.cover} people-event-cover`} aria-hidden="true" />
          <span className="today-grow">
            <span className="people-event-name">{card.name}</span>
            <span className="people-event-when">{card.when}</span>
          </span>
        </div>
      </div>
      <ul className="today-places">
        {areas.map((area) => (
          <li key={area}>
            <button
              type="button"
              className={area === current ? 'today-place is-on' : 'today-place'}
              aria-current={area === current ? 'page' : undefined}
              onClick={() => area !== current && tell(NO_ORG.later(WORDS[area]))}
            >
              <Glyph name={GLYPHS[area]} />
              {WORDS[area]}
            </button>
          </li>
        ))}
      </ul>
      <div className="today-grow" />
      <PersonMenu person={person} opening={opening} groups={groups} tell={tell} />
    </nav>
  );
}

function Shell({
  card,
  areas,
  current,
  person,
  opening,
  groups,
  tell,
  told,
  onToastClose,
  children,
}: {
  card: { name: string; when: string; cover: string };
  areas: readonly OutsideArea[];
  current: OutsideArea | null;
  person: Person;
  opening: boolean;
  groups: Groups;
  tell: Tell;
  told: string | null;
  onToastClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="today desk">
      <OutsideSide
        card={card}
        areas={areas}
        current={current}
        person={person}
        opening={opening}
        groups={groups}
        tell={tell}
      />
      <main id="content" className="desk-main">
        <div className="desk-page">
          <div className="desk-column">{children}</div>
        </div>
      </main>
      {told != null && <Toast key={told} words={told} onClose={onToastClose} />}
    </div>
  );
}

function EventMain({
  name,
  cover,
  when,
  venue,
  level,
  guests,
  onEvent,
  tell,
}: {
  name: string;
  cover: string;
  when: string;
  venue: string;
  level: string;
  guests: string | null;
  onEvent: number;
  tell: Tell;
}) {
  return (
    <>
      <section className={`ev-card today-cover is-${cover}`} aria-labelledby="no-org-event">
        {PIECES.map((piece) => (
          <span key={piece} className={`desk-piece p${piece}`} aria-hidden="true" />
        ))}
        <div className="ev-card-inner">
          <p className="desk-on-card">{when}</p>
          <h1 id="no-org-event" className="ev-card-name" tabIndex={-1}>
            {name}
          </h1>
          <p className="desk-on-card">{venue}</p>
          <p className="desk-on-card">{level}</p>
        </div>
      </section>
      <ul className="desk-rows has-lead">
        {(
          [
            ['guests', guests],
            ['people', NO_ORG.onEvent(onEvent)],
          ] as const
        ).map(([area, line]) => (
          <li key={area}>
            <button
              type="button"
              className="desk-row"
              onClick={() => tell(NO_ORG.later(NO_ORG[area]))}
            >
              <span className="no-org-lead" aria-hidden="true">
                <Glyph name={GLYPHS[area]} size={20} />
              </span>
              <RowWords title={NO_ORG[area]} lines={line == null ? [] : [line]} />
              <Chevron />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

/** The web's event not-found: a member keeps the Events crumb; with no organisation there is no Events, so it goes back to an event, or on to the no-organisation home. */
function NotFound({ way, onBack }: { way: WayBack; onBack: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => heading.current?.focus(), []);

  return (
    <section className="card oe-gone">
      {way.kind === 'events' && (
        <nav className="ev-crumb" aria-label={OUTSIDE.events}>
          <ol>
            <li className="ev-crumb-part">
              <Link to="/demo/events" onClick={onBack}>
                {OUTSIDE.events}
              </Link>
            </li>
          </ol>
        </nav>
      )}
      <h1 ref={heading} tabIndex={-1}>
        {OUTSIDE.notFound}
      </h1>
      {way.kind !== 'events' && (
        <button type="button" className="button" onClick={onBack}>
          {way.kind === 'event' ? OUTSIDE.backTo(way.event.name) : OUTSIDE.continue}
        </button>
      )}
    </section>
  );
}

/** The person button at the sidebar's foot, the desk's version of the app's More: the account's groups, then Your account and Sign out, as a menu. */
function PersonMenu({
  person,
  opening,
  groups,
  tell,
}: {
  person: Person;
  opening: boolean;
  groups: Groups;
  tell: Tell;
}) {
  const id = useId();
  const navigate = useNavigate();
  const [open, setOpen] = useState(opening);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const wide = groups != null;
  const items = () => [...(menu.current?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? [])];
  const close = useCallback((back: boolean) => {
    setOpen(false);
    if (back) button.current?.focus();
  }, []);

  useLayoutEffect(() => {
    const drop = menu.current;
    const opener = button.current;
    if (!open || !wide || drop == null || opener == null) return;

    const place = (): void => {
      const box = opener.getBoundingClientRect();
      drop.style.setProperty('left', `${box.left}px`);
      drop.style.setProperty('bottom', `${window.innerHeight - box.top + 4}px`);
      drop.style.setProperty('max-height', `${Math.max(0, box.top - EDGE)}px`);
    };
    place();
    window.addEventListener('resize', place);

    return () => window.removeEventListener('resize', place);
  }, [open, wide]);

  useEffect(() => {
    if (!open) return;
    items()[0]?.focus();
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menu.current?.contains(target) && !button.current?.contains(target)) close(false);
    };
    document.addEventListener('pointerdown', outside);

    return () => document.removeEventListener('pointerdown', outside);
  }, [open, close]);

  function keys(event: KeyboardEvent): void {
    const all = items();
    const at = all.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    } else if (event.key === 'Tab') close(false);
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = at + (event.key === 'ArrowDown' ? 1 : -1);
      all[(next + all.length) % all.length]?.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      (event.key === 'Home' ? all[0] : all.at(-1))?.focus();
    }
  }

  return (
    <div className="today-places no-org-person">
      {open && (
        <div
          ref={menu}
          id={`${id}-menu`}
          className={wide ? 'desk-menu no-org-menu is-wide' : 'desk-menu no-org-menu'}
          role="menu"
          tabIndex={-1}
          aria-labelledby={`${id}-button`}
          onKeyDown={keys}
        >
          {groups != null && <MenuGroups groups={groups} close={close} />}
          <div role="none" className="oe-group">
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              className="desk-menu-item"
              onClick={() => {
                close(true);
                tell(NO_ORG.later(NO_ORG.yourAccount));
              }}
            >
              <span className="desk-menu-tick">
                <Glyph name="user" size={17} />
              </span>
              {NO_ORG.yourAccount}
            </button>
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              className="desk-menu-item"
              onClick={() => void navigate('/demo/redeem?state=signed-out')}
            >
              <span className="desk-menu-tick">
                <SignOutMark />
              </span>
              {NO_ORG.signOut}
            </button>
          </div>
        </div>
      )}
      <button
        ref={button}
        id={`${id}-button`}
        type="button"
        className="today-person"
        aria-label={`${person.name}, ${person.role}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        onClick={() => (open ? close(false) : setOpen(true))}
      >
        <Avatar initials={person.initials} tone={person.tone} size="small" />
        <span className="today-grow today-person-words" aria-hidden="true">
          <span className="today-person-name">{person.name}</span>
          <span className="today-person-role">{person.role}</span>
        </span>
        <Glyph name="updown" size={15} />
      </button>
    </div>
  );
}

function SignOutMark() {
  return (
    <svg
      width={17}
      height={17}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}
