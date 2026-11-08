import { DemoBell } from './DemoBell.tsx';
import { eventPhase, formatEventRange, hostsLine } from '@soirely/domain';
import {
  type ComponentType,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Link,
  Navigate,
  useBlocker,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router';

import {
  type Area,
  type CardDoes,
  type EventStateName,
  type Manage,
  type Part,
  type SampleEvent,
  AREAS,
  COMING,
  CURRENCIES,
  EVENT_WORDS as W,
  TYPE_WORDS,
  areaOf,
  clockOf,
  eventStateOf,
  keepChange,
  forget,
  lineOf,
  localDay,
  manageOf,
  needsName,
  partOf,
  resetSample,
  sampleEvent,
  stateFits,
} from './events.ts';
import { DeleteByName, DuplicateDialog } from './EventDialogs.tsx';
import {
  type PartProps,
  CoverPart,
  CurrencyPart,
  DatesPart,
  HostsPart,
  NamePart,
  TypePart,
  VenuePart,
} from './EventEdits.tsx';
import { Alert, EventCard, EventsShell, NotBuilt, Switch, Thumb } from './EventParts.tsx';
import { CAL_WORDS } from './calendar.ts';
import { EventSidebar } from './EventSidebar.tsx';
import { Glyph, type GlyphName } from '../components/Glyph.tsx';
import { LayersContext } from '../layers.ts';
import { BudgetArea } from './Quotes.tsx';
import { BUDGET_EVENT } from './budget.ts';
import {
  type Told,
  NEW_PLACE,
  ROSEWOOD,
  SAMPLE_EVENT,
  STARTS_LATER,
  TELL,
  keepInbox,
  keptInbox,
  messagesStateOf,
  resetInbox,
  toldOf,
  waitingLine,
} from './messages.ts';
import { MessagesPage } from './Messages.tsx';
import { TellDialog } from './MessagesTell.tsx';
import { Ask, Chevron, Head, RowWords, TextAction } from '../components/SettingsParts.tsx';
import type { Tell } from '../components/SettingsParts.tsx';
import { useSwitcherStart } from './switcher.ts';

const LOCALE = 'en-US';

interface Arrival {
  open?: Part;
  told?: string;
}

type Asking = 'pause' | 'callOff' | 'endNow' | 'deleteDraft' | 'delete' | 'duplicate';

const PARTS: Record<Part, ComponentType<PartProps>> = {
  dates: DatesPart,
  venue: VenuePart,
  hosts: HostsPart,
  type: TypePart,
  currency: CurrencyPart,
  name: NamePart,
  cover: CoverPart,
};

function askingOf(state: EventStateName | null): Asking | null {
  switch (state) {
    case 'pause':
    case 'callOff':
    case 'endNow':
    case 'deleteDraft':
    case 'duplicate':
      return state;
    case 'delete':
    case 'deleteMismatch':
    case 'deleteTyped':
      return 'delete';
    default:
      return null;
  }
}

/** An event at a desk in A · Summary first (Events-A-Desk, page 29): its own sidebar, the card, Details and the rest in two columns, each part edited in place. */
export function EventPage({
  dates = false,
  messages = false,
}: {
  dates?: boolean;
  messages?: boolean;
}) {
  const { id } = useParams();
  const [params] = useSearchParams();
  const raw = params.get('state');
  useSwitcherStart();

  return (
    <EventAt
      key={`${id ?? ''}|${raw ?? ''}|${messages}`}
      id={id}
      raw={raw}
      dates={dates}
      messages={messages}
    />
  );
}

function EventAt({
  id,
  raw,
  dates,
  messages,
}: {
  id: string | undefined;
  raw: string | null;
  dates: boolean;
  messages: boolean;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [arrival] = useState<Arrival>(() => (location.state as Arrival | null) ?? {});
  const [first] = useState(() => {
    if (raw != null) resetSample();
    if (raw != null && messages) resetInbox();

    const event = sampleEvent(id);
    const named = messages ? null : eventStateOf(raw);
    const state = event != null && named != null && stateFits(named, event) ? named : null;

    return { event: event != null && state === 'photo' ? { ...event, photo: true } : event, state };
  });

  useEffect(() => {
    if (location.state == null) return;

    void navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location, navigate]);

  if (first.event == null) return <Navigate to="/demo/events" replace />;

  const said = messages ? messagesStateOf(raw) : null;

  const telling = said === 'tell' || said === 'tellPlace';

  if (messages && first.event.id === SAMPLE_EVENT && !telling)
    return <MessagesPage event={first.event} state={said} now={clockOf(null)} />;

  return (
    <EventView
      initial={
        said === 'tell'
          ? { ...first.event, startsAt: TELL.movedTo }
          : said === 'tellPlace'
            ? { ...first.event, venue: ROSEWOOD }
            : first.event
      }
      state={first.state}
      arrival={arrival}
      dates={dates}
      fixedArea={messages && !telling ? 'messages' : null}
      telling={said === 'tell' ? [STARTS_LATER] : said === 'tellPlace' ? [NEW_PLACE] : null}
    />
  );
}

function EventView({
  initial,
  state,
  arrival,
  dates,
  fixedArea = null,
  telling: tellingFirst = null,
}: {
  initial: SampleEvent;
  state: EventStateName | null;
  arrival: Arrival;
  dates: boolean;
  fixedArea?: Area | null;
  telling?: readonly Told[] | null;
}) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const now = clockOf(state);
  const area = fixedArea ?? areaOf(params.get('area'));
  const [telling, setTelling] = useState<readonly Told[] | null>(tellingFirst);
  const [event, setEvent] = useState(initial);
  const [part, setPart] = useState<Part | null>(partOf(state) ?? arrival.open ?? null);
  const [dirty, setDirty] = useState(false);
  const [leaving, setLeaving] = useState<{ to: Part | null } | null>(null);
  const [asking, setAsking] = useState<Asking | null>(askingOf(state));
  const [muted, setMuted] = useState(state === 'muted');
  const [muteLoaded, setMuteLoaded] = useState(state !== 'muteNotLoaded');
  const [muteFailed, setMuteFailed] = useState(state === 'muteNotSaved');
  const away = useLeaveAsk(dirty);

  if (area === 'people') return <Navigate to="/demo/people" replace />;
  if (area === 'budget' && initial.id === BUDGET_EVENT) return <BudgetArea event={initial} />;
  if (area === 'messages' && fixedArea == null)
    return <Navigate to={`/demo/events/${initial.id}/messages`} replace />;
  if (area === 'seating') return <Navigate to={`/demo/events/${initial.id}/seating`} replace />;

  function kept(next: SampleEvent): void {
    keepChange(next);
    setEvent(next);
  }

  function open(next: Part): void {
    const to = next === part ? null : next;

    if (part != null && dirty) setLeaving({ to });
    else {
      setPart(to);
      setDirty(false);
    }
  }

  return (
    <EventsShell
      told={arrival.told ?? null}
      renderSide={(tell, covered) => (
        <EventSidebar
          event={event}
          area={area}
          now={now}
          tell={tell}
          inert={covered}
          waiting={event.id === SAMPLE_EVENT ? waitingLine(keptInbox()) : null}
        />
      )}
    >
      {(tell) => (
        <div className="desk-page ev-page">
          <div className="ev-wide">
            <div className="ev-crumb-row">
              <nav className="ev-crumb" aria-label={W.crumb}>
                <ol>
                  <li className="ev-crumb-part">
                    <Link to="/demo/events">{W.back}</Link>
                  </li>
                  <li className="ev-crumb-part" aria-current="page">
                    <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
                    <span className="ev-crumb-name">{event.name}</span>
                  </li>
                </ol>
              </nav>
              <DemoBell tell={tell} />
            </div>
            {dates ? (
              <AreaPage event={event} name={CAL_WORDS.allDates} line={CAL_WORDS.allDatesComing} />
            ) : area === 'overview' ? (
              <>
                <EventCard
                  event={event}
                  now={now}
                  level={1}
                  onStep={(does: CardDoes) => {
                    if (does === 'makeLive') tell('Make live has its own design.');
                    else if (does === 'changeDates') {
                      if (part !== 'dates') open('dates');
                    } else if (does === 'resume') {
                      kept({ ...event, status: 'live' });
                      tell(W.resumed(event.name));
                    } else setAsking('duplicate');
                  }}
                />
                <div className="ev-columns">
                  <div className="ev-left">
                    <Details
                      event={event}
                      now={now}
                      part={part}
                      state={state}
                      onOpen={open}
                      onDirty={setDirty}
                      onClose={() => {
                        setPart(null);
                        setDirty(false);
                      }}
                      onSave={(next) => {
                        const changes =
                          event.id === SAMPLE_EVENT && event.status === 'live'
                            ? toldOf(event, next)
                            : [];

                        kept(next);
                        setPart(null);
                        setDirty(false);
                        if (changes.length > 0) setTelling(changes);
                        else tell(W.saved);
                      }}
                      onLatest={kept}
                    />
                  </div>
                  <div className="ev-right">
                    <GuestsPage />
                    <JustForYou
                      muted={muted}
                      loaded={muteLoaded}
                      failed={muteFailed}
                      onRetry={() => setMuteLoaded(true)}
                      onChange={(next) => {
                        if (muteFailed) setMuteFailed(false);
                        setMuted(next);
                      }}
                    />
                    <ManageBlock
                      manage={manageOf(event, now)}
                      onPick={(one) => {
                        if (one === 'delete')
                          setAsking(needsName(event) ? 'delete' : 'deleteDraft');
                        else setAsking(one);
                      }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <AreaPage
                event={event}
                name={AREAS.find((one) => one.area === area)?.name ?? ''}
                line={COMING[area]}
              />
            )}
          </div>
          {leaving != null && (
            <Ask
              title={W.discardTitle}
              line={W.discardLine}
              keep={W.keepEditing}
              go={W.discard}
              onKeep={() => setLeaving(null)}
              onGo={() => {
                setPart(leaving.to);
                setDirty(false);
                setLeaving(null);
              }}
            />
          )}
          {away.blocked && (
            <Ask
              title={W.discardTitle}
              line={W.discardLine}
              keep={W.keepEditing}
              go={W.discard}
              onKeep={away.stay}
              onGo={() => {
                setPart(null);
                setDirty(false);
                away.go();
              }}
            />
          )}
          <Asks
            asking={asking}
            event={event}
            now={now}
            state={state}
            onKeep={() => setAsking(null)}
            onDone={(next, words) => {
              setAsking(null);
              kept(next);
              if (words != null) tell(words);
            }}
            onDeleted={() => {
              away.release();
              forget(event.id);
              void navigate('/demo/events', { state: { told: W.deleted(event.name) } });
            }}
            onCreated={(words) => {
              away.release();
              tell(words);
            }}
          />
          {telling != null && (
            <TellDialog
              tell={tell}
              changes={telling}
              onNotNow={() => {
                const was = keptInbox();

                setTelling(null);
                keepInbox({
                  ...was,
                  untold: [
                    ...was.untold.filter((one) => !telling.some((now) => now.item === one.item)),
                    ...telling,
                  ],
                });
              }}
              onSent={() => setTelling(null)}
            />
          )}
        </div>
      )}
    </EventsShell>
  );
}

/** While a part has a change, every way off the page asks first, as main's `useLeaveGuard` does: the router's own ways in the demo's dialog, reload and the address bar in the browser's. */
function useLeaveAsk(dirty: boolean): {
  blocked: boolean;
  stay: () => void;
  go: () => void;
  release: () => void;
} {
  const released = useRef(false);
  const blocker = useBlocker(useCallback(() => dirty && !released.current, [dirty]));

  useEffect(() => {
    if (!dirty) return;

    const ask = (event: BeforeUnloadEvent): void => event.preventDefault();
    window.addEventListener('beforeunload', ask);

    return () => window.removeEventListener('beforeunload', ask);
  }, [dirty]);

  return {
    blocked: blocker.state === 'blocked',
    stay: () => blocker.reset?.(),
    go: () => blocker.proceed?.(),
    release: () => {
      released.current = true;
    },
  };
}

function Asks({
  asking,
  event,
  now,
  state,
  onKeep,
  onDone,
  onDeleted,
  onCreated,
}: {
  asking: Asking | null;
  event: SampleEvent;
  now: Date;
  state: EventStateName | null;
  onKeep: () => void;
  onDone: (next: SampleEvent, words: string | null) => void;
  onDeleted: () => void;
  onCreated: Tell;
}) {
  switch (asking) {
    case 'pause':
      return (
        <Ask
          title={W.pauseTitle(event.name)}
          line={W.pauseLine}
          keep={W.keepItLive}
          go={W.pause}
          red={false}
          onKeep={onKeep}
          onGo={() => onDone({ ...event, status: 'paused' }, W.paused(event.name))}
        />
      );
    case 'callOff':
      return (
        <Ask
          title={W.callOffTitle(event.name)}
          line={W.callOffLine}
          keep={W.keepItOn}
          go={W.callOff}
          onKeep={onKeep}
          onGo={() => onDone({ ...event, status: 'ended', concludedAt: now.toISOString() }, null)}
        />
      );
    case 'endNow':
      return (
        <Ask
          title={W.endTitle(event.name)}
          line={W.endLine}
          keep={W.keepItOn}
          go={W.endNow}
          onKeep={onKeep}
          onGo={() => onDone({ ...event, status: 'ended', concludedAt: now.toISOString() }, null)}
        />
      );
    case 'deleteDraft':
      return (
        <Ask
          title={W.deleteTitle(event.name)}
          line={W.draftBody}
          keep={W.keepIt}
          go={W.delete}
          onKeep={onKeep}
          onGo={onDeleted}
        />
      );
    case 'delete':
      return (
        <DeleteByName
          event={event}
          typed={
            state === 'deleteTyped'
              ? event.name
              : state === 'deleteMismatch'
                ? 'Adaeze and Tunde'
                : ''
          }
          mismatch={state === 'deleteMismatch'}
          onKeep={onKeep}
          onDelete={onDeleted}
        />
      );
    case 'duplicate':
      return <DuplicateDialog event={event} onDismiss={onKeep} onCreated={onCreated} />;
    default:
      return null;
  }
}

function Lead({ name }: { name: GlyphName }) {
  return (
    <span className="ev-lead" aria-hidden="true">
      <Glyph name={name} size={22} weight={2} />
    </span>
  );
}

/** A part of the event as a row: its value over its label; at a desk it opens in place under it. */
function PartRow({
  lead,
  title,
  line,
  open,
  locked = false,
  after,
  onOpen,
  children,
}: {
  lead: ReactNode;
  title: string;
  line: string;
  open: boolean;
  locked?: boolean;
  after?: ReactNode;
  onOpen: () => void;
  children?: ReactNode;
}) {
  const button = useRef<HTMLButtonElement>(null);
  const was = useRef(open);
  const closed = useRef(false);
  const { stack } = useContext(LayersContext);

  useEffect(() => {
    if (was.current && !open) closed.current = true;
    was.current = open;
    if (!closed.current || stack.length > 0) return;

    closed.current = false;
    if (document.activeElement == null || document.activeElement === document.body)
      button.current?.focus();
  }, [open, stack.length]);

  return (
    <li className="ev-part">
      {locked ? (
        <div className="desk-row ev-detail is-locked">
          {lead}
          <RowWords title={title} lines={[line]} />
        </div>
      ) : (
        <button
          ref={button}
          type="button"
          className={open ? 'desk-row ev-detail is-lit' : 'desk-row ev-detail'}
          aria-expanded={open}
          onClick={onOpen}
        >
          {lead}
          <RowWords title={title} lines={[line]} />
          <Chevron />
        </button>
      )}
      {!open && after}
      {open && children}
    </li>
  );
}

function dayCount(event: SampleEvent): number {
  const first = Date.parse(`${localDay(event.startsAt, event.timeZone)}T00:00:00Z`);
  const last = Date.parse(`${localDay(event.endsAt, event.timeZone)}T00:00:00Z`);

  return Math.round((last - first) / 86_400_000) + 1;
}

function mapsLink(event: SampleEvent): string | null {
  const venue = event.venue;

  if (venue == null) return null;

  const query = [venue.name, venue.address ?? venue.city].join(', ');

  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`;
}

function Details({
  event,
  now,
  part,
  state,
  onOpen,
  onDirty,
  onClose,
  onSave,
  onLatest,
}: {
  event: SampleEvent;
  now: Date;
  part: Part | null;
  state: EventStateName | null;
  onOpen: (part: Part) => void;
  onDirty: (dirty: boolean) => void;
  onClose: () => void;
  onSave: (next: SampleEvent) => void;
  onLatest: (latest: SampleEvent) => void;
}) {
  const locked = eventPhase(event, now) === 'finished';
  const days = dayCount(event);
  const maps = mapsLink(event);
  const editing = (one: Part) => {
    if (part !== one) return null;

    const Editor = PARTS[one];

    return (
      <Editor
        event={event}
        state={partOf(state) === one ? (state as PartProps['state']) : null}
        onDirty={onDirty}
        onClose={onClose}
        onSave={onSave}
        onLatest={onLatest}
      />
    );
  };
  const row = (one: Part, lead: ReactNode, title: string, line: string, after?: ReactNode) => (
    <PartRow
      key={one}
      lead={lead}
      title={title}
      line={line}
      open={part === one}
      locked={one === 'dates' && locked}
      after={after}
      onOpen={() => onOpen(one)}
    >
      {editing(one)}
    </PartRow>
  );

  return (
    <>
      <section className="desk-block" aria-labelledby="ev-details">
        <Head title={<span id="ev-details">{W.details}</span>} />
        <ul className="desk-rows ev-details">
          {row(
            'dates',
            <Lead name="calendar" />,
            formatEventRange(event.startsAt, event.endsAt, event.timeZone, LOCALE),
            locked
              ? `${W.dates} · ${W.scheduleLocked}`
              : [W.dates, ...(days > 1 ? [W.dayCount(days)] : []), event.timeZone].join(' · '),
          )}
          {row(
            'venue',
            <Lead name="pin" />,
            event.venue?.name ?? W.venueToBeConfirmed,
            event.venue?.address == null ? W.venue : `${W.venue} · ${event.venue.address}`,
            maps == null ? undefined : (
              <a
                className="desk-text ev-maps"
                href={maps}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Glyph name="globe" size={17} weight={2.3} />
                {W.openInMaps}
              </a>
            ),
          )}
          {row(
            'hosts',
            <Lead name="users" />,
            event.hosts.length === 0 ? W.noHosts : hostsLine(event.hosts, LOCALE),
            event.hosts.length === 0 ? `${W.hostedBy} · ${W.noHostsLine}` : W.hostedBy,
          )}
          {row('type', <Lead name="events" />, TYPE_WORDS[event.type], W.type)}
          {row(
            'currency',
            <Lead name="wallet" />,
            `${event.currency} · ${CURRENCIES[event.currency]}`,
            W.currency,
          )}
        </ul>
      </section>
      <section className="desk-block" aria-labelledby="ev-name-cover">
        <Head title={<span id="ev-name-cover">{W.nameAndCover}</span>} />
        <ul className="desk-rows ev-details">
          {row('name', <Lead name="pen" />, event.name, W.eventName)}
          {row(
            'cover',
            <span className="ev-lead">
              <Thumb event={event} size={28} />
            </span>,
            event.photo ? W.yourPhoto : W.defaultCover,
            event.photo ? W.coverMiddle : W.cover,
          )}
        </ul>
      </section>
    </>
  );
}

function GuestsPage() {
  return (
    <section className="desk-block" aria-labelledby="ev-guests-page">
      <Head title={<span id="ev-guests-page">{W.guestsPage}</span>} />
      <div className="ev-dashed">
        <div className="desk-row ev-detail is-coming">
          <Lead name="eye" />
          <RowWords title={W.preview} lines={[W.previewLine]} />
        </div>
        <div className="ev-dashed-pill">
          <NotBuilt words={W.notBuilt('sc-1439')} />
        </div>
      </div>
    </section>
  );
}

function JustForYou({
  muted,
  loaded,
  failed,
  onRetry,
  onChange,
}: {
  muted: boolean;
  loaded: boolean;
  failed: boolean;
  onRetry: () => void;
  onChange: (next: boolean) => void;
}) {
  return (
    <section className="desk-block" aria-labelledby="ev-for-you">
      <Head title={<span id="ev-for-you">{W.justForYou}</span>} />
      {loaded ? (
        <>
          <div className="desk-row">
            <Lead name="bell" />
            <RowWords title={<span id="ev-mute">{W.mute}</span>} lines={[W.muteNote]} />
            <Switch on={muted} label={W.mute} told="ev-mute-note" onChange={onChange} />
          </div>
          <span id="ev-mute-note" className="desk-unseen">
            {W.muteNote}
          </span>
          {failed && <Alert>{W.muteNotSaved}</Alert>}
        </>
      ) : (
        <div className="ev-unknown">
          <p className="desk-line">{W.muteNotLoaded}</p>
          <TextAction label={W.retry} onClick={onRetry} />
        </div>
      )}
      <Link className="desk-text" to="/demo/settings/notifications">
        {W.notificationSettings}
      </Link>
    </section>
  );
}

const MANAGE_WORDS: Record<Manage, readonly [string, string, boolean]> = {
  duplicate: [W.duplicate, W.duplicateLine, false],
  pause: [W.pause, W.pauseLine, false],
  callOff: [W.callOffOpen, W.callOffLine, true],
  endNow: [W.endNowOpen, W.endLine, true],
  delete: [W.deleteOpen, W.deleteLine, true],
};

function ManageBlock({
  manage,
  onPick,
}: {
  manage: readonly Manage[];
  onPick: (one: Manage) => void;
}) {
  return (
    <section className="desk-block" aria-labelledby="ev-manage">
      <Head title={<span id="ev-manage">{W.manage}</span>} />
      <ul className="ev-manage">
        {manage.map((one) => {
          const [label, line, red] = MANAGE_WORDS[one];

          return (
            <li key={one} className="ev-manage-item">
              <button
                type="button"
                className={red ? 'ev-manage-do is-red' : 'ev-manage-do'}
                aria-describedby={`ev-manage-${one}`}
                onClick={() => onPick(one)}
              >
                {label}
              </button>
              <p id={`ev-manage-${one}`} className="desk-note">
                {line}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** An area main has not built: its name, the event, and that it is coming. */
function AreaPage({ event, name, line }: { event: SampleEvent; name: string; line: string }) {
  return (
    <>
      <h1 className="ev-area-title" tabIndex={-1}>
        {name}
      </h1>
      <div className="ev-strip">
        <Thumb event={event} size={40} />
        <RowWords title={event.name} lines={[lineOf(event)]} />
      </div>
      <div className="ev-coming">
        <h2>{name}</h2>
        <p className="desk-line">{line}</p>
      </div>
    </>
  );
}
