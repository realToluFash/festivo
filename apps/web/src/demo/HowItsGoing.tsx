import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import {
  AS_OF,
  type Alert,
  type AlertKind,
  EVENT,
  type KitchenItem,
  NOW,
  type Section,
  type ServiceState,
  type ServiceStateName,
  type Waiter,
  buttonOf,
  candidates,
  closeGive,
  giveTo,
  kitchenRows,
  lineKind,
  nobodyElse,
  openGive,
  pause,
  people,
  sectionName,
  sectionOrder,
  seed,
  serviceStateOf,
  waiterLine,
  waiterOf,
  waitersOn,
} from './howItsGoing.ts';
import './howItsGoing.css';

const AREAS = ['Overview', 'Guests', 'Seating', 'Menu', 'Service', 'Messages', 'Reports'];

type View = 'going' | 'plan' | 'list';

const VIEW_WORDS: Record<View, string> = { going: 'How it’s going', plan: 'Plan', list: 'List' };

const OFFLINE_GLYPH = [
  'M2 2l20 20',
  'M8.5 16.5a5 5 0 0 1 7 0',
  'M2 8.82a15 15 0 0 1 4.17-2.65',
  'M10.66 5c4.01-.36 8.14.9 11.34 3.76',
  'M16.85 11.25a10 10 0 0 1 2.22 1.68',
  'M5 13a10 10 0 0 1 5.24-2.76',
  'M12 20h.01',
];
const INFO_GLYPH = ['M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20z', 'M12 16v-4', 'M12 8h.01'];
const FLAG_GLYPH = ['M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z', 'M4 22v-7'];
const NOBODY_GLYPH = [
  'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
  'M13 7a4 4 0 1 1-8 0 4 4 0 1 1 8 0',
  'm17 8 5 5',
  'm22 8-5 5',
];
const BEHIND_GLYPH = ['M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20z', 'M12 7v5', 'M12 16h.01'];
const CLOCK_GLYPH = ['M22 12a10 10 0 1 1-20 0 10 10 0 1 1 20 0', 'M12 6v6l4 2'];
const PAUSE_GLYPH = ['M9 5v14', 'M15 5v14'];
const DIAMOND_GLYPH = ['M12 3 21 12 12 21 3 12z'];
const HOURGLASS_GLYPH = [
  'M6 2h12',
  'M6 22h12',
  'M7 2c0 6 10 6 10 10S7 16 7 22',
  'M17 2c0 6-10 6-10 10s10 4 10 10',
];

const ALERT_GLYPH: Record<AlertKind, readonly string[]> = {
  allergy: ['M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0', 'M9 12h6', 'm12 9-3 3 3 3'],
  paused: PAUSE_GLYPH,
  leftBehind: FLAG_GLYPH,
  heldUp: HOURGLASS_GLYPH,
  behind: BEHIND_GLYPH,
  station: NOBODY_GLYPH,
  request: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
  nobody: NOBODY_GLYPH,
};

/** /demo/how-its-going (sc-34107): the floor lead's How it's going at 1280 × 800, by ?state=. */
export function HowItsGoingPage() {
  const [params] = useSearchParams();
  const name = serviceStateOf(params.get('state'));

  return <HowItsGoing key={name} name={name} />;
}

function HowItsGoing({ name }: { name: ServiceStateName }) {
  const [state, setState] = useState(() => seed(name));
  const [view, setView] = useState<View>(() => (seed(name).manage ? 'going' : 'plan'));
  const [note, setNote] = useState('');

  const views: View[] = state.manage ? ['going', 'plan', 'list'] : ['plan', 'list'];
  const showing = views.includes(view) ? view : 'plan';

  function act(next: ServiceState): void {
    setNote('');
    setState(next);
  }

  return (
    <div className="hig-page">
      <div className="hig-desk">
        <nav className="hig-side" aria-label="Event">
          <div className="hig-org">
            <span className="hig-org-mark" aria-hidden="true">
              IE
            </span>
            <span>Ire Events</span>
          </div>
          <Link className="hig-side-link" to="/demo">
            ‹ All states in the demo
          </Link>
          <div className="hig-event">
            <strong>{EVENT}</strong>
            <span className="hig-live-pill">Live · today</span>
          </div>
          <ul className="hig-areas">
            {AREAS.map((area) => (
              <li
                key={area}
                className="hig-area"
                aria-current={area === 'Service' ? 'page' : undefined}
              >
                {area}
              </li>
            ))}
          </ul>
        </nav>
        <main id="content" className="hig-main">
          <header className="hig-header">
            <div>
              <h1>Service</h1>
              <p className="hig-meta">Mains · {EVENT}</p>
            </div>
            <div className="hig-status" role="status" data-offline={!state.online || undefined}>
              {state.online ? (
                <>
                  <span className="hig-status-dot" aria-hidden="true" />
                  <span>Connected · up to date {NOW}</span>
                </>
              ) : (
                <>
                  <Glyph paths={OFFLINE_GLYPH} size={16} />
                  <span>No connection · as of {AS_OF}</span>
                </>
              )}
            </div>
          </header>
          <div className="hig-views" role="group" aria-label="Show">
            {views.map((v) => (
              <button
                key={v}
                type="button"
                className="hig-view"
                aria-pressed={showing === v}
                onClick={() => setView(v)}
              >
                {VIEW_WORDS[v]}
              </button>
            ))}
          </div>
          <div className="hig-scroll">
            {showing !== 'going' ? (
              <section className="hig-card hig-placeholder" aria-label={VIEW_WORDS[showing]}>
                <h2 className="hig-card-title">{VIEW_WORDS[showing]}</h2>
                <p className="hig-meta">
                  {VIEW_WORDS[showing]} is sc-4026’s, drawn on its own board. It is unchanged here.
                </p>
              </section>
            ) : !state.started ? (
              <NotStarted note={note} setNote={setNote} />
            ) : (
              <Going state={state} act={act} note={note} setNote={setNote} />
            )}
          </div>
        </main>
      </div>
      {state.give != null && <GiveDialog state={state} act={act} setNote={setNote} />}
      <div className="visually-hidden" aria-live="polite">
        {state.say}
      </div>
      <section className="hig-demo" aria-labelledby="hig-demo-heading">
        <h2 id="hig-demo-heading" className="hig-label">
          Try it · the board’s own switches, not in the product
        </h2>
        <div className="hig-demo-buttons">
          <button
            className="button demo-dense"
            type="button"
            onClick={() => {
              act(seed(name));
              setView(seed(name).manage ? 'going' : 'plan');
            }}
          >
            Start again
          </button>
          <button
            className="button demo-dense"
            type="button"
            onClick={() => act({ ...state, online: !state.online, refused: '', say: '' })}
          >
            {state.online ? 'Go offline' : 'Back online'}
          </button>
          <button
            className="button demo-dense"
            type="button"
            onClick={() => act({ ...state, teamLanded: !state.teamLanded })}
          >
            {state.teamLanded ? 'Before sc-36034 lands' : 'After sc-36034 lands'}
          </button>
          <button
            className="button demo-dense"
            type="button"
            onClick={() => {
              act({ ...state, manage: !state.manage });
              setView(state.manage ? 'plan' : 'going');
            }}
          >
            {state.manage ? 'View without service.manage' : 'View with service.manage'}
          </button>
        </div>
      </section>
    </div>
  );
}

function NotStarted({ note, setNote }: { note: string; setNote: (n: string) => void }) {
  return (
    <section className="hig-card hig-not-started" aria-labelledby="hig-not-started">
      <h2 id="hig-not-started" className="hig-card-title">
        Service hasn’t started
      </h2>
      <button
        className="button button-primary hig-start"
        type="button"
        onClick={() => setNote('Starting service and firing are sc-4009’s.')}
      >
        Start service
      </button>
      {note !== '' && (
        <p className="hig-note" role="status">
          {note}
        </p>
      )}
    </section>
  );
}

function Going({
  state,
  act,
  note,
  setNote,
}: {
  state: ServiceState;
  act: (next: ServiceState) => void;
  note: string;
  setNote: (n: string) => void;
}) {
  const s = state.summary;
  const c = s.course;
  const counts = [
    { key: 'tray', word: 'On a tray', n: c.onTray },
    { key: 'kitchen', word: 'Waiting on the kitchen', n: c.kitchen },
    { key: 'serve', word: 'To serve', n: c.toServe },
    { key: 'served', word: 'Served', n: c.served },
  ];

  return (
    <>
      {state.refused !== '' && (
        <div className="hig-refused" role="status">
          <Glyph paths={state.online ? INFO_GLYPH : OFFLINE_GLYPH} size={18} />
          <span>{state.refused}</span>
        </div>
      )}
      {note !== '' && (
        <p className="hig-note" role="status">
          {note}
        </p>
      )}
      <div className="hig-grid">
        <section className="hig-card hig-course" aria-labelledby="hig-course-line">
          <h2 id="hig-course-line" className="hig-course-line">
            {c.served} of {c.due} guests have had {c.name}
          </h2>
          <Bar parts={[...counts].reverse()} due={c.due} />
          <div className="hig-counts">
            <ul className="hig-count-list">
              {counts.map((x) => (
                <li key={x.key} className="hig-count">
                  <span className="hig-swatch" data-kind={x.key} aria-hidden="true" />
                  <span className="hig-count-word">{x.word}</span>
                  <span className="hig-count-n">{x.n}</span>
                </li>
              ))}
            </ul>
            <div className="hig-not-here">
              <span className="hig-count-word">Not here yet</span>
              <span className="hig-count-n">{c.notHere}</span>
            </div>
          </div>
        </section>

        <section className="hig-card hig-sections" aria-labelledby="hig-sections-heading">
          <h2 id="hig-sections-heading" className="hig-card-title">
            Sections
          </h2>
          <p className="hig-meta">Nobody on it first, then the most left each.</p>
          <ul className="hig-rows">
            {[...s.sections].sort(sectionOrder).map((sec) => (
              <SectionRow key={sec.id} sec={sec} state={state} act={act} />
            ))}
          </ul>
        </section>

        <section className="hig-card hig-kitchen" aria-labelledby="hig-kitchen-heading">
          <h2 id="hig-kitchen-heading" className="hig-card-title">
            The kitchen
          </h2>
          <ul className="hig-rows">
            {kitchenRows(s)
              .filter((k) => k.station != null)
              .map((k) => (
                <KitchenRow key={k.item} k={k} />
              ))}
          </ul>
          {kitchenRows(s).some((k) => k.station == null) && (
            <>
              <h3 className="hig-sub">No station</h3>
              <ul className="hig-rows">
                {kitchenRows(s)
                  .filter((k) => k.station == null)
                  .map((k) => (
                    <li key={k.item} className="hig-kitchen-row">
                      <strong>{k.item}</strong>
                    </li>
                  ))}
              </ul>
            </>
          )}
        </section>

        <section className="hig-card hig-alerts" aria-labelledby="hig-alerts-heading">
          <h2 id="hig-alerts-heading" className="hig-card-title">
            Alerts
          </h2>
          {s.alerts.length === 0 ? (
            <p className="hig-meta">Nothing needs you.</p>
          ) : (
            <ul className="hig-rows">
              {s.alerts.map((a) => (
                <AlertRow key={a.id} a={a} state={state} act={act} setNote={setNote} />
              ))}
            </ul>
          )}
        </section>

        <section className="hig-card hig-earlier" aria-labelledby="hig-earlier-heading">
          <h2 id="hig-earlier-heading" className="hig-card-title">
            Earlier courses
          </h2>
          <ul className="hig-rows">
            {s.earlier.map((e) => (
              <li key={e.course} className="hig-earlier-row">
                {e.course} · {e.served} of {e.due} served · {e.minutes} min
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

function SectionRow({
  sec,
  state,
  act,
}: {
  sec: Section;
  state: ServiceState;
  act: (next: ServiceState) => void;
}) {
  const nobody = sec.people === 0;

  return (
    <li className="hig-section">
      <span className="hig-tile" data-nobody={nobody || undefined} aria-hidden="true">
        {sec.id}
      </span>
      <div className="hig-section-body">
        <div className="hig-section-head">
          <div className="hig-section-words">
            <div className="hig-title">
              <strong>
                {sec.name} · {people(sec.people)}
              </strong>
              {nobody && (
                <span className="hig-chip">
                  <Glyph paths={NOBODY_GLYPH} size={12} />
                  Nobody on it
                </span>
              )}
              {sec.behind && (
                <span className="hig-chip">
                  <Glyph paths={BEHIND_GLYPH} size={12} />
                  Behind
                </span>
              )}
            </div>
            <span className="hig-meta">
              {sec.served} of {sec.due}
            </span>
          </div>
          {!nobody && <span className="hig-left">{sec.leftEach} left each</span>}
        </div>
        {waitersOn(state.summary, sec.id).length > 0 && (
          <ul className="hig-waiters">
            {waitersOn(state.summary, sec.id).map((w) => (
              <WaiterRow key={w.name} w={w} sec={sec} state={state} act={act} />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

function WaiterRow({
  w,
  sec,
  state,
  act,
}: {
  w: Waiter;
  sec: Section;
  state: ServiceState;
  act: (next: ServiceState) => void;
}) {
  const kind = lineKind(w);

  return (
    <li className="hig-waiter">
      <span className="hig-initials" aria-hidden="true">
        {initials(w.name)}
      </span>
      <span className="hig-waiter-line">
        {waiterLine(w)}
        {w.asWell === sec.id && <span className="hig-tag">As well</span>}
        {kind === 'paused' && (
          <span className="hig-chip hig-paused">
            <Glyph paths={PAUSE_GLYPH} size={12} />
            Paused
          </span>
        )}
      </span>
      {kind === 'started' && (
        <button
          className="hig-text-button"
          type="button"
          aria-label={`Pause ${w.name}’s tray for ${w.tray?.table ?? ''}`}
          onClick={() => act(pause(state, w.name))}
        >
          Pause the tray
        </button>
      )}
    </li>
  );
}

function KitchenRow({ k }: { k: KitchenItem }) {
  const nobody = k.people === '';

  return (
    <li className="hig-kitchen-row">
      <span className="hig-initials" data-nobody={nobody || undefined} aria-hidden="true">
        {nobody ? '!' : initials(k.people)}
      </span>
      <div className="hig-kitchen-words">
        <div className="hig-title">
          <strong>
            {k.item} · {k.station} · {nobody ? `Nobody on ${k.station ?? ''}` : k.people}
          </strong>
          {k.state === 'Ready' && (
            <span className="hig-chip hig-ready">
              <Glyph paths={DIAMOND_GLYPH} size={10} />
              Ready
            </span>
          )}
          {k.state === 'Preparing' && (
            <span className="hig-chip">
              <Glyph paths={CLOCK_GLYPH} size={12} />
              Preparing
            </span>
          )}
          {k.heldUpMin != null && (
            <span className="hig-chip hig-held-up">
              <Glyph paths={HOURGLASS_GLYPH} size={12} />
              Held up · {k.heldUpMin} min
            </span>
          )}
        </div>
        {k.readyIn != null && <span className="hig-meta">Ready in about {k.readyIn} min</span>}
        {k.waiting > 0 && <span className="hig-waiting">{k.waiting} waiting</span>}
      </div>
    </li>
  );
}

function AlertRow({
  a,
  state,
  act,
  setNote,
}: {
  a: Alert;
  state: ServiceState;
  act: (next: ServiceState) => void;
  setNote: (n: string) => void;
}) {
  const button = buttonOf(state, a);
  const teamFor =
    a.kind === 'nobody' ? 'Section C' : a.kind === 'station' ? 'the Fryer' : 'the Grill';

  return (
    <li className="hig-alert">
      <span className="hig-alert-icon" data-kind={a.kind} aria-hidden="true">
        <Glyph paths={ALERT_GLYPH[a.kind]} size={18} />
      </span>
      <div className="hig-alert-words">
        <strong>{a.title}</strong>
        <span className="hig-meta">{a.sub}</span>
        {a.flag !== '' && (
          <span className="hig-flag">
            <Glyph paths={FLAG_GLYPH} size={12} />
            {a.flag}
          </span>
        )}
      </div>
      {button === 'Give to…' && (
        <button
          className="button button-primary hig-alert-button"
          type="button"
          onClick={() => act(openGive(state, a.id))}
        >
          Give to…
        </button>
      )}
      {button === 'Go to table' && (
        <button
          className="button hig-alert-button"
          type="button"
          onClick={() => setNote(`Opens ${a.table}’s panel (sc-4026).`)}
        >
          Go to table
        </button>
      )}
      {button === 'Team' && (
        <button
          className="button hig-alert-button"
          type="button"
          onClick={() => setNote(`Opens Team on ${teamFor} (sc-36034).`)}
        >
          Team
        </button>
      )}
    </li>
  );
}

function GiveDialog({
  state,
  act,
  setNote,
}: {
  state: ServiceState;
  act: (next: ServiceState) => void;
  setNote: (n: string) => void;
}) {
  const give = state.give;
  const first = useRef<HTMLHeadingElement>(null);

  const onEscape = useRef<() => void>(() => undefined);

  useEffect(() => first.current?.focus(), []);
  useEffect(() => {
    onEscape.current = () => act(closeGive(state));
  });
  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onEscape.current();
    };
    document.addEventListener('keydown', keys);

    return () => document.removeEventListener('keydown', keys);
  }, []);

  if (give == null) return null;
  const list = candidates(state.summary, give);
  const section = sectionName(state.summary, give.section);
  const pausedBy = waiterOf(state.summary, give.waiter)?.tray?.pausedBy ?? give.waiter;
  const close = () => act(closeGive(state));

  return (
    <div className="hig-scrim">
      <div className="hig-dialog" role="dialog" aria-modal="true" aria-labelledby="hig-give-title">
        <h2 id="hig-give-title" ref={first} tabIndex={-1} className="hig-dialog-title">
          Give {give.table}’s tray to…
        </h2>
        <p className="hig-meta">
          {pausedBy === give.waiter
            ? `${give.waiter} paused it · ${section}`
            : `${give.waiter}’s tray · ${pausedBy} paused it · ${section}`}
        </p>
        {state.refused !== '' && (
          <div className="hig-refused" role="status">
            <Glyph paths={state.online ? INFO_GLYPH : OFFLINE_GLYPH} size={18} />
            <span>{state.refused}</span>
          </div>
        )}
        {list.length === 0 ? (
          <div className="hig-nobody-else">
            <p>{nobodyElse(section)}</p>
            <button
              className="button hig-alert-button"
              type="button"
              onClick={() => {
                setNote(`Opens Team on ${section} (sc-36034). Nobody is moved from here.`);
                close();
              }}
            >
              Team
            </button>
          </div>
        ) : (
          <ul className="hig-candidates">
            {list.map((c) => (
              <li key={c.name}>
                <button
                  className="hig-candidate"
                  type="button"
                  onClick={() => act(giveTo(state, c.name))}
                >
                  <span className="hig-initials" aria-hidden="true">
                    {initials(c.name)}
                  </span>
                  <span className="hig-candidate-words">
                    <span className="hig-title">
                      <strong>{c.name}</strong>
                      {c.asWell && <span className="hig-tag">As well</span>}
                    </span>
                    <span className="hig-meta">{c.inHand}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <button className="hig-text-button hig-cancel" type="button" onClick={close}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function Bar({ parts, due }: { parts: readonly { key: string; n: number }[]; due: number }) {
  const starts = parts.map((_, i) => parts.slice(0, i).reduce((sum, p) => sum + p.n, 0));

  return (
    <svg
      className="hig-bar"
      aria-hidden="true"
      viewBox={`0 0 ${Math.max(due, 1)} 10`}
      preserveAspectRatio="none"
    >
      {parts.map((part, i) => (
        <rect
          key={part.key}
          className="hig-bar-part"
          data-kind={part.key}
          x={starts[i] ?? 0}
          y={0}
          width={part.n}
          height={10}
        />
      ))}
    </svg>
  );
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0] ?? '')
    .join('')
    .slice(0, 2);
}

function Glyph({ paths, size }: { paths: readonly string[]; size: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" className="hig-glyph">
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
