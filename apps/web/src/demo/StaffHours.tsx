import { useEffect, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import type { Tell } from '../components/SettingsParts.tsx';
import { DemoBell } from './DemoBell.tsx';
import { EventsShell } from './EventParts.tsx';
import { EventSidebar } from './EventSidebar.tsx';
import { type SampleEvent, sampleEvent } from './events.ts';
import { Pill } from './GuestsParts.tsx';
import {
  CORRECTED_AT,
  type HoursRow,
  type HoursStart,
  HW,
  LIVE_NOW,
  type TimesDraft,
  clockedWords,
  corrected,
  draftOf,
  hoursStart,
  hoursStateOf,
  hoursWords,
  liveOf,
  markWords,
  opensAt,
  rowsOf,
  stillOnOf,
  summaryOf,
  summaryRest,
  timesProblems,
  trailWords,
  workedOf,
} from './hours.ts';
import { When } from './JobsShifts.tsx';
import { clockOfKitchen } from './kitchen.ts';
import { KeptArea, KeptHere } from './KeptOffline.tsx';
import { keptInbox, waitingLine } from './messages.ts';
import { RW } from './roster.ts';
import { clock, jobsAt } from './shifts.ts';
import { YOU } from './staffLink.ts';
import { STATIONS_EVENT } from './stations.ts';
import { PanelFoot, PanelTop, StaffTabs } from './Stations.tsx';
import { useSwitcherStart } from './switcher.ts';
import { clockWords } from './tabKept.ts';
import './menu.css';
import './stations.css';
import './roster.css';
import './jobsShifts.css';
import './staffHours.css';

const RETRY_MS = 1200;

/** /demo/events/evt-wed-4/staff/hours (sc-234): Hours worked on the event's Staff page at 1280 × 800, by ?state=. */
export function StaffHoursPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const raw = params.get('state');
  useSwitcherStart();

  return <HoursAt key={`${id ?? ''}|${raw ?? ''}`} id={id} raw={raw} />;
}

function HoursAt({ id, raw }: { id: string | undefined; raw: string | null }) {
  const [event] = useState(() => sampleEvent(id));
  const [state] = useState(() => hoursStateOf(raw));

  if (event == null) return <Navigate to="/demo/events" replace />;
  if (event.id !== STATIONS_EVENT)
    return <Navigate to={`/demo/events/${event.id}?area=staff`} replace />;

  return (
    <KeptArea eventId={event.id} area="staff" at={clockWords(clockOfKitchen(), event.timeZone)}>
      <EventsShell
        renderSide={(tell, covered) => (
          <EventSidebar
            event={event}
            area="staff"
            now={clockOfKitchen()}
            tell={tell}
            inert={covered}
            waiting={waitingLine(keptInbox())}
          />
        )}
      >
        {(tell) => (
          <HoursView
            first={hoursStart(state)}
            phase={state === 'loading' ? 'loading' : state === 'failed' ? 'failed' : 'ready'}
            event={event}
            tell={tell}
          />
        )}
      </EventsShell>
    </KeptArea>
  );
}

type Phase = 'loading' | 'failed' | 'ready';

function HoursView({
  first,
  phase: firstPhase,
  event,
  tell,
}: {
  first: HoursStart;
  phase: Phase;
  event: SampleEvent;
  tell: Tell;
}) {
  const [clocks, setClocks] = useState(first.clocks);
  const [open, setOpen] = useState(first.open);
  const [phase, setPhase] = useState<Phase>(firstPhase);
  const [said, setSaid] = useState('');
  const { plan, removed, live, manage } = first;
  const rows = rowsOf(plan, clocks, removed);
  const editing = open == null ? null : (rows.find((one) => one.key === open.key) ?? null);

  useEffect(() => {
    if (first.open != null && first.open.pressed) document.getElementById('hw-f-in-time')?.focus();
  }, [first.open]);

  useEffect(() => {
    if (phase !== 'loading' || firstPhase === 'loading') return undefined;
    const timer = setTimeout(() => setPhase('ready'), RETRY_MS);
    return () => clearTimeout(timer);
  }, [phase, firstPhase]);

  function correct(row: HoursRow) {
    setOpen({ key: row.key, draft: draftOf(row, stillOnOf(row, live)), pressed: false });
    setSaid('');
  }

  function save() {
    if (open == null || editing == null) return;
    const stillOn = stillOnOf(editing, live);
    const problems = timesProblems(open.draft, stillOn);
    if (problems.in != null || problems.out != null) {
      setOpen({ ...open, pressed: true });
      document.getElementById(problems.in != null ? 'hw-f-in-time' : 'hw-f-out-time')?.focus();
      return;
    }
    const at = live ? LIVE_NOW : CORRECTED_AT;
    setClocks({ ...clocks, [open.key]: corrected(editing.times, open.draft, YOU, at) });
    setOpen(null);
    setSaid(HW.saved(editing.name));
    document.getElementById(`hw-correct-${open.key}`)?.focus();
  }

  let body;
  if (phase === 'loading')
    body = (
      <div className="hw-loading" role="status" aria-label={HW.loading}>
        {[0, 1, 2, 3, 4, 5].map((one) => (
          <span key={one} className="hw-bone" />
        ))}
      </div>
    );
  else if (phase === 'failed')
    body = (
      <div className="hw-failed">
        <p className="mn-failed" role="alert">
          <Glyph name="alert" size={17} weight={2.2} />
          {HW.failed}
        </p>
        <Pill label={HW.tryAgain} onClick={() => setPhase('loading')} />
      </div>
    );
  else if (rows.length === 0)
    body = (
      <section className="hw-empty" aria-labelledby="hw-empty">
        <h2 id="hw-empty">{HW.empty}</h2>
        <p>{HW.emptyLine}</p>
        <Link className="desk-text" to={jobsAt()}>
          {HW.openJobs}
          <Glyph name="chevron" size={16} weight={2.4} />
        </Link>
      </section>
    );
  else
    body = (
      <div className="mn-split">
        <div className="mn-list">
          <Summary rows={rows} live={live} />
          <HoursTable
            rows={rows}
            live={live}
            manage={manage}
            lit={open?.key ?? null}
            onCorrect={correct}
          />
        </div>
        {open != null && editing != null && manage && (
          <aside className="mn-panel" aria-labelledby="sn-panel-title">
            <CorrectPanel
              row={editing}
              draft={open.draft}
              pressed={open.pressed}
              stillOn={stillOnOf(editing, live)}
              onDraft={(draft) => setOpen({ ...open, draft })}
              onSave={save}
              onCancel={() => {
                setOpen(null);
                document.getElementById(`hw-correct-${open.key}`)?.focus();
              }}
            />
          </aside>
        )}
      </div>
    );

  return (
    <div className="desk-page ev-page gs mn sn rs js hw">
      <div className="ev-wide mn-page">
        <KeptHere />
        <div className="ev-crumb-row">
          <nav className="ev-crumb" aria-label="Breadcrumb">
            <ol>
              <li className="ev-crumb-part">
                <Link to="/demo/events">Events</Link>
              </li>
              <li className="ev-crumb-part">
                <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
                <Link className="ev-crumb-name" to={`/demo/events/${event.id}`}>
                  {event.name}
                </Link>
              </li>
              <li className="ev-crumb-part" aria-current="page">
                <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
                <span className="ev-crumb-name">{RW.title}</span>
              </li>
            </ol>
          </nav>
          <DemoBell tell={tell} />
        </div>
        <header className="gs-top">
          <div className="mn-head">
            <h1 className="gs-title">{RW.title}</h1>
            <p className="mn-sub">{HW.sub}</p>
          </div>
        </header>
        <StaffTabs on={HW.tab} eventId={event.id} tell={tell} />
        {!manage && (
          <p className="mn-lock">
            <Glyph name="lock" size={16} weight={2.2} />
            {HW.readOnly}
          </p>
        )}
        <p className="mn-said" role="status">
          {said !== '' && (
            <>
              <Glyph name="tick" size={17} weight={2.6} />
              {said}
            </>
          )}
        </p>
        {body}
      </div>
    </div>
  );
}

function Summary({ rows, live }: { rows: readonly HoursRow[]; live: boolean }) {
  if (live) {
    const on = rows.filter((one) => liveOf(one) === 'in').length;

    return (
      <section className="hw-summary" aria-label={HW.worked}>
        <p className="hw-eyebrow">{HW.liveAt(clock(LIVE_NOW))}</p>
        <p className="hw-figure">{HW.liveHead(on, rows.length)}</p>
      </section>
    );
  }
  const sum = summaryOf(rows);
  const rest = summaryRest(sum);

  return (
    <section className="hw-summary" aria-label={HW.worked}>
      <p className="hw-eyebrow">{HW.worked}</p>
      <p className="hw-figure">{HW.of(hoursWords(sum.worked), hoursWords(sum.scheduled))}</p>
      {rest != null && <p className="hw-rest">{rest}</p>}
    </section>
  );
}

function LiveMark({ row }: { row: HoursRow }) {
  const state = liveOf(row);
  if (state === 'in')
    return (
      <span className="hw-mark">
        <span className="hw-shape is-in" aria-hidden="true">
          <Glyph name="tick" size={11} weight={3.2} />
        </span>
        {HW.clockedIn}
      </span>
    );
  if (state === 'out')
    return (
      <span className="hw-mark">
        <span className="hw-shape is-none" aria-hidden="true" />
        {HW.clockedOut}
      </span>
    );

  return (
    <span className="hw-mark">
      <span className="hw-shape is-not-yet" aria-hidden="true" />
      {state === 'later' ? HW.opensAt(clock(opensAt(row.shift))) : HW.notYet}
    </span>
  );
}

function Trail({ row }: { row: HoursRow }) {
  return trailWords(row).map((line) => (
    <span key={line} className="hw-sub">
      {line}
    </span>
  ));
}

function AfterMark({ row }: { row: HoursRow }) {
  const words = markWords(row);
  if (words == null) return null;
  const notOut = row.times.clockIn != null;

  return (
    <span className={notOut ? 'hw-mark is-attention' : 'hw-mark'}>
      <span className={notOut ? 'hw-shape is-out' : 'hw-shape is-none'} aria-hidden="true" />
      {words}
    </span>
  );
}

function HoursTable({
  rows,
  live,
  manage,
  lit,
  onCorrect,
}: {
  rows: readonly HoursRow[];
  live: boolean;
  manage: boolean;
  lit: string | null;
  onCorrect: (row: HoursRow) => void;
}) {
  return (
    <section className="sn-card hw-card" aria-label={HW.tableLabel}>
      <table className="hw-table">
        <thead>
          <tr>
            <th scope="col">{HW.person}</th>
            <th scope="col">{HW.scheduled}</th>
            <th scope="col">{HW.clocked}</th>
            <th scope="col" className="hw-num">
              {HW.hours}
            </th>
            {manage && (
              <th scope="col">
                <span className="visually-hidden">{HW.correct}</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const worked = workedOf(row.shift, row.times);

            return (
              <tr key={row.key} className={lit === row.key ? 'is-lit' : undefined}>
                <th scope="row">
                  <span className="hw-name">{row.name}</span>
                  {row.removed && (
                    <span className="hw-mark hw-removed">
                      <Glyph name="user" size={14} weight={2.4} />
                      {HW.removed}
                    </span>
                  )}
                  <span className="hw-sub">{row.job}</span>
                </th>
                <td>
                  <span className="hw-time">{HW.range(row.shift.start, row.shift.end)}</span>
                  <span className="hw-sub">{hoursWords(row.shift.end - row.shift.start)}</span>
                </td>
                <td>
                  {live ? (
                    <>
                      <LiveMark row={row} />
                      {row.times.clockIn != null && (
                        <span className="hw-sub">{clockedWords(row)}</span>
                      )}
                      <Trail row={row} />
                    </>
                  ) : (
                    <>
                      <span className="hw-time">{clockedWords(row)}</span>
                      <Trail row={row} />
                      <AfterMark row={row} />
                    </>
                  )}
                </td>
                <td className="hw-num">{live ? '' : hoursWords(worked.minutes)}</td>
                {manage && (
                  <td className="hw-act">
                    <button
                      id={`hw-correct-${row.key}`}
                      type="button"
                      className="desk-text"
                      aria-label={HW.correctOf(row.name)}
                      onClick={() => onCorrect(row)}
                    >
                      {HW.correct}
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function CorrectPanel({
  row,
  draft,
  pressed,
  stillOn,
  onDraft,
  onSave,
  onCancel,
}: {
  row: HoursRow;
  draft: TimesDraft;
  pressed: boolean;
  stillOn: boolean;
  onDraft: (draft: TimesDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const problems = pressed ? timesProblems(draft, stillOn) : {};
  const { times, shift } = row;
  const inBeside = times.clockIn == null ? HW.notRecorded : HW.recorded(clock(times.clockIn));
  const outBeside =
    times.clockOut != null
      ? HW.recorded(clock(times.clockOut))
      : stillOn
        ? HW.notRecorded
        : HW.notRecordedOut(clock(shift.end));

  return (
    <>
      <PanelTop
        title={HW.correctTitle(row.name)}
        eyebrow={HW.correctSub(row.job, HW.range(shift.start, shift.end))}
        onClose={onCancel}
      />
      <div className="mn-panel-body">
        <div className="hw-when">
          <p className="hw-beside">{inBeside}</p>
          <When
            legend={HW.clockIn}
            id="hw-f-in"
            date={draft.inDate}
            time={draft.inTime}
            wrong={problems.in}
            step={60}
            onDate={(value) => onDraft({ ...draft, inDate: value })}
            onTime={(value) => onDraft({ ...draft, inTime: value })}
          />
        </div>
        <div className="hw-when">
          <p className="hw-beside">{outBeside}</p>
          <When
            legend={HW.clockOut}
            id="hw-f-out"
            date={draft.outDate}
            time={draft.outTime}
            wrong={problems.out}
            step={60}
            onDate={(value) => onDraft({ ...draft, outDate: value })}
            onTime={(value) => onDraft({ ...draft, outTime: value })}
          />
        </div>
        <p className="desk-help">{HW.keepsOriginal}</p>
      </div>
      <PanelFoot cta={HW.save} cancel={HW.cancel} onSave={onSave} onCancel={onCancel} />
    </>
  );
}
