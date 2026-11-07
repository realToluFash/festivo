import { Glyph } from '../components/Glyph.tsx';
import type { Moment, Now } from './today.ts';
import type { Tell } from '../components/SettingsParts.tsx';

/** Confetti cut from the mark's half disc and bar, placed from the banner's right edge in today.css. */
const PIECES = ['half', 'bar', 'half', 'bar', 'half', 'bar'] as const;

function Actions({ create, tell }: { create: boolean; tell: Tell }) {
  return (
    <div className="today-actions">
      {create && (
        <button
          type="button"
          className="today-glass"
          onClick={() => tell('Create an event has its own design.')}
        >
          <Glyph name="plus" size={18} />
          New event
        </button>
      )}
      <button
        type="button"
        className="today-glass today-bell"
        aria-label="Notifications, 3 unread"
        onClick={() => tell('Notifications have their own design.')}
      >
        <Glyph name="bell" size={19} />
        <span className="today-unread" aria-hidden="true" />
      </button>
    </div>
  );
}

/** Soirely's Confetti as a 112 px banner: the date, the greeting and one line, with New event and the bell. */
export function Banner({ moment, tell }: { moment: Moment; tell: Tell }) {
  return (
    <header className="today-banner">
      {PIECES.map((shape, index) => (
        <span key={index} className={`today-piece is-${shape} p${index + 1}`} aria-hidden="true" />
      ))}
      <div className="today-banner-inner">
        <div className="today-greeting">
          <p className="today-eyebrow">{moment.eyebrow}</p>
          <h1>{moment.hello}</h1>
          <p className="today-sub">
            {moment.lead != null && <strong>{`${moment.lead} `}</strong>}
            {moment.sub}
          </p>
        </div>
        <Actions create={moment.kind !== 'first'} tell={tell} />
      </div>
    </header>
  );
}

function Rail({ now }: { now: Now }) {
  const last = now.rail.length - 1;
  const at = `${now.at * 100}%`;

  return (
    <div
      className="today-rail"
      role="img"
      aria-label={now.rail.map((stop) => `${stop.time} ${stop.name}`).join(', ')}
    >
      <svg className="today-rail-line" width="100%" height="16" overflow="visible">
        <rect className="today-rail-track" y="7" width="100%" height="2" rx="1" />
        <rect className="today-rail-done" y="7" width={at} height="2" rx="1" />
        {now.rail.map((stop, index) =>
          stop.state === 'now' ? null : (
            <circle
              key={stop.time}
              className={stop.state === 'done' ? 'today-node is-done' : 'today-node'}
              cx={`${(index / last) * 100}%`}
              cy="8"
              r="3.75"
            />
          ),
        )}
        <circle className="today-now-glow" cx={at} cy="8" r="13" />
        <circle className="today-now-node" cx={at} cy="8" r="8" />
      </svg>
      <div className="today-rail-labels">
        {now.rail.map((stop) => (
          <span
            key={stop.time}
            className={
              stop.state === 'now' || stop.state === 'next'
                ? 'today-rail-label is-near'
                : 'today-rail-label'
            }
          >
            <span>{stop.time}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Ring({ share }: { share: number }) {
  const side = 40;
  const line = 4;
  const r = (side - line) / 2;
  const round = 2 * Math.PI * r;

  return (
    <svg className="today-ring" width={side} height={side} aria-hidden="true">
      <circle className="today-ring-track" cx={side / 2} cy={side / 2} r={r} strokeWidth={line} />
      <circle
        className="today-ring-done"
        cx={side / 2}
        cy={side / 2}
        r={r}
        strokeWidth={line}
        strokeDasharray={`${round * share} ${round}`}
      />
    </svg>
  );
}

/** On the day, the banner is Now in the event's colours; built now, it shows the dates and opens the event. */
export function NowBanner({ now, full, tell }: { now: Now; full: boolean; tell: Tell }) {
  const top = (
    <div className="today-now-top">
      <div className="today-now-chips">
        <span className="today-chip is-light">
          <span className="today-live-dot is-ringed" aria-hidden="true" />
          Live now
        </span>
        <span className="today-chip is-dark">{now.live}</span>
      </div>
      <Actions create tell={tell} />
    </div>
  );

  if (!full)
    return (
      <header className={`today-now today-cover is-${now.event} is-built`}>
        <span className="today-now-shade" aria-hidden="true" />
        {top}
        <div className="today-now-mid">
          <div className="today-now-words">
            <h1 className="today-now-name">{now.name}</h1>
            <p className="today-now-until">{now.ends}</p>
          </div>
          <button
            type="button"
            className="today-white"
            onClick={() => tell(`${now.name} has its own design.`)}
          >
            Open the event
            <Glyph name="arrow" size={18} />
          </button>
        </div>
      </header>
    );

  return (
    <header className={`today-now today-cover is-${now.event}`}>
      <span className="today-now-shade" aria-hidden="true" />
      {top}
      <div className="today-now-mid">
        <div className="today-now-words">
          <p className="today-now-event">{now.name}</p>
          <h1 className="today-now-title">{now.happening}</h1>
          <div className="today-now-line">
            <span className="today-now-until">{now.until}</span>
            <span className="today-chip is-glass">{now.behind}</span>
          </div>
        </div>
        <div className="today-now-side">
          <div className="today-now-next">
            <div className="today-next-up">
              <span className="today-next-label">Next</span>
              <span className="today-next-what">
                <span className="today-figures">{now.next.time}</span> {now.next.title}
              </span>
            </div>
            <div
              className="today-arrived"
              role="img"
              aria-label={`${now.arrived} of ${now.expected} arrived`}
            >
              <Ring share={now.arrived / now.expected} />
              <span className="today-arrived-words" aria-hidden="true">
                <span className="today-arrived-count">
                  {now.arrived}
                  <span className="today-arrived-of">{`/${now.expected}`}</span>
                </span>
                <span className="today-arrived-label">arrived</span>
              </span>
            </div>
          </div>
          <button
            type="button"
            className="today-white"
            onClick={() => tell('The run of show has its own design.')}
          >
            Open run of show
            <Glyph name="arrow" size={18} />
          </button>
        </div>
      </div>
      <Rail now={now} />
    </header>
  );
}
