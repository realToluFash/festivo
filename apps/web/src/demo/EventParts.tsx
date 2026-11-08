import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';

import { Toast } from '../components/Toast.tsx';
import {
  type Card,
  type GlassKind,
  type SampleEvent,
  type Shown,
  type Tab,
  cardOf,
  lineOf,
  offRule,
  phaseWord,
  shownOf,
  soonOf,
  tagKind,
} from './events.ts';
import { Glyph } from '../components/Glyph.tsx';
import { type CardMilestone, KW } from './kitchen.ts';
import { LayersContext } from '../layers.ts';
import { Chevron, CardStep, RowWords, Tag } from '../components/SettingsParts.tsx';
import type { Tell } from '../components/SettingsParts.tsx';
import './today.css';
import '../components/SettingsParts.css';
import './settings.css';
import './events.css';
import './kitchen.css';

/** The desk Events sits in: a sidebar, the main card, the layers dialogs open on, and a toast. */
export function EventsShell({
  renderSide,
  told: first = null,
  children,
}: {
  renderSide: (tell: Tell, covered: boolean) => ReactNode;
  told?: string | null;
  children: (tell: Tell) => ReactNode;
}) {
  const [told, setTold] = useState<string | null>(first);
  const tell = useCallback<Tell>((words) => setTold(words), []);
  const [stack, setStack] = useState<readonly string[]>([]);
  const push = useCallback(
    (id: string) => setStack((now) => [...now.filter((one) => one !== id), id]),
    [],
  );
  const pop = useCallback((id: string) => setStack((now) => now.filter((one) => one !== id)), []);
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const layers = useMemo(() => ({ stack, push, pop, host }), [stack, push, pop, host]);
  const covered = stack.length > 0;

  useEffect(() => {
    const search = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k' || !(event.metaKey || event.ctrlKey)) return;

      event.preventDefault();
      tell('Search has its own design.');
    };

    window.addEventListener('keydown', search);

    return () => window.removeEventListener('keydown', search);
  }, [tell]);

  return (
    <LayersContext value={layers}>
      <div className="today desk ev">
        {renderSide(tell, covered)}
        <main id="content" className="desk-main" inert={covered}>
          {children(tell)}
        </main>
        <div ref={setHost} className="desk-layers" />
        {told != null && <Toast key={told} words={told} onClose={() => setTold(null)} />}
      </div>
    </LayersContext>
  );
}

/** The event's cover at a size, or its colour from meshFor while it has no photo. */
export function Thumb({ event, size }: { event: SampleEvent; size: 28 | 40 | 48 }) {
  return event.photo ? (
    <span className={`ev-thumb is-${size} is-photo`} aria-hidden="true">
      <Glyph name="photo" size={Math.round(size / 2)} weight={1.8} />
    </span>
  ) : (
    <span className={`ev-thumb is-${size} today-cover is-${event.mesh}`} aria-hidden="true" />
  );
}

function GlassMark({ kind }: { kind: GlassKind }) {
  switch (kind) {
    case 'paused':
      return (
        <span className="ev-glass-mark is-paused" aria-hidden="true">
          <span />
          <span />
        </span>
      );
    case 'finished':
      return <Glyph name="tick" size={14} weight={2.8} />;
    case 'calledOff':
      return <Glyph name="clear" size={14} weight={2.8} />;
    default:
      return <span className={`ev-glass-mark is-${kind}`} aria-hidden="true" />;
  }
}

const PIECES = [1, 2, 3, 4, 5, 6];

/** The cover card: the phase and how soon on its glass, the name, its days and place, a tile per day, and its one step. */
export function EventCard({
  event,
  now,
  level,
  guests = null,
  milestone = null,
  onStep,
}: {
  event: SampleEvent;
  now: Date;
  level: 1 | 2;
  /** Its guests in the tiles' measure, on Events (sc-3786). */
  guests?: string | null;
  /** Next up when it is a You milestone with an action, which becomes the card's one step (sc-30812). */
  milestone?: CardMilestone | null;
  onStep: (does: Extract<Card['step'], { kind: 'button' }>['does']) => void;
}) {
  const card = cardOf(event, now);
  const Name = level === 1 ? 'h1' : 'h2';
  const shown = shownOf(event, now);

  return (
    <section
      className={`ev-card today-cover ${event.photo ? 'is-photo' : `is-${event.mesh}`}`}
      aria-label={level === 2 ? event.name : undefined}
    >
      <span className="ev-scrim" aria-hidden="true" />
      {event.photo ? (
        <span className="ev-card-photo" aria-hidden="true">
          <Glyph name="photo" size={64} weight={1.6} />
        </span>
      ) : (
        PIECES.map((piece) => (
          <span key={piece} className={`desk-piece p${piece}`} aria-hidden="true" />
        ))
      )}
      <div className="ev-card-inner">
        <ul className="desk-glass-tags">
          {card.tags.map((tag) => (
            <li key={tag.word} className="desk-glass">
              {tag.kind != null && <GlassMark kind={tag.kind} />}
              {tag.word}
            </li>
          ))}
        </ul>
        <Name className="ev-card-name" tabIndex={level === 1 ? -1 : undefined}>
          {level === 2 ? (
            <Link className="ev-card-link" to={`/demo/events/${event.id}`}>
              {event.name}
            </Link>
          ) : (
            event.name
          )}
        </Name>
        <p className="desk-on-card">{lineOf(event, shown === 'calledOff')}</p>
        {guests != null && <p className="desk-on-card">{guests}</p>}
        {card.tiles.length > 0 && (
          <ul className="ev-tiles" aria-label="Its days">
            {card.tiles.map((tile) => (
              <li key={tile.day} className={tile.today ? 'ev-tile is-today' : 'ev-tile'}>
                <span className="ev-tile-top">{tile.today ? 'Today' : tile.weekday}</span>
                <span className="ev-tile-day">{tile.day}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="ev-card-foot">
          {milestone != null && card.step.kind === 'next' ? (
            <>
              <ul className="kitchen-glass">
                <li className="desk-glass">
                  <Glyph name="user" size={14} weight={2.4} />
                  {KW.you}
                </li>
                {milestone.overdue && (
                  <li className="desk-glass">
                    <Glyph name="alert" size={14} weight={2.4} />
                    {KW.overdue}
                  </li>
                )}
              </ul>
              <p className="ev-card-next">{milestone.title}</p>
              <p className="desk-on-card">{milestone.line}</p>
              {milestone.link != null && (
                <Link className="desk-step" to={milestone.link}>
                  {milestone.label}
                  <Glyph name="arrow" size={16} weight={2.4} />
                </Link>
              )}
            </>
          ) : card.step.kind === 'next' ? (
            <>
              <p className="ev-card-next">{card.step.title}</p>
              <p className="desk-on-card">{card.step.line}</p>
            </>
          ) : (
            <>
              <p className="desk-on-card">{card.step.line}</p>
              <CardStep
                label={card.step.label}
                onClick={() => {
                  if (card.step.kind === 'button') onStep(card.step.does);
                }}
              />
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export function PhaseTag({ shown }: { shown: Shown }) {
  return <Tag kind={tagKind(shown)} word={phaseWord(shown)} />;
}

/** An event in the list: its cover or colour, its name, its days and place, how soon, and a tag where it is off its tab's rule. */
export function EventRow({
  event,
  now,
  tab,
  guests = null,
}: {
  event: SampleEvent;
  now: Date;
  tab: Tab | 'all';
  guests?: string | null;
}) {
  const shown = shownOf(event, now);
  const soon = soonOf(event, now);
  const tagged = tab === 'all' || offRule(shown, tab);

  return (
    <li>
      <Link className="desk-row ev-row" to={`/demo/events/${event.id}`}>
        <Thumb event={event} size={48} />
        <RowWords
          title={event.name}
          tag={tagged && <PhaseTag shown={shown} />}
          lines={guests == null ? [lineOf(event)] : [lineOf(event), guests]}
        />
        {soon != null && <span className="ev-soon">{soon}</span>}
        <Chevron />
      </Link>
    </li>
  );
}

/** Something an AC adds that main has not built: its words in a dashed pill, naming its story. */
export function NotBuilt({ words }: { words: string }) {
  return <span className="ev-pill">{words}</span>;
}

export function Alert({ children }: { children: ReactNode }) {
  return (
    <p className="desk-error" role="alert">
      <Glyph name="alert" size={15} weight={2.2} />
      {children}
    </p>
  );
}

/** The broken notice, with what to do about it under its words. */
export function Broken({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="notice notice-broken ev-notice" role="alert">
      <span className="mark mark-broken" aria-hidden="true">
        ✕
      </span>
      <div className="notice-body">
        <p>{children}</p>
        {action}
      </div>
    </div>
  );
}

export function Quiet({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="notice notice-quiet ev-notice" role="status">
      <span className="mark mark-info" aria-hidden="true">
        i
      </span>
      <div className="notice-body">
        <p className="notice-title">{children}</p>
        {action}
      </div>
    </div>
  );
}

export function Switch({
  on,
  label,
  told,
  busy = false,
  onChange,
}: {
  on: boolean;
  label: string;
  told?: string;
  busy?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      className="ev-switch"
      aria-checked={on}
      aria-label={label}
      aria-describedby={told}
      aria-busy={busy}
      onClick={() => {
        if (!busy) onChange(!on);
      }}
    >
      <span className="ev-track" aria-hidden="true">
        <span className="ev-knob" />
      </span>
    </button>
  );
}
