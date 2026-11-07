import { initials } from '@soirely/domain';
import {
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';

import { leaveMenu } from '../leaving.ts';
import { CreateWalk } from './CreateOrg.tsx';
import { type Walk, freshWalk, isCreateState, walkOf } from './createOrg.ts';
import { meshFor } from './events.ts';
import { Glyph } from '../components/Glyph.tsx';
import { focusWhenFree } from '../layers.ts';
import { Notice } from '../components/Notice.tsx';
import { SAMPLE } from './rules.ts';
import {
  BLUEBIRD,
  type Invitation,
  OFFER,
  type OfferStanding,
  PAUSED,
  type Place,
  SEARCH_FROM,
  type Where,
  NEW_PLACE,
  ask,
  askToOpen,
  colourArrived,
  columnsOf,
  create,
  currentPlace,
  dayOf,
  decline,
  holds,
  isSwitcherState,
  join,
  matchesLine,
  noMatchLine,
  notNow,
  openerLabel,
  openingOf,
  stepTo,
  switchTo,
  useWhere,
  waiting,
} from './switcher.ts';
import type { Tell } from './TodayParts.tsx';
import './today.css';
import './switcher.css';

const WIDEST = 500;
const EDGE = 12;
const SPARE = 12;

interface Opening {
  panel: string | null;
  query: string;
  kept: readonly string[];
}

/** From no organisation the walk is the page's own, and its landing focuses the notice. */
function alone(params: URLSearchParams): boolean {
  return params.get('orgs') === 'none';
}

function switchedLine(name: string): string {
  return `Now working in ${name}.`;
}

function invitationsLine(count: number): string {
  return count === 1 ? '1 invitation' : `${count} invitations`;
}

/** The sidebar's organisation button, and the menu of places it drops (OrgSwitcher-B-Places-Web, page 29). Pages with no notice of their own say a switch in the toast. */
export function OrgSwitcher({ tell, toast = false }: { tell: Tell; toast?: boolean }) {
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const [first, setFirst] = useState<Opening | null>(() => {
    const raw = params.get('switcher');
    if (!isSwitcherState(raw) || raw === 'closed') return null;

    return { ...openingOf(raw), kept: raw === 'declined' ? [BLUEBIRD] : [] };
  });
  const where = useWhere();
  const [open, setOpen] = useState(first != null);
  const [walk, setWalk] = useState<Walk | null>(() => {
    const raw = params.get('create');

    return isCreateState(raw) && !alone(params) ? walkOf(raw) : null;
  });
  const [landed] = useState(() => params.get('create') === 'created' && !alone(params));
  const [seen, setSeen] = useState(where.opens);
  const [into, setInto] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const back = useRef(false);
  const current = currentPlace(where);
  const count = waiting(where).length;

  if (where.opens !== seen) {
    setSeen(where.opens);
    setOpen(true);
    setInto(true);
  }

  const close = useCallback((focusBack: boolean) => {
    back.current = focusBack;
    setOpen(false);
    setFirst(null);
    setInto(false);
  }, []);

  useLayoutEffect(() => {
    const shown = menu.current;
    const parent = container.current;
    if (!open || shown == null || parent == null) return;

    return () => leaveMenu(shown, parent);
  }, [open]);

  useLayoutEffect(() => {
    if (open || !back.current) return;

    back.current = false;
    button.current?.focus();
  });

  useEffect(() => {
    if (landed) focusWhenFree(() => button.current);
  }, [landed]);

  useEffect(() => {
    if (!open) return;

    const outside = (event: MouseEvent): void => {
      if (container.current?.contains(event.target as Node)) return;

      close(false);
      window.setTimeout(() => {
        if (document.activeElement == null || document.activeElement === document.body)
          button.current?.focus();
      }, 0);
    };
    const escape = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') close(true);
    };

    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);

    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open, close]);

  function pick(place: Place): void {
    const stays = where.paused ? place.id === PAUSED.id : place.id === where.current;

    close(true);
    if (stays) return;

    switchTo(place, pathname);
    if (toast) tell(switchedLine(place.name));
  }

  function created(): void {
    setWalk(null);
    create(NEW_PLACE, pathname, false);
    if (toast) tell(switchedLine(NEW_PLACE.name));
    focusWhenFree(() => button.current);
  }

  return (
    <div
      ref={container}
      className="sw"
      onBlur={(event) => {
        const to = event.relatedTarget;
        if (open && to != null && !event.currentTarget.contains(to)) close(false);
      }}
    >
      <button
        ref={button}
        type="button"
        className={`today-org sw-opener${count > 0 ? ' is-waiting' : ''}${open ? ' is-open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={openerLabel(current, count)}
        onClick={() => (open ? close(true) : setOpen(true))}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown' || open) return;

          event.preventDefault();
          setOpen(true);
          setInto(true);
        }}
      >
        <span className={`sw-tile today-cover is-${meshFor(current.id)}`} aria-hidden="true">
          {initials(current.name)}
          {where.arrived === current.id && (
            <span className="sw-was" onAnimationEnd={colourArrived}>
              {initials(current.name)}
            </span>
          )}
        </span>
        <span className="today-grow sw-opener-words">
          <span className="sw-opener-name">{current.name}</span>
          {count > 0 && (
            <span className="sw-opener-waiting">
              <span className="sw-ring" aria-hidden="true" />
              {invitationsLine(count)}
            </span>
          )}
        </span>
        <Glyph name="updown" size={15} />
      </button>
      {open && (
        <Menu
          menu={menu}
          where={where}
          anchor={button}
          start={first}
          into={into}
          onPick={pick}
          onCreate={() => {
            close(false);
            setWalk(freshWalk());
          }}
        />
      )}
      {walk != null && (
        <CreateWalk
          start={walk}
          onClose={() => {
            setWalk(null);
            focusWhenFree(() => button.current);
          }}
          onCreated={created}
        />
      )}
    </div>
  );
}

type Tile =
  | { kind: 'place'; id: string; place: Place }
  | { kind: 'offer'; id: string }
  | { kind: 'invitation'; id: string; invitation: Invitation };

function Menu({
  menu,
  where,
  anchor,
  start,
  into,
  onPick,
  onCreate,
}: {
  menu: RefObject<HTMLDivElement | null>;
  where: Where;
  anchor: RefObject<HTMLButtonElement | null>;
  start: Opening | null;
  into: boolean;
  onPick: (place: Place) => void;
  onCreate: () => void;
}) {
  const id = useId();
  const [query, setQuery] = useState(start?.query ?? '');
  const [panel, setPanel] = useState<string | null>(start?.panel ?? null);
  const [kept, setKept] = useState<readonly string[]>(start?.kept ?? []);
  const [at, setAt] = useState<number | null>(null);
  const [wide, setWide] = useState(() => window.innerWidth);
  const [scrolled, setScrolled] = useState(false);
  const [heard, setHeard] = useState<{ query: string; words: string } | null>(null);
  const [arrive] = useState(into);
  const [typing] = useState(query !== '');
  const body = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const shown = useRef<HTMLDivElement>(null);
  const options = useRef<(HTMLDivElement | null)[]>([]);
  const land = useRef<'panel' | 'more' | null>(null);

  const searchable = where.places.length > SEARCH_FROM;
  const typed = searchable ? query : '';
  const places = where.places.filter((place) => holds(place.name, typed));
  const offer = where.offer != null && holds(OFFER.name, typed);
  const invitations = where.invitations.filter((invitation) => {
    const answer = where.answers[invitation.id];
    if (answer === 'joined' || !holds(invitation.name, typed)) return false;

    return answer == null || answer === 'failed' || kept.includes(invitation.id);
  });
  const tiles: Tile[] = [
    ...places.map((place): Tile => ({ kind: 'place', id: place.id, place })),
    ...(offer ? [{ kind: 'offer', id: OFFER.id } satisfies Tile] : []),
    ...invitations.map((invitation): Tile => ({
      kind: 'invitation',
      id: invitation.id,
      invitation,
    })),
  ];
  const found = tiles.length;
  const nothing = typed.trim() !== '' && found === 0;
  const across = columnsOf(Math.min(WIDEST, wide - 2 * EDGE) - 2 - 2 * EDGE);
  const chosen = places.findIndex((place) => !where.paused && place.id === where.current);
  const roving = Math.min(at ?? Math.max(0, chosen), Math.max(0, places.length - 1));
  const opened = panel == null ? -1 : tiles.findIndex((tile) => tile.id === panel);
  const rowEnd =
    opened < 0 ? -1 : Math.min(Math.floor(opened / across) * across + across - 1, tiles.length);
  const panelAfter = opened < 0 ? null : Math.max(rowEnd, places.length - 1) - places.length;
  const said = heard != null && heard.query === typed && typed.trim() !== '' ? heard.words : '';

  useLayoutEffect(() => {
    const drop = menu.current;
    const opener = anchor.current;
    if (drop == null || opener == null) return;

    const place = (): void => {
      const box = opener.getBoundingClientRect();
      const top = box.bottom + 8;
      const left = Math.max(EDGE, Math.min(box.left, window.innerWidth - EDGE - drop.offsetWidth));
      drop.style.setProperty('top', `${top}px`);
      drop.style.setProperty('left', `${left}px`);
      drop.style.setProperty('max-height', `${Math.max(0, window.innerHeight - top - EDGE)}px`);
    };
    const resize = (): void => {
      setWide(window.innerWidth);
      place();
    };

    place();
    const watch = typeof ResizeObserver === 'function' ? new ResizeObserver(place) : null;
    watch?.observe(opener);
    window.addEventListener('resize', resize);

    return () => {
      watch?.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [anchor, menu]);

  useLayoutEffect(() => {
    const scroller = body.current;
    if (scroller == null) return;

    const bar = scroller.offsetWidth - scroller.clientWidth;
    scroller.style.setProperty('padding-right', `${Math.max(0, EDGE - bar)}px`);
  });

  useLayoutEffect(() => {
    const lit = body.current?.querySelector<HTMLElement>('[role="option"][tabindex="0"]');
    if (lit == null || body.current == null) return;

    reveal(body.current, lit);
    if (arrive) lit.focus();
  }, [arrive]);

  useLayoutEffect(() => {
    if (typing) field.current?.focus();
  }, [typing]);

  useLayoutEffect(() => {
    const box = shown.current;
    if (box == null) return;

    box.style.setProperty('--swCols', String(across));
    box.style.setProperty('--swCol', String(opened % across));
    if (body.current != null) reveal(body.current, box);
  }, [panel, opened, across]);

  useLayoutEffect(() => {
    const target = land.current;
    if (target == null) return;

    land.current = null;
    const element =
      target === 'panel'
        ? shown.current?.querySelector<HTMLElement>('[data-lands]')
        : body.current?.querySelector<HTMLElement>('.sw-more > .sw-cell');
    element?.focus();
  });

  useEffect(() => {
    if (!searchable || typed.trim() === '') return;

    const timer = window.setTimeout(
      () => setHeard({ query: typed, words: matchesLine(found) }),
      500,
    );

    return () => window.clearTimeout(timer);
  }, [searchable, typed, found]);

  function clear(): void {
    setQuery('');
    setPanel(null);
    field.current?.focus();
  }

  function toggle(tile: string): void {
    setPanel((now) => (now === tile ? null : tile));
  }

  function onOption(event: KeyboardEvent<HTMLDivElement>, index: number): void {
    const place = places[index];
    if (place != null && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onPick(place);

      return;
    }

    const next = stepTo(event.key, index, places.length, across);
    if (next == null) return;

    event.preventDefault();
    setAt(next);
    options.current[next]?.focus();
  }

  const panelNode =
    opened < 0 ? null : (
      <div
        ref={shown}
        key={`panel-${panel}`}
        id={`${id}-panel`}
        role="group"
        aria-label={panelTitle(tiles[opened])}
        className="sw-panel"
      >
        <Answer
          tile={tiles[opened]}
          where={where}
          onAccept={(invitation) => {
            land.current = 'panel';
            join(invitation);
          }}
          onDecline={(invitation) => {
            land.current = 'panel';
            setKept((now) => [...now, invitation.id]);
            decline(invitation);
          }}
          onAsk={() => {
            land.current = 'panel';
            ask();
          }}
          onNotNow={() => {
            land.current = 'more';
            setPanel(null);
            notNow();
          }}
          onOpen={onPick}
        />
      </div>
    );

  const more: ReactNode[] = tiles.slice(places.length).map((tile) => {
    const open = tile.id === panel;
    const name = tile.kind === 'invitation' ? tile.invitation.name : OFFER.name;
    const line =
      tile.kind === 'invitation' ? `Invitation · ${tile.invitation.role}` : 'You can ask to join';

    return (
      <button
        key={tile.id}
        type="button"
        className={open ? 'sw-cell is-open' : 'sw-cell'}
        aria-label={`${name}, ${line}`}
        aria-expanded={open}
        aria-controls={open ? `${id}-panel` : undefined}
        onClick={() => toggle(tile.id)}
      >
        <span className="sw-mark" aria-hidden="true">
          <span className="sw-tile is-dashed">{initials(name)}</span>
          {tile.kind === 'invitation' ? (
            <span className="sw-badge is-invite">
              <span className="sw-ring is-small" />
            </span>
          ) : (
            <span className="sw-badge is-offer">
              <Glyph name="plus" size={12} weight={2.6} />
            </span>
          )}
        </span>
        <span className="sw-name">{name}</span>
        <span className={tile.kind === 'invitation' ? 'sw-line is-invite' : 'sw-line'}>{line}</span>
      </button>
    );
  });
  more.push(
    <button key="create" type="button" className="sw-cell is-create" onClick={onCreate}>
      <span className="sw-mark" aria-hidden="true">
        <span className="sw-tile is-create">
          <Glyph name="plus" size={20} weight={2.4} />
        </span>
      </span>
      <span className="sw-name">Create an organisation</span>
    </button>,
  );
  if (panelAfter != null) more.splice(panelAfter + 1, 0, panelNode);

  return (
    <div ref={menu} className="sw-menu">
      <div className={scrolled ? 'sw-head is-scrolled' : 'sw-head'}>
        <h2 className="sw-asks">Where are you working?</h2>
        {searchable && (
          <div className="sw-search">
            <Glyph name="search" size={18} weight={2.2} />
            <input
              ref={field}
              type="search"
              aria-label="Search organisations"
              placeholder="Search organisations"
              value={query}
              spellCheck={false}
              autoComplete="off"
              onChange={(event) => {
                setQuery(event.target.value);
                setPanel(null);
                setAt(0);
              }}
            />
            {query !== '' && (
              <button type="button" className="sw-clear" aria-label="Clear search" onClick={clear}>
                <span className="sw-clear-disc" aria-hidden="true">
                  <Glyph name="clear" size={11} weight={3} />
                </span>
              </button>
            )}
          </div>
        )}
      </div>
      <div
        ref={body}
        className="sw-body"
        onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 0)}
      >
        {nothing && (
          <div className="sw-none">
            <p>{noMatchLine(typed)}</p>
            <button type="button" className="sw-clear-words" onClick={clear}>
              Clear search
            </button>
          </div>
        )}
        <div className="sw-grid">
          {places.length > 0 && (
            <div role="listbox" aria-label="Your organisations" className="sw-list">
              {places.map((place, index) => {
                const isCurrent = index === chosen;

                return (
                  <div
                    key={place.id}
                    ref={(node) => {
                      options.current[index] = node;
                    }}
                    role="option"
                    aria-selected={isCurrent}
                    aria-label={`${place.name}, Your role · ${place.role}${isCurrent ? ', Current' : ''}`}
                    tabIndex={index === roving ? 0 : -1}
                    className={isCurrent ? 'sw-cell is-current' : 'sw-cell'}
                    onClick={() => onPick(place)}
                    onKeyDown={(event) => onOption(event, index)}
                    onFocus={() => setAt(index)}
                  >
                    <span className="sw-mark" aria-hidden="true">
                      <span className={`sw-tile today-cover is-${meshFor(place.id)}`}>
                        {initials(place.name)}
                      </span>
                      {isCurrent && (
                        <span className="sw-badge is-tick">
                          <Glyph name="tick" size={11} weight={3.2} />
                        </span>
                      )}
                    </span>
                    <span className="sw-name">{place.name}</span>
                    <span className="sw-line">Your role · {place.role}</span>
                    {isCurrent && <span className="sw-current">Current</span>}
                  </div>
                );
              })}
            </div>
          )}
          <div className="sw-more">{more}</div>
        </div>
        <p className="sw-note">Soirely remembers your choice on this device.</p>
      </div>
      <p className="visually-hidden" role="status">
        {said}
      </p>
    </div>
  );
}

function reveal(scroller: HTMLElement, element: HTMLElement): void {
  const box = element.getBoundingClientRect();
  const view = scroller.getBoundingClientRect();
  const above = view.top - (box.top - SPARE);
  const below = box.bottom + SPARE - view.bottom;

  if (above > 0) scroller.scrollTop -= above;
  else if (below > 0) scroller.scrollTop += Math.min(below, box.top - SPARE - view.top);
}

function panelTitle(tile: Tile | undefined): string {
  if (tile == null) return '';
  if (tile.kind === 'offer') return `${OFFER.name} uses Soirely`;

  return tile.kind === 'place' ? tile.place.name : tile.invitation.name;
}

function Answer({
  tile,
  where,
  onAccept,
  onDecline,
  onAsk,
  onNotNow,
  onOpen,
}: {
  tile: Tile | undefined;
  where: Where;
  onAccept: (invitation: Invitation) => void;
  onDecline: (invitation: Invitation) => void;
  onAsk: () => void;
  onNotNow: () => void;
  onOpen: (place: Place) => void;
}) {
  if (tile == null) return null;
  if (tile.kind === 'offer')
    return <Offer standing={where.offer} onAsk={onAsk} onNotNow={onNotNow} />;

  if (tile.kind === 'place') {
    const { place } = tile;

    return (
      <>
        <Notice kind="done" lands>
          You joined {place.name} as {place.role}.
        </Notice>
        <button
          type="button"
          className="sw-button is-primary is-whole"
          onClick={() => onOpen(place)}
        >
          Open {place.name}
        </button>
      </>
    );
  }

  const { invitation } = tile;
  const answer = where.answers[invitation.id];

  return (
    <>
      <p className="sw-panel-title">{invitation.name}</p>
      <div className="sw-panel-lines">
        <p>
          Invitation from {invitation.inviter} · {invitation.role}
        </p>
        <p className="sw-until">Works until {dayOf(invitation.until)}</p>
      </div>
      {answer === 'declined' ? (
        <Notice kind="quiet" lands>
          You declined. {invitation.inviter} will see that you said no.
        </Notice>
      ) : (
        <>
          {answer === 'failed' && (
            <Notice kind="broken">
              Your answer did not reach us. Check your connection and try again.
            </Notice>
          )}
          <div className={answer === 'failed' ? 'sw-actions is-close' : 'sw-actions'}>
            <button
              type="button"
              className="sw-button is-primary"
              aria-label={`Accept and join ${invitation.name}`}
              onClick={() => onAccept(invitation)}
            >
              Accept and join
            </button>
            <button
              type="button"
              className="sw-button is-ghost"
              aria-label={`Decline the invitation to ${invitation.name}`}
              onClick={() => onDecline(invitation)}
            >
              Decline
            </button>
          </div>
          <p className="sw-panel-note">
            Declining tells {invitation.inviter} you said no. Nothing else changes.
          </p>
        </>
      )}
    </>
  );
}

function Offer({
  standing,
  onAsk,
  onNotNow,
}: {
  standing: OfferStanding | null;
  onAsk: () => void;
  onNotNow: () => void;
}) {
  return (
    <>
      <p className="sw-panel-title">{OFFER.name} uses Soirely</p>
      <p className="sw-panel-body">
        Your address is at {OFFER.domain}, so you can ask to join. Somebody there approves you
        before you see anything.
      </p>
      {standing === 'asked' ? (
        <p className="sw-asked sw-lands" role="status" tabIndex={-1} data-lands>
          <span className="sw-ring is-asked" aria-hidden="true" />
          <span>
            <strong>Waiting for approval</strong> · we’ll email {SAMPLE.email} when they answer.
          </span>
        </p>
      ) : (
        <>
          {standing === 'unavailable' && (
            <p className="sw-refused sw-lands" role="alert" tabIndex={-1} data-lands>
              You cannot ask to join that organisation. Start your own, or ask somebody there to
              invite you.
            </p>
          )}
          <div className={standing === 'unavailable' ? 'sw-actions is-close' : 'sw-actions'}>
            <button
              type="button"
              className="sw-button is-primary"
              aria-label={`Ask to join ${OFFER.name}`}
              onClick={onAsk}
            >
              Ask to join
            </button>
            <button type="button" className="sw-button is-ghost" onClick={onNotNow}>
              Not now
            </button>
          </div>
        </>
      )}
    </>
  );
}

/** "Now working in ‹name›." on the page the switch happened on, gone once the person moves on. */
export function Switched() {
  const where = useWhere();
  const { pathname } = useLocation();

  if (where.switched == null || where.switched.at !== pathname) return null;

  return (
    <div key={where.switched.name} className="sw-switched">
      <Notice kind="done" takesFocus={where.switched.takesFocus === true}>
        {switchedLine(where.switched.name)}
      </Notice>
    </div>
  );
}

/** main's AccessPaused, standing in for the page while access to the organisation is paused. */
export function AccessPaused() {
  const id = useId();

  return (
    <section className="sw-paused" aria-labelledby={id}>
      <span className="sw-paused-chip">Paused</span>
      <h1 id={id}>
        Your access to {PAUSED.name} is paused because your {PAUSED.domain} address is no longer on
        your account.
      </h1>
      <p className="sw-paused-since">Paused since {dayOf(PAUSED.since)}.</p>
      <p>Your work in {PAUSED.name} is kept and still attributed to you.</p>
      <p>Your other organisations and your access to single events are not affected.</p>
      <h2>What happens next</h2>
      <p>
        Add your {PAUSED.domain} address again in Account settings and make it primary, then ask an
        admin of {PAUSED.name} to restore your access.
      </p>
      <div className="sw-actions is-paused">
        <Link className="sw-button is-primary" to="/demo/settings/account">
          Account settings
        </Link>
        <button type="button" className="sw-button is-ghost" onClick={askToOpen}>
          Switch organisation
        </button>
      </div>
    </section>
  );
}
