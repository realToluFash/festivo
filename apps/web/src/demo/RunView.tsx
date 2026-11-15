import { useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import { DemoBell } from './DemoBell.tsx';
import { EventsShell } from './EventParts.tsx';
import { EventSidebar } from './EventSidebar.tsx';
import { sampleEvent } from './events.ts';
import { clockOfKitchen } from './kitchen.ts';
import { keptInbox, waitingLine } from './messages.ts';
import {
  type Figure,
  type Row,
  type Run,
  type TrackView,
  RUN_EVENT,
  RW,
  figureSaid,
  figureWords,
  finishItem,
  later,
  nextLine,
  runAt,
  startItem,
  trackView,
} from './runView.ts';
import { RW as SCHEDULE_WORDS, scheduleAt } from './schedule.ts';
import { useSwitcherStart } from './switcher.ts';
import './guests.css';
import './menu.css';
import './runView.css';

/** /demo/events/evt-wed-4/run (sc-1404): the run view at 1280 × 800, one table per track, by ?state=. */
export function RunViewPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const raw = params.get('state');
  const manage = params.get('as') !== 'reader';
  useSwitcherStart();

  return <RunViewAt key={`${id ?? ''}|${raw ?? ''}|${manage}`} id={id} raw={raw} manage={manage} />;
}

function RunViewAt({
  id,
  raw,
  manage,
}: {
  id: string | undefined;
  raw: string | null;
  manage: boolean;
}) {
  const [event] = useState(() => sampleEvent(id));
  const [first] = useState(() => runAt(raw));

  if (event == null) return <Navigate to="/demo/events" replace />;
  if (event.id !== RUN_EVENT)
    return <Navigate to={`/demo/events/${event.id}?area=schedule`} replace />;

  return (
    <EventsShell
      renderSide={(tell, covered) => (
        <EventSidebar
          event={event}
          area="schedule"
          now={clockOfKitchen()}
          tell={tell}
          inert={covered}
          waiting={waitingLine(keptInbox())}
        />
      )}
    >
      {(tell) => (
        <RunViewBody
          first={first}
          eventId={event.id}
          name={event.name}
          manage={manage}
          tell={tell}
        />
      )}
    </EventsShell>
  );
}

function RunViewBody({
  first,
  eventId,
  name,
  manage,
  tell,
}: {
  first: Run;
  eventId: string;
  name: string;
  manage: boolean;
  tell: (words: string) => void;
}) {
  const [run, setRun] = useState(first);
  const views = run.tracks.map((track) => trackView(track, run.clock));

  return (
    <div className="desk-page ev-page gs mn rv">
      <div className="ev-wide mn-page">
        <div className="ev-crumb-row">
          <nav className="ev-crumb" aria-label="Breadcrumb">
            <ol>
              <li className="ev-crumb-part">
                <Link to="/demo/events">Events</Link>
              </li>
              <li className="ev-crumb-part">
                <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
                <Link className="ev-crumb-name" to={`/demo/events/${eventId}`}>
                  {name}
                </Link>
              </li>
              <li className="ev-crumb-part">
                <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
                <Link className="ev-crumb-name" to={scheduleAt(manage ? undefined : 'readOnly')}>
                  {SCHEDULE_WORDS.title}
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
        <header className="gs-top rv-top">
          <div className="mn-head">
            <h1 className="gs-title">{RW.title}</h1>
            <p className="mn-sub">{RW.sub}</p>
          </div>
          <p className="rv-clock">
            <Glyph name="clock" size={16} weight={2.2} />
            <span>
              Now <span className="num">{run.clock}</span> at the venue
            </span>
          </p>
        </header>
        {!manage && (
          <p className="mn-lock">
            <Glyph name="lock" size={16} weight={2.2} />
            {RW.lock}
          </p>
        )}
        <div className="rv-demo-only">
          <p>{RW.demoOnly}</p>
          <button type="button" className="rv-act" onClick={() => setRun(later(run, 5))}>
            {RW.later}
          </button>
        </div>
        {views.map((view) => (
          <TrackTable
            key={view.track.id}
            view={view}
            manage={manage}
            onStart={(itemId) => setRun(startItem(run, view.track.id, itemId))}
            onFinish={(itemId) => setRun(finishItem(run, view.track.id, itemId))}
          />
        ))}
      </div>
    </div>
  );
}

export function FigureMark({ figure, name }: { figure: Figure; name: string }) {
  return (
    <p
      className={`rv-figure is-${figure.kind === 'onTime' ? 'on-time' : figure.kind}`}
      role="status"
    >
      <span className="visually-hidden">{figureSaid(name, figure)}</span>
      {figure.kind !== 'done' && (
        <span className="rv-figure-shown" aria-hidden="true">
          <Glyph
            name={figure.kind === 'behind' ? 'clock' : figure.kind === 'last' ? 'arrow' : 'tick'}
            size={14}
            weight={2.6}
          />
          <span className="num">{figureWords(figure)}</span>
        </span>
      )}
    </p>
  );
}

function TrackTable({
  view,
  manage,
  onStart,
  onFinish,
}: {
  view: TrackView;
  manage: boolean;
  onStart: (id: string) => void;
  onFinish: (id: string) => void;
}) {
  const headingId = `rv-track-${view.track.id}`;

  return (
    <section className="rv-track" aria-labelledby={headingId}>
      <div className="rv-track-top">
        <h2 id={headingId}>{view.track.name}</h2>
        <FigureMark figure={view.figure} name={view.track.name} />
      </div>
      {view.collisions.map((words) => (
        <p key={words} className="rv-collision">
          <Glyph name="warn" size={16} weight={2.4} />
          <span>{words}</span>
        </p>
      ))}
      <table className="rv-table" aria-labelledby={headingId}>
        <thead>
          <tr>
            {(manage ? RW.columns : RW.columns.filter((column) => column !== '')).map(
              (column, index) => (
                <th key={column || index} scope="col" className={column === '' ? 'rv-act-col' : ''}>
                  {column === '' ? <span className="visually-hidden">Mark</span> : column}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {view.rows.map((row) => (
            <RunRow
              key={row.item.id}
              row={row}
              manage={manage}
              onStart={onStart}
              onFinish={onFinish}
            />
          ))}
        </tbody>
      </table>
      <p className="rv-next">{nextLine(view, manage)}</p>
    </section>
  );
}

function RunRow({
  row,
  manage,
  onStart,
  onFinish,
}: {
  row: Row;
  manage: boolean;
  onStart: (id: string) => void;
  onFinish: (id: string) => void;
}) {
  const { item, second } = row;

  return (
    <tr className={`rv-row is-${item.phase}`}>
      <td className="rv-starts">
        <span className="num">{item.planned}</span>
        {second != null && (
          <span className={`rv-second is-${second.kind} num`}>
            {second.kind === 'expected' ? 'about' : 'started'} {second.time}
          </span>
        )}
      </td>
      <td className={item.length == null ? 'rv-lasts is-none' : 'rv-lasts num'}>{row.lasts}</td>
      <th scope="row" className="rv-item">
        <span className="rv-item-line">
          <span className="rv-title">{item.title}</span>
          {item.phase !== 'waiting' && <PhaseTag phase={item.phase} />}
          {item.fixed && (
            <span className="rv-fixed">
              <Glyph name="lock" size={12} weight={2.4} />
              {RW.fixed}
            </span>
          )}
        </span>
        {row.before != null && <span className="rv-before">{row.before}</span>}
      </th>
      <td className={item.owner == null ? 'rv-owner is-none' : 'rv-owner'}>
        {item.owner ?? RW.noOwner}
      </td>
      {manage && (
        <td className="rv-act-col">
          {item.phase === 'waiting' ? (
            <button
              type="button"
              className="rv-act"
              aria-label={`${RW.start} ${item.title}`}
              onClick={() => onStart(item.id)}
            >
              {RW.start}
            </button>
          ) : item.phase === 'now' ? (
            <button
              type="button"
              className="rv-act is-primary"
              aria-label={`${RW.finish} ${item.title}`}
              onClick={() => onFinish(item.id)}
            >
              {RW.finish}
            </button>
          ) : null}
        </td>
      )}
    </tr>
  );
}

function PhaseTag({ phase }: { phase: 'now' | 'done' }) {
  return (
    <span className={`rv-phase is-${phase}`}>
      <Glyph name={phase === 'done' ? 'tick' : 'arrow'} size={12} weight={2.6} />
      {phase === 'done' ? RW.done : RW.now}
    </span>
  );
}
