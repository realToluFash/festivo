import { useEffect, useState } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router';

import type { Mark } from './guestProgramme.ts';
import {
  type ScreenAnswer,
  type ScreenPlace,
  SCREEN_WORDS as W,
  clockAt,
  placeOfRaw,
  roomScreen,
  screenItems,
  screenStart,
  screenTime,
} from './roomScreen.ts';
import './runView.css';
import './roomScreen.css';

const LOCALE = 'en-GB';

/** /demo/screen/:place (sc-3897): the room screen at any 16:9 or 4:3 size, by ?state=. */
export function RoomScreenPage() {
  const { place } = useParams();
  const [params] = useSearchParams();
  const raw = params.get('state');
  const where = placeOfRaw(place);

  if (where == null) return <Navigate to="/demo/screen/ballroom" replace />;

  return <RoomScreen key={`${where}|${raw ?? ''}`} place={where} raw={raw} />;
}

interface World {
  marks: Readonly<Record<string, Mark>>;
  moved: number;
  finished: boolean;
  replaced: boolean;
}

interface Shown {
  answer: ScreenAnswer;
  asOf: string;
}

function answerOf(world: World, place: ScreenPlace): ScreenAnswer {
  return roomScreen(
    {
      items: screenItems(),
      marks: world.marks,
      at: clockAt(world.moved),
      finished: world.finished,
      replaced: world.replaced,
    },
    place,
  );
}

function RoomScreen({ place, raw }: { place: ScreenPlace; raw: string | null }) {
  const first = screenStart(raw);
  const [world, setWorld] = useState<World>({
    marks: first.marks,
    moved: first.moved,
    finished: first.finished,
    replaced: first.replaced,
  });
  const [held, setHeld] = useState<Shown | null>(() =>
    first.offline ? { answer: answerOf(world, place), asOf: clockAt(world.moved) } : null,
  );
  const online = held == null;
  const shown = held ?? { answer: answerOf(world, place), asOf: clockAt(world.moved) };

  const clock = clockAt(world.moved);
  const live = answerOf(world, place);
  const running = live.kind === 'live' ? live.now : null;
  const next = live.kind === 'live' ? (live.coming[0] ?? null) : null;

  const press = (id: string, mark: Mark) =>
    setWorld({ ...world, marks: { ...world.marks, [id]: mark } });

  return (
    <main className={first.projector ? 'rs-room is-projector' : 'rs-room'}>
      <div className="rs-stage">
        <div className="rs-fill" data-testid="room-screen">
          <Screen shown={shown} offline={!online} />
          {shown.answer.kind !== 'replaced' && <FullScreen />}
        </div>
      </div>
      <details className="rv-demo-only rs-demo">
        <summary>Demo only: what the night does</summary>
        <p>{`The clock reads ${screenTime(clock, LOCALE)}. The screen updates at once here; the product within 10 seconds of a press, and within 60 when an item overruns.`}</p>
        <div className="rs-demo-acts">
          {running != null && (
            <button
              type="button"
              className="rv-act"
              onClick={() =>
                press(running.id, {
                  started: world.marks[running.id]?.started ?? clock,
                  ended: clock,
                })
              }
            >
              {`Done on ${running.title}`}
            </button>
          )}
          {running == null && next != null && (
            <button
              type="button"
              className="rv-act"
              onClick={() => press(next.id, { started: clock })}
            >
              {`Start ${next.title}`}
            </button>
          )}
          <button
            type="button"
            className="rv-act"
            onClick={() => setWorld({ ...world, moved: world.moved + 5 })}
          >
            Move the clock on 5 min
          </button>
          <button
            type="button"
            className="rv-act"
            onClick={() => setHeld(online ? { answer: live, asOf: clock } : null)}
          >
            {online ? 'Lose the connection' : 'Reconnect'}
          </button>
          {!world.replaced && (
            <button
              type="button"
              className="rv-act"
              onClick={() => setWorld({ ...world, replaced: true })}
            >
              Replace this link on the Schedule
            </button>
          )}
          {!world.finished && (
            <button
              type="button"
              className="rv-act"
              onClick={() => setWorld({ ...world, finished: true })}
            >
              Finish the event
            </button>
          )}
        </div>
      </details>
    </main>
  );
}

function Screen({ shown, offline }: { shown: Shown; offline: boolean }) {
  const { answer } = shown;

  if (answer.kind === 'replaced')
    return (
      <div className="rs-centre">
        <p className="rs-said">{W.replaced}</p>
      </div>
    );
  if (answer.kind === 'finished')
    return (
      <div className="rs-centre">
        <h1 className="rs-big">{W.thanks}</h1>
        <p className="rs-name">{answer.event}</p>
      </div>
    );
  if (answer.kind === 'nothingLeft')
    return (
      <div className="rs-centre">
        <h1 className="rs-big">{answer.event}</h1>
        {offline && <AsOf time={shown.asOf} />}
      </div>
    );

  return (
    <>
      <h1 className="rs-name rs-event">{answer.event}</h1>
      <div className={answer.now == null ? 'rs-body is-between' : 'rs-body'}>
        {answer.now != null && (
          <section className="rs-now" aria-labelledby="rs-now-h">
            <h2 id="rs-now-h" className="rs-label">
              {W.now}
            </h2>
            <p key={answer.now.id} className="rs-big rs-change">
              {answer.now.title}
            </p>
          </section>
        )}
        {answer.coming.length > 0 && (
          <section className="rs-coming" aria-labelledby="rs-coming-h">
            <h2 id="rs-coming-h" className="rs-label">
              {W.comingUp}
            </h2>
            <ol className="rs-list">
              {answer.coming.map((one) => (
                <li key={one.id} className="rs-item rs-change">
                  <time className="rs-time" dateTime={one.startsAt}>
                    {screenTime(one.startsAt, LOCALE)}
                  </time>
                  <span className="rs-title" dir="auto">
                    {one.title}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
      {offline && <AsOf time={shown.asOf} />}
    </>
  );
}

function AsOf({ time }: { time: string }) {
  return (
    <p className="rs-asof" role="status">
      <span className="rs-dot" aria-hidden="true" />
      {W.asOf(screenTime(time, LOCALE))}
    </p>
  );
}

/** Browsers allow full screen only on a press (Fullscreen API), so it is a button, gone once full. */
function FullScreen() {
  const [full, setFull] = useState(() => document.fullscreenElement != null);

  useEffect(() => {
    const changed = () => setFull(document.fullscreenElement != null);

    document.addEventListener('fullscreenchange', changed);

    return () => document.removeEventListener('fullscreenchange', changed);
  }, []);

  if (full) return null;

  return (
    <button
      type="button"
      className="rs-full"
      onClick={() => void document.documentElement.requestFullscreen?.().catch(() => undefined)}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="rs-full-icon">
        <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
      </svg>
      {W.fullScreen}
    </button>
  );
}
