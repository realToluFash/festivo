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
  type LaterRow,
  type Night,
  type NightStart,
  type TrackView,
  NIGHT_EVENT,
  NW,
  dismiss,
  headerWords,
  nextSaid,
  nightAt,
  pickerTracks,
  pressDone,
  pressSkip,
  pressStart,
  queuedWords,
  timeIn,
  trackView,
  tryNow,
} from './night.ts';
import { scheduleAt } from './schedule.ts';
import { useSwitcherStart } from './switcher.ts';
import './guests.css';
import './menu.css';
import './runView.css';
import './night.css';

export function NightPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const raw = params.get('state');
  const tracks = params.get('tracks');
  const as = params.get('as') ?? undefined;
  const locale = params.get('locale') ?? 'en-US';
  useSwitcherStart();

  return (
    <NightAt
      key={`${id ?? ''}|${raw ?? ''}|${tracks ?? ''}|${as ?? ''}|${locale}`}
      id={id}
      first={nightAt(raw, { oneTrack: tracks === 'one', as })}
      locale={locale}
    />
  );
}

function NightAt({
  id,
  first,
  locale,
}: {
  id: string | undefined;
  first: NightStart;
  locale: string;
}) {
  const [event] = useState(() => sampleEvent(id));

  if (event == null) return <Navigate to="/demo/events" replace />;
  if (event.id !== NIGHT_EVENT)
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
        <NightBody first={first} eventId={event.id} name={event.name} locale={locale} tell={tell} />
      )}
    </EventsShell>
  );
}

interface Acts {
  done: (item: string) => void;
  skip: (item: string) => void;
  start: (item: string) => void;
  choose: (item: string) => void;
}

function NightBody({
  first,
  eventId,
  name,
  locale,
  tell,
}: {
  first: NightStart;
  eventId: string;
  name: string;
  locale: string;
  tell: (words: string) => void;
}) {
  const [night, setNight] = useState<Night>(first.night);
  const [trackId, setTrackId] = useState(first.trackId);
  const [chosen, setChosen] = useState<string | null>(first.chosen);
  const [moving, setMoving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(first.menuOpen);
  const [rows] = useState(() => new Map<string, HTMLButtonElement>());
  const tracks = pickerTracks(night);
  const track = tracks.find((one) => one.id === trackId) ?? tracks[0];
  const view = track == null ? null : trackView(night, track, locale);
  const chosenRow = view?.later.find((row) => row.item.id === chosen) ?? null;
  const id = track?.id ?? '';

  const press = (next: Night) => {
    setNight(next);
    setChosen(null);
    setMoving(false);
  };
  const close = () => {
    const row = chosen == null ? undefined : rows.get(chosen);
    setChosen(null);
    setMoving(false);
    row?.focus();
  };
  const acts: Acts = {
    done: (item) => press(pressDone(night, id, item)),
    skip: (item) => press(pressSkip(night, id, item)),
    start: (item) => press(pressStart(night, id, item)),
    choose: (item) => {
      setChosen(item);
      setMoving(false);
    },
  };

  return (
    <div className="desk-page ev-page gs mn rv nt">
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
              <li className="ev-crumb-part" aria-current="page">
                <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
                <span className="ev-crumb-name">{NW.title}</span>
              </li>
            </ol>
          </nav>
          <nav className="nt-switch" aria-label="Schedule or run of show">
            <Link to={scheduleAt()}>{NW.schedule}</Link>
            <span aria-current="page">{NW.title}</span>
          </nav>
          <DemoBell tell={tell} />
        </div>
        <Head
          night={night}
          view={view}
          locale={locale}
          many={tracks.length > 1}
          menuOpen={menuOpen}
          onMenu={() => setMenuOpen(!menuOpen)}
        />
        {menuOpen && view != null && tracks.length > 1 && (
          <ul className="nt-menu" aria-label="Tracks">
            {tracks.map((one) => {
              const on = one.id === view.track.id;

              return (
                <li key={one.id}>
                  <button
                    type="button"
                    className="nt-menu-row"
                    aria-pressed={on}
                    onClick={() => {
                      setTrackId(one.id);
                      setMenuOpen(false);
                      setChosen(null);
                    }}
                  >
                    <span>{trackView(night, one, locale).label}</span>
                    {on && <Glyph name="tick" size={16} weight={2.6} />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <Strip night={night} onTry={() => setNight(tryNow(night))} />
        {!night.manage && (
          <p className="nt-view-only">
            <span className="nt-pill">
              <Glyph name="eye" size={14} weight={2.4} />
              {NW.viewOnly}
            </span>
            <span>{NW.viewOnlyLine}</span>
          </p>
        )}
        {night.lost != null && (
          <div className="nt-alert" role="alert">
            <p className="nt-alert-words">
              <strong>{night.lost.title}</strong>
              <span>{`Already started by ${night.lost.by} at ${timeIn(locale, night.lost.at)}.`}</span>
            </p>
            <button type="button" className="rv-act" onClick={() => setNight(dismiss(night))}>
              {NW.dismiss}
            </button>
          </div>
        )}
        <div className="nt-split">
          <div className="nt-cards">
            <Cards
              first={first}
              night={night}
              view={view}
              locale={locale}
              chosen={chosen}
              acts={acts}
              rows={rows}
            />
          </div>
          {chosenRow != null && (
            <aside className="nt-panel" aria-label={chosenRow.item.title}>
              <Chosen
                row={chosenRow}
                busy={view?.now != null}
                manage={night.manage}
                moving={moving}
                onMove={setMoving}
                onClose={close}
                acts={acts}
              />
            </aside>
          )}
        </div>
        <div className="visually-hidden" aria-live="polite">
          {night.said}
        </div>
        <div className="rv-demo-only nt-demo-only">
          <p>{NW.demoOnly}</p>
          <p>{`${NW.readOutNote}: ${night.said === '' ? 'nothing yet' : night.said}`}</p>
          {night.online && (
            <button
              type="button"
              className="rv-act"
              onClick={() => setNight({ ...night, online: false, age: 1 })}
            >
              Lose the connection
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Head({
  night,
  view,
  locale,
  many,
  menuOpen,
  onMenu,
}: {
  night: Night;
  view: TrackView | null;
  locale: string;
  many: boolean;
  menuOpen: boolean;
  onMenu: () => void;
}) {
  const words = view == null ? null : headerWords(view.header);

  return (
    <header className="gs-top nt-top">
      <div className="mn-head">
        <h1 className="gs-title">{NW.title}</h1>
        {view != null && (
          <div className="nt-head-line">
            {many ? (
              <button
                type="button"
                className="nt-picker"
                aria-expanded={menuOpen}
                aria-label={`Track: ${view.label}`}
                onClick={onMenu}
              >
                <span>{view.label}</span>
                <Glyph name="chevdown" size={16} weight={2.4} />
              </button>
            ) : (
              <span className="nt-place">{view.label}</span>
            )}
            <span className="nt-sub num">{view.sub}</span>
          </div>
        )}
      </div>
      <div className="nt-head-end">
        <p className="rv-clock">
          <Glyph name="clock" size={16} weight={2.2} />
          <span className="num">{timeIn(locale, night.clock)}</span>
        </p>
        {words != null && view != null && (
          <p className={`nt-figure is-${view.header.kind}`}>
            <span className="nt-figure-mark" aria-hidden="true" />
            <span className="num">{words}</span>
          </p>
        )}
      </div>
    </header>
  );
}

function Strip({ night, onTry }: { night: Night; onTry: () => void }) {
  if (night.online)
    return (
      <p className="nt-strip">
        <span className="nt-dot" aria-hidden="true" />
        {NW.live}
      </p>
    );

  return (
    <div className="nt-strip is-off">
      <span className="nt-ring" aria-hidden="true" />
      <p className="nt-strip-words">
        <strong>{`Reconnecting · ${night.age} min old`}</strong>
        {night.queued > 0 && <span>{queuedWords(night.queued)}</span>}
      </p>
      <button type="button" className="rv-act" onClick={onTry}>
        {NW.tryNow}
      </button>
    </div>
  );
}

function Cards({
  first,
  night,
  view,
  locale,
  chosen,
  acts,
  rows,
}: {
  first: NightStart;
  night: Night;
  view: TrackView | null;
  locale: string;
  chosen: string | null;
  acts: Acts;
  rows: Map<string, HTMLButtonElement>;
}) {
  if (first.loading)
    return (
      <div className="nt-grid" role="progressbar" aria-label={NW.loading}>
        <div className="nt-column">
          <div className="nt-card is-dark nt-bones is-tall" />
          <div className="nt-card nt-bones" />
        </div>
        <div className="nt-card nt-bones is-tall" />
      </div>
    );
  if (view == null)
    return (
      <section className="nt-card nt-empty">
        <Glyph name="day" size={24} weight={2.2} />
        <h2>{NW.nothingToday}</h2>
        <Link className="nt-link" to={scheduleAt()}>
          {NW.openSchedule}
        </Link>
      </section>
    );
  if (view.finished != null)
    return (
      <section className="nt-card nt-end">
        <span className="nt-end-tick" aria-hidden="true">
          <Glyph name="tick" size={22} weight={2.6} />
        </span>
        <h2>{NW.everything}</h2>
        <p className="nt-end-sentence">{view.finished.sentence}</p>
        <p className="nt-muted">{view.finished.workedOut}</p>
        {view.finished.endNow && (
          <Link className="nt-link" to="/demo/events">
            {NW.endNow}
          </Link>
        )}
      </section>
    );

  return (
    <div className="nt-grid">
      <div className="nt-column">
        <NowCard view={view} locale={locale} manage={night.manage} acts={acts} />
        <NextCard view={view} manage={night.manage} acts={acts} />
      </div>
      <section className="nt-card" aria-labelledby="nt-later">
        <div>
          <h2 id="nt-later" className="nt-label">
            {NW.later}
          </h2>
          <p className="nt-muted">{NW.laterNote}</p>
        </div>
        {view.later.length === 0 ? (
          <p className="nt-muted">{NW.nothingElse(view.track.place)}</p>
        ) : (
          <ul className="nt-later">
            {view.later.map((row) => (
              <li key={row.item.id}>
                <LaterLine
                  row={row}
                  on={row.item.id === chosen}
                  choosable={night.manage && row.mark === 'notStarted'}
                  onChoose={() => acts.choose(row.item.id)}
                  rows={rows}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function NowCard({
  view,
  locale,
  manage,
  acts,
}: {
  view: TrackView;
  locale: string;
  manage: boolean;
  acts: Acts;
}) {
  const { now, elapsed } = view;

  if (now == null || elapsed == null)
    return (
      <section className="nt-card is-dark" aria-label={NW.now}>
        <p className="nt-label">{NW.now}</p>
        <h2 className="nt-now-title">{NW.nothingOn}</h2>
        {view.lastFinished != null && <p className="nt-on-dark-muted">{view.lastFinished}</p>}
      </section>
    );

  return (
    <section className="nt-card is-dark" aria-label={NW.now}>
      <p className="nt-label">{`${NW.now} · since ${timeIn(locale, now.started ?? now.planned)}`}</p>
      <h2 className="nt-now-title">{now.title}</h2>
      <p className="nt-on-dark-muted">{`${now.owner ?? NW.noOwner} · ${view.label}`}</p>
      {view.nowBefore != null && <p className="nt-on-dark-muted">{view.nowBefore}</p>}
      <p className={elapsed.over ? 'nt-elapsed is-over' : 'nt-elapsed'}>
        <span className={elapsed.over ? 'nt-ring' : ''} aria-hidden="true">
          {!elapsed.over && <Glyph name="clock" size={18} weight={2.4} />}
        </span>
        <span className="num">{elapsed.words}</span>
      </p>
      {now.length == null ? (
        <p className="nt-on-dark-muted">{NW.noLength}</p>
      ) : (
        <div className="nt-lasts">
          <span className="nt-on-dark-muted">{`Lasts ${now.length} min`}</span>
          <progress className="nt-bar" max={1} value={elapsed.share ?? 0} aria-hidden="true" />
        </div>
      )}
      {manage && (
        <div className="nt-pair">
          <button
            type="button"
            className="nt-big is-filled is-wide"
            aria-label={`${NW.done}: ${now.title}`}
            onClick={() => acts.done(now.id)}
          >
            {NW.done}
          </button>
          <button
            type="button"
            className="nt-big is-on-dark"
            aria-label={`${NW.skip}: ${now.title}`}
            onClick={() => acts.skip(now.id)}
          >
            {NW.skip}
          </button>
        </div>
      )}
    </section>
  );
}

function NextCard({ view, manage, acts }: { view: TrackView; manage: boolean; acts: Acts }) {
  const { next } = view;

  return (
    <section className="nt-card" aria-label={NW.next}>
      <p className="nt-label">{NW.next}</p>
      {next == null ? (
        <p className="nt-muted">{NW.nothingElse(view.track.place)}</p>
      ) : (
        <>
          <p className="nt-time num">
            <span className="visually-hidden">{nextSaid(next)}</span>
            <span aria-hidden="true">{next.planned}</span>
            {next.expected != null && (
              <span className="nt-about" aria-hidden="true">
                <Glyph name="arrow" size={16} weight={2.4} />
                {`about ${next.expected}`}
              </span>
            )}
          </p>
          <h2 className="nt-next-title">{next.item.title}</h2>
          <p className="nt-muted">
            {`${next.item.owner ?? NW.noOwner} · ${next.item.length == null ? NW.noLength : `Lasts ${next.item.length} min`}`}
          </p>
          {manage &&
            (view.now == null ? (
              <button
                type="button"
                className="nt-big is-filled"
                aria-label={`${NW.startNow}: ${next.item.title}`}
                onClick={() => acts.start(next.item.id)}
              >
                {NW.startNow}
              </button>
            ) : (
              <FinishFirst />
            ))}
        </>
      )}
    </section>
  );
}

function FinishFirst() {
  return (
    <p className="nt-inset">
      <span className="nt-pause" aria-hidden="true" />
      {NW.finishFirst}
    </p>
  );
}

const MARK_WORD = { done: NW.done, skipped: NW.skipped, notStarted: NW.notStarted } as const;

function LaterLine({
  row,
  on,
  choosable,
  onChoose,
  rows,
}: {
  row: LaterRow;
  on: boolean;
  choosable: boolean;
  onChoose: () => void;
  rows: Map<string, HTMLButtonElement>;
}) {
  const inner = (
    <>
      <span className={`nt-mark is-${row.mark}`} aria-hidden="true">
        {row.mark === 'done' && <Glyph name="tick" size={12} weight={3} />}
      </span>
      <span className="nt-later-words">
        <span className={row.mark === 'skipped' ? 'nt-later-title is-struck' : 'nt-later-title'}>
          {row.item.title}
        </span>
        <span className="nt-muted num">
          {[MARK_WORD[row.mark], row.time].filter(Boolean).join(' · ')}
        </span>
      </span>
      {choosable && <Glyph name="chevron" size={16} weight={2.4} />}
    </>
  );

  return choosable ? (
    <button
      type="button"
      className={on ? 'nt-later-row is-on' : 'nt-later-row'}
      aria-expanded={on}
      onClick={onChoose}
      ref={(node) => {
        if (node == null) rows.delete(row.item.id);
        else rows.set(row.item.id, node);
      }}
    >
      {inner}
    </button>
  ) : (
    <div className="nt-later-row">{inner}</div>
  );
}

function Chosen({
  row,
  busy,
  manage,
  moving,
  onMove,
  onClose,
  acts,
}: {
  row: LaterRow;
  busy: boolean;
  manage: boolean;
  moving: boolean;
  onMove: (moving: boolean) => void;
  onClose: () => void;
  acts: Acts;
}) {
  const { item } = row;
  const head = (title: string) => (
    <div className="nt-panel-head">
      <h2>{title}</h2>
      <button type="button" className="nt-close" aria-label="Close" onClick={onClose}>
        <Glyph name="clear" size={20} weight={2.4} />
      </button>
    </div>
  );

  if (moving)
    return (
      <>
        {head(`${NW.move}: ${item.title}`)}
        <div className="rv-demo-only nt-demo-only">
          <p>{NW.moveStub}</p>
          <button type="button" className="nt-big" onClick={() => onMove(false)}>
            {NW.leaveIt}
          </button>
        </div>
      </>
    );

  return (
    <>
      {head(item.title)}
      <p className="nt-muted num">
        {`${row.time ?? ''} · ${item.owner ?? NW.noOwner} · ${item.length == null ? NW.noLength : `Lasts ${item.length} min`}`}
      </p>
      {manage &&
        (busy ? (
          <FinishFirst />
        ) : (
          <button
            type="button"
            className="nt-big is-filled"
            aria-label={`${NW.startNow}: ${item.title}`}
            onClick={() => acts.start(item.id)}
          >
            {NW.startNow}
          </button>
        ))}
      <button
        type="button"
        className="nt-big"
        aria-label={`${NW.skip}: ${item.title}`}
        onClick={() => acts.skip(item.id)}
      >
        {NW.skip}
      </button>
      <button
        type="button"
        className="nt-big"
        aria-label={`${NW.move}: ${item.title}`}
        onClick={() => onMove(true)}
      >
        {NW.move}
      </button>
    </>
  );
}
