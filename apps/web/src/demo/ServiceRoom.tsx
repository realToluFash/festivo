import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { Glyph } from './HowItsGoing.tsx';
import {
  BEHIND_GLYPH,
  FLAG_GLYPH,
  INFO_GLYPH,
  NOBODY_GLYPH,
  OFFLINE_GLYPH,
  PAUSE_GLYPH,
} from './serviceGlyphs.ts';
import {
  ACTION_WORD,
  AS_OF,
  type Action,
  type Alert,
  type AlertKind,
  COURSE,
  DECLINE_BLANK,
  EVENT,
  KEY,
  NO_MANAGE,
  type Request,
  type Room,
  type RoomStateName,
  type RoomTable,
  SECTIONS,
  type Seat,
  type SeatState,
  type Section,
  type SortKey,
  type View,
  type Word,
  alertsOf,
  ariaSort,
  closePanel,
  closedLine,
  closedRequests,
  decline,
  done,
  flaggedSaid,
  flaggedSeats,
  flaggedWord,
  goToTable,
  heldLine,
  kindLine,
  offered,
  onItLine,
  openDecline,
  openPanel,
  openRequests,
  REASON_MAX,
  owedLine,
  ownerLine,
  planOrder,
  planStep,
  planStop,
  pressSort,
  requestsInOrder,
  roomSeed,
  roomStateOf,
  sectionBehind,
  sectionName,
  sectionTables,
  seatWho,
  sorted,
  stateWord,
  stripLine,
  tableLabel,
  tableOf,
  tablesWord,
  take,
  trayLine,
  waitWord,
  wordOf,
} from './serviceRoom.ts';
import './howItsGoing.css';
import './serviceRoom.css';

const AREAS = ['Overview', 'Guests', 'Seating', 'Menu', 'Service', 'Messages', 'Reports'];
const VIEW_WORDS: Record<View, string> = { going: 'How it’s going', plan: 'Plan', list: 'List' };
const REQUEST_GLYPH = ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'];
const WARN_GLYPH = [
  'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  'M12 9v4',
  'M12 17h.01',
];
const ALERT_GLYPH: Record<AlertKind, readonly string[]> = {
  request: REQUEST_GLYPH,
  behind: BEHIND_GLYPH,
  allergy: ['M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0', 'M9 12h6', 'm12 9-3 3 3 3'],
};

type Pending = Room['pending'];

const PENDING_WORDS: readonly { p: Pending; word: string }[] = [
  { p: null, word: 'Done goes through' },
  { p: 'closedFirst', word: 'Someone closed it first' },
  { p: 'plate_stage_invalid', word: 'The plate went Dishing (plate_stage_invalid)' },
  { p: 'dish_not_for_guest', word: 'A flag rules the dish out (dish_not_for_guest)' },
];

/** /demo/service-room (sc-4026): the whole room as a plan or a list at 1280 × 800, by ?state=. */
export function ServiceRoomPage() {
  const [params] = useSearchParams();
  const name = roomStateOf(params.get('state'));

  return <ServiceRoom key={name} name={name} />;
}

function ServiceRoom({ name }: { name: RoomStateName }) {
  const [r, setR] = useState<Room>(() => roomSeed(name));
  const focusTo = useRef('');

  useEffect(() => {
    if (focusTo.current === '') return;
    document.querySelector<HTMLElement>(focusTo.current)?.focus();
    focusTo.current = '';
  });

  function act(next: Room, focus = ''): void {
    focusTo.current = focus;
    setR(next);
  }

  const showing: View = r.view;
  const open = tableOf(r, r.open);
  const offline = r.strip === 'offline';
  const quiet = r.strip === 'connected' || r.strip === 'refreshing';

  return (
    <div className="hig-page">
      <div className="hig-desk sr-desk">
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
              <p className="hig-meta">{r.started ? `${COURSE} · ${EVENT}` : EVENT}</p>
            </div>
            <div className="hig-status" role="status" data-offline={!quiet || undefined}>
              {r.strip === 'connected' && <span className="hig-status-dot" aria-hidden="true" />}
              {r.strip === 'offline' && <Glyph paths={OFFLINE_GLYPH} size={16} />}
              {(r.strip === 'unreachable' || r.strip === 'notStarted') && (
                <Glyph paths={INFO_GLYPH} size={16} />
              )}
              {r.strip === 'refreshing' && <span className="sr-spinner" aria-hidden="true" />}
              <span>{stripLine(r.strip)}</span>
            </div>
          </header>
          <div className="hig-views" role="group" aria-label="Show">
            {(['going', 'plan', 'list'] as const).map((v) => (
              <button
                key={v}
                type="button"
                className="hig-view"
                aria-pressed={showing === v}
                onClick={() => act({ ...r, view: v })}
              >
                {VIEW_WORDS[v]}
              </button>
            ))}
          </div>
          <div className="hig-scroll">
            {r.loading ? (
              <Loading />
            ) : showing === 'going' ? (
              <section className="hig-card" aria-labelledby="sr-going">
                <h2 id="sr-going" className="hig-card-title">
                  How it’s going
                </h2>
                <p className="hig-meta">
                  How it’s going is sc-34107’s, built at{' '}
                  <Link to="/demo/how-its-going">/demo/how-its-going</Link>.
                </p>
              </section>
            ) : (
              <>
                {r.refused !== '' && (
                  <div className="hig-refused" role="status">
                    <Glyph paths={OFFLINE_GLYPH} size={18} />
                    <span>{r.refused}</span>
                  </div>
                )}
                {!r.started && <NotStarted />}
                <div className="sr-room" data-panel={open != null || undefined}>
                  <div className="sr-floor">
                    <Sections r={r} />
                    {showing === 'plan' ? (
                      r.hasPlan ? (
                        <Plan r={r} act={act} />
                      ) : (
                        <section className="hig-card sr-no-plan" aria-labelledby="sr-no-plan">
                          <h2 id="sr-no-plan" className="hig-card-title">
                            No floor plan for this venue
                          </h2>
                          <button
                            className="button"
                            type="button"
                            onClick={() => act({ ...r, view: 'list' })}
                          >
                            Show the list
                          </button>
                        </section>
                      )
                    ) : (
                      <List r={r} act={act} />
                    )}
                  </div>
                  {open != null ? (
                    <Panel r={r} t={open} act={act} offline={offline} />
                  ) : (
                    r.manage && <Alerts r={r} act={act} />
                  )}
                </div>
              </>
            )}
          </div>
        </main>
      </div>
      <div className="visually-hidden" aria-live="polite">
        {r.say}
      </div>
      <section className="hig-demo" aria-labelledby="sr-demo-heading">
        <h2 id="sr-demo-heading" className="hig-label">
          Try it · the board’s own switches, not in the product
        </h2>
        <div className="hig-demo-buttons">
          <button className="button demo-dense" type="button" onClick={() => act(roomSeed(name))}>
            Start again
          </button>
          <button
            className="button demo-dense"
            type="button"
            onClick={() => act({ ...r, strip: offline ? 'connected' : 'offline', refused: '' })}
          >
            {offline ? 'Back online' : 'Go offline'}
          </button>
          <button
            className="button demo-dense"
            type="button"
            onClick={() =>
              act({ ...r, manage: !r.manage, viewer: r.manage ? 'Bisi Lawal' : 'Ifeoma Nduka' })
            }
          >
            {r.manage ? 'View without service.manage' : 'View with service.manage'}
          </button>
        </div>
        <div className="hig-demo-buttons" role="group" aria-label="When Done is pressed">
          {PENDING_WORDS.map((x) => (
            <button
              key={x.word}
              className="button demo-dense"
              type="button"
              aria-pressed={r.pending === x.p}
              onClick={() => act({ ...r, pending: x.p })}
            >
              {x.word}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function Loading() {
  return (
    <div className="sr-room" aria-busy="true" aria-label="Loading the room">
      <div className="sr-floor">
        <div className="sr-skeleton sr-skeleton-row" />
        <div className="sr-skeleton sr-skeleton-plan" />
      </div>
      <div className="sr-skeleton sr-skeleton-side" />
    </div>
  );
}

function NotStarted() {
  const [note, setNote] = useState('');
  return (
    <section className="hig-card hig-not-started" aria-labelledby="sr-not-started">
      <h2 id="sr-not-started" className="hig-card-title">
        Service hasn’t started
      </h2>
      <button
        className="button button-primary"
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

function Sections({ r }: { r: Room }) {
  return (
    <ul className="sr-sections" aria-label="Sections">
      {SECTIONS.map((sec) => (
        <SectionCard key={sec.id} sec={sec} r={r} />
      ))}
    </ul>
  );
}

function SectionCard({ sec, r }: { sec: Section; r: Room }) {
  const nobody = sec.people.length === 0;
  const n = sectionTables(r.tables, sec.id).length;
  return (
    <li className="hig-card sr-section">
      <span className="hig-tile" data-nobody={nobody || undefined} aria-hidden="true">
        {nobody ? <Glyph paths={NOBODY_GLYPH} size={20} /> : sec.id}
      </span>
      <div className="sr-section-words">
        <strong>
          {sectionName(sec.id)} · {onItLine(sec)}
        </strong>
        <span className="hig-meta">{tablesWord(n)}</span>
        {sectionBehind(r.tables, sec.id) && (
          <span className="hig-chip">
            <Glyph paths={BEHIND_GLYPH} size={12} />
            Behind
          </span>
        )}
      </div>
    </li>
  );
}

function Shape({ word }: { word: Word | 'request' }) {
  if (word === 'behind') return <Glyph paths={BEHIND_GLYPH} size={14} />;
  if (word === 'request') return <Glyph paths={REQUEST_GLYPH} size={14} />;
  return <span className="sr-shape" data-word={word} aria-hidden="true" />;
}

function StateLine({ t }: { t: RoomTable }) {
  const w = wordOf(t);
  return (
    <span className="sr-state" data-word={w}>
      <Shape word={w} />
      <span>{stateWord(t)}</span>
    </span>
  );
}

function Extras({ t }: { t: RoomTable }) {
  const f = flaggedSeats(t).length;
  return (
    <>
      {openRequests(t).length > 0 && (
        <span className="sr-extra">
          <Shape word="request" />
          Request
        </span>
      )}
      {f > 0 && (
        <span className="sr-extra sr-flagged">
          <Glyph paths={FLAG_GLYPH} size={14} />
          <span aria-hidden="true">{flaggedWord(f)}</span>
          <span className="visually-hidden">{flaggedSaid(f)}</span>
        </span>
      )}
    </>
  );
}

function Plan({ r, act }: { r: Room; act: (next: Room, focus?: string) => void }) {
  const order = planOrder(r.tables);
  const stop = planStop(order, r.open, r.last);
  const move = (from: number, key: string): boolean => {
    const to = planStep(order, from, key);
    if (to == null) return false;
    act({ ...r, last: to }, `[data-table="${to}"]`);
    return true;
  };
  return (
    <section className="hig-card sr-plan" aria-labelledby="sr-plan-heading">
      <h2 id="sr-plan-heading" className="visually-hidden">
        Plan
      </h2>
      <div className="sr-zones">
        {SECTIONS.map((sec) => (
          <div key={sec.id} className="sr-zone">
            <span className="hig-label">{sectionName(sec.id)}</span>
            <ul className="sr-tiles">
              {sectionTables(r.tables, sec.id).map((t) => (
                <li key={t.n}>
                  <button
                    type="button"
                    className="sr-tile"
                    data-word={wordOf(t)}
                    aria-label={tableLabel(t)}
                    aria-expanded={r.open === t.n}
                    data-table={t.n}
                    tabIndex={stop === t.n ? 0 : -1}
                    onFocus={() => {
                      if (r.last !== t.n) act({ ...r, last: t.n });
                    }}
                    onKeyDown={(event) => {
                      if (move(t.n, event.key)) event.preventDefault();
                    }}
                    onClick={() => act(openPanel({ ...r, last: t.n }, t.n), '#sr-panel-title')}
                  >
                    <span className="sr-tile-head">
                      <strong>Table {t.n}</strong>
                      <span className="hig-meta">{t.covers}</span>
                    </span>
                    <StateLine t={t} />
                    <Extras t={t} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <Key />
    </section>
  );
}

function Key() {
  return (
    <div className="sr-key">
      <h3 className="hig-label">Key</h3>
      <ul className="sr-key-list">
        {KEY.map((k) => (
          <li key={k.word} className="sr-state" data-word={k.word}>
            <Shape word={k.word} />
            <span>{k.label}</span>
          </li>
        ))}
        <li className="sr-extra">
          <Shape word="request" />
          Request: a guest’s request is open
        </li>
        <li className="sr-extra sr-flagged">
          <Glyph paths={FLAG_GLYPH} size={14} />
          {'{n}'} flagged: guests with a flag still to serve
        </li>
      </ul>
    </div>
  );
}

function List({ r, act }: { r: Room; act: (next: Room, focus?: string) => void }) {
  const head = (key: SortKey, word: string) => (
    <th scope="col" aria-sort={ariaSort(r.sort, key)}>
      <button
        type="button"
        className="sr-sort"
        onClick={() => act({ ...r, sort: pressSort(r.sort, key) })}
      >
        {word}
        <span aria-hidden="true">
          {ariaSort(r.sort, key) === 'none'
            ? ''
            : ariaSort(r.sort, key) === 'ascending'
              ? ' ↑'
              : ' ↓'}
        </span>
      </button>
    </th>
  );
  return (
    <section className="hig-card sr-list" aria-labelledby="sr-list-heading">
      <h2 id="sr-list-heading" className="visually-hidden">
        List
      </h2>
      <table className="sr-table">
        <thead>
          <tr>
            {head('table', 'Table')}
            {head('section', 'Section')}
            <th scope="col">Covers</th>
            <th scope="col">State</th>
            {head('wait', 'Wait')}
            <th scope="col">On it</th>
          </tr>
        </thead>
        <tbody>
          {sorted(r.tables, r.sort).map((t) => {
            const sec = SECTIONS.find((s) => s.id === t.section);
            return (
              <tr key={t.n} data-open={r.open === t.n || undefined}>
                <td>
                  <button
                    type="button"
                    className="sr-row-button"
                    aria-label={tableLabel(t)}
                    data-table={t.n}
                    onClick={() => act(openPanel(r, t.n), '#sr-panel-title')}
                  >
                    Table {t.n}
                  </button>
                </td>
                <td>{sectionName(t.section)}</td>
                <td className="sr-number">{t.covers}</td>
                <td>
                  <div className="sr-cell">
                    <StateLine t={t} />
                    <Extras t={t} />
                  </div>
                </td>
                <td className="sr-number">{waitWord(t)}</td>
                <td>{sec == null ? '' : onItLine(sec)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function Alerts({ r, act }: { r: Room; act: (next: Room, focus?: string) => void }) {
  const alerts = r.started ? alertsOf(r.tables) : [];
  return (
    <section className="hig-card sr-side" aria-labelledby="sr-alerts-heading">
      <h2 id="sr-alerts-heading" className="hig-card-title">
        Alerts
      </h2>
      {alerts.length === 0 ? (
        <p className="hig-meta">Nothing needs you.</p>
      ) : (
        <ul className="hig-rows">
          {alerts.map((a) => (
            <AlertRow key={a.id} a={a} onGo={() => act(goToTable(r, a.id), '#sr-panel-title')} />
          ))}
        </ul>
      )}
    </section>
  );
}

function AlertRow({ a, onGo }: { a: Alert; onGo: () => void }) {
  return (
    <li className="hig-alert sr-alert">
      <span className="hig-alert-icon" data-kind={a.kind} aria-hidden="true">
        <Glyph paths={ALERT_GLYPH[a.kind]} size={18} />
      </span>
      <div className="hig-alert-words">
        <strong>{a.title}</strong>
        <span className="hig-meta">{a.sub}</span>
        {a.flag !== '' && (
          <span className="hig-flag">
            <Glyph paths={FLAG_GLYPH} size={14} />
            {a.flag}
          </span>
        )}
        <button className="button sr-go" type="button" onClick={onGo}>
          Go to table
        </button>
      </div>
    </li>
  );
}

const SEAT_SHAPE: Partial<Record<SeatState, Word>> = {
  'To serve': 'serve',
  Dishing: 'tray',
  Checked: 'tray',
  'On its way': 'tray',
  Served: 'served',
  'Waiting on the kitchen': 'kitchen',
  'Not here yet': 'notHere',
};

function Panel({
  r,
  t,
  act,
  offline,
}: {
  r: Room;
  t: RoomTable;
  act: (next: Room, focus?: string) => void;
  offline: boolean;
}) {
  const flagged = flaggedSeats(t);
  const open = requestsInOrder(r, t);
  const closed = closedRequests(t);
  const sec = SECTIONS.find((s) => s.id === t.section);
  const aside = useRef<HTMLElement>(null);

  useEffect(() => {
    const box = aside.current;
    const press = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      act(closePanel(r), `[data-table="${t.n}"]`);
    };
    box?.addEventListener('keydown', press);

    return () => box?.removeEventListener('keydown', press);
  }, [act, r, t.n]);

  return (
    <aside ref={aside} className="hig-card sr-side sr-panel" aria-labelledby="sr-panel-title">
      <div className="sr-panel-head">
        <div className="sr-panel-words">
          <h2 id="sr-panel-title" className="hig-card-title" tabIndex={-1}>
            Table {t.n}
          </h2>
          <StateLine t={t} />
          <span className="hig-meta">
            {t.covers} covers · {sectionName(t.section)}
          </span>
        </div>
        <button
          className="button"
          type="button"
          onClick={() => act(closePanel(r), `[data-table="${t.n}"]`)}
        >
          Close
        </button>
      </div>

      {flagged.length > 0 && (
        <section className="sr-part" aria-labelledby="sr-flagged">
          <h3 id="sr-flagged" className="hig-sub">
            Flagged guests
          </h3>
          <ul className="hig-rows">
            {flagged.map((s) => (
              <li key={s.n} className="sr-seat-row">
                <strong>{seatWho(s)}</strong>
                <span className="hig-flag">
                  <Glyph paths={FLAG_GLYPH} size={14} />
                  {s.flags.join(', ')}
                </span>
                <span className="hig-meta">
                  {s.dish ?? 'Nothing for this course'} · {s.state}
                </span>
                {s.owed.map((o) => (
                  <span key={o.reason} className="hig-meta">
                    {owedLine(o)}
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="sr-part" aria-labelledby="sr-requests">
        <h3 id="sr-requests" className="hig-sub">
          Requests · {open.length}
        </h3>
        {!r.manage && <p className="hig-meta">{NO_MANAGE}</p>}
        {open.length === 0 ? (
          <p className="hig-meta">No open requests.</p>
        ) : (
          <ul className="sr-requests">
            {open.map((q) => (
              <RequestCard key={q.id} r={r} q={q} act={act} offline={offline} />
            ))}
          </ul>
        )}
      </section>

      {t.trays.length > 0 && (
        <section className="sr-part" aria-labelledby="sr-trays">
          <h3 id="sr-trays" className="hig-sub">
            Trays
          </h3>
          <ul className="hig-rows">
            {t.trays.map((tr) => (
              <li key={tr.waiter} className="sr-tray">
                <span>{trayLine(tr)}</span>
                {tr.paused && (
                  <span className="hig-chip hig-paused">
                    <Glyph paths={PAUSE_GLYPH} size={12} />
                    Paused
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="sr-part" aria-labelledby="sr-seats">
        <h3 id="sr-seats" className="hig-sub">
          Seats
        </h3>
        <SeatRing seats={t.seats} />
        <ul className="hig-rows">
          {t.seats.map((s) => (
            <SeatRow key={s.n} s={s} />
          ))}
        </ul>
      </section>

      {closed.length > 0 && (
        <section className="sr-part" aria-labelledby="sr-closed">
          <h3 id="sr-closed" className="hig-sub">
            Closed at this table
          </h3>
          <ul className="sr-requests">
            {closed.map((q) => (
              <li key={q.id} className="sr-request" data-closed>
                {r.notice[q.id] != null && (
                  <p className="sr-notice" id={`sr-notice-${q.id}`} tabIndex={-1} role="status">
                    <Glyph paths={WARN_GLYPH} size={16} />
                    <span>{r.notice[q.id]}</span>
                  </p>
                )}
                <strong>{kindLine(q)}</strong>
                <span>{q.words}</span>
                <span className="hig-meta">{closedLine(q)}</span>
                {q.closed?.reason != null && (
                  <span className="hig-meta">Why: {q.closed.reason}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="sr-on-it">
        <strong>On it</strong> · {sectionName(t.section)} · {sec == null ? '' : onItLine(sec)}
      </p>
    </aside>
  );
}

function RequestCard({
  r,
  q,
  act,
  offline,
}: {
  r: Room;
  q: Request;
  act: (next: Room, focus?: string) => void;
  offline: boolean;
}) {
  const buttons = offered(r, q);
  const notice = r.notice[q.id];
  const declining = r.declining === q.id;
  const press = (a: Action) => {
    if (a === 'take') act(take(r, q.id));
    else if (a === 'done') {
      const next = done(r, q.id);
      act(next, next.notice[q.id] != null ? `#sr-notice-${q.id}` : '');
    } else act(openDecline(r, q.id), `#sr-reason-${q.id}`);
  };

  return (
    <li className="sr-request">
      <strong>{kindLine(q)}</strong>
      <span>{q.words}</span>
      {q.plate != null && (
        <span className="hig-meta">
          Now: {q.plate.now} · New: {q.plate.next}
        </span>
      )}
      <span className="hig-meta">
        {ownerLine(q, r.viewer)}
        {offline ? ` · as of ${AS_OF}` : ''}
      </span>
      {notice != null && (
        <p className="sr-notice" id={`sr-notice-${q.id}`} tabIndex={-1} role="status">
          <Glyph paths={WARN_GLYPH} size={16} />
          <span>{notice}</span>
        </p>
      )}
      {declining ? (
        <form
          className="sr-decline"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const next = decline(r);
            act(next, next.reasonWrong ? `#sr-reason-${q.id}` : '');
          }}
        >
          <div className="field">
            <label htmlFor={`sr-reason-${q.id}`}>Why it can’t be done</label>
            <textarea
              id={`sr-reason-${q.id}`}
              className={r.reasonWrong ? 'input sr-reason input-wrong' : 'input sr-reason'}
              value={r.reason}
              maxLength={REASON_MAX}
              aria-invalid={r.reasonWrong || undefined}
              aria-describedby={r.reasonWrong ? `sr-reason-${q.id}-error` : undefined}
              onChange={(e) => act({ ...r, reason: e.target.value })}
            />
            {r.reasonWrong && (
              <p id={`sr-reason-${q.id}-error`} className="field-error">
                <Glyph paths={WARN_GLYPH} size={16} />
                <span>{DECLINE_BLANK}</span>
              </p>
            )}
          </div>
          <div className="sr-buttons">
            <button className="button button-primary" type="submit">
              Decline request
            </button>
            <button
              className="button"
              type="button"
              onClick={() => act({ ...r, declining: null, reasonWrong: false })}
            >
              Keep it
            </button>
          </div>
        </form>
      ) : (
        buttons.length > 0 && (
          <div className="sr-buttons">
            {buttons.map((a, i) => (
              <button
                key={a}
                className={i === 0 && a !== 'decline' ? 'button button-primary' : 'button'}
                type="button"
                onClick={() => press(a)}
              >
                {ACTION_WORD[a]}
              </button>
            ))}
          </div>
        )
      )}
    </li>
  );
}

function SeatRing({ seats }: { seats: readonly Seat[] }) {
  const c = 110;
  return (
    <svg className="sr-ring" viewBox="0 0 220 220" width={220} height={220} aria-hidden="true">
      <defs>
        <pattern
          id="sr-hatch"
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="4" height="4" className="sr-hatch-ground" />
          <path d="M0 0v4" className="sr-hatch-line" />
        </pattern>
      </defs>
      <circle cx={c} cy={c} r={52} className="sr-ring-table" />
      {seats.map((s, i) => {
        const a = (i / seats.length) * Math.PI * 2 - Math.PI / 2;
        const x = c + Math.cos(a) * 86;
        const y = c + Math.sin(a) * 86;
        return (
          <g key={s.n}>
            <circle
              cx={x}
              cy={y}
              r={17}
              className="sr-ring-seat"
              data-word={SEAT_SHAPE[s.state] ?? 'none'}
            />
            <text
              x={x}
              y={y + 4.5}
              textAnchor="middle"
              className="sr-ring-n"
              data-word={SEAT_SHAPE[s.state] ?? 'none'}
            >
              {s.n}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function SeatRow({ s }: { s: Seat }) {
  const shape = SEAT_SHAPE[s.state];
  return (
    <li className="sr-seat-row">
      <div className="sr-seat-head">
        <strong>{s.name == null ? `Seat ${s.n}` : `Seat ${s.n} · ${s.name}`}</strong>
        <span className="sr-state" data-word={shape ?? 'none'}>
          {shape != null && <Shape word={shape} />}
          <span>{s.state}</span>
        </span>
      </div>
      {s.flags.length > 0 && (
        <span className="hig-flag">
          <Glyph paths={FLAG_GLYPH} size={14} />
          {s.flags.join(', ')}
        </span>
      )}
      {s.dish != null && <span className="hig-meta">{s.dish}</span>}
      {s.held != null && (
        <span className="hig-meta">
          {heldLine(s.held)} · {s.held.choice}
        </span>
      )}
      {s.owed.map((o) => (
        <span key={o.reason} className="sr-owed">
          {owedLine(o)}
        </span>
      ))}
    </li>
  );
}
