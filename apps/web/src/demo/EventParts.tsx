import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { type CardStepAction, type Milestone, eventPhase } from '@soirely/domain';

import { EventCard as ProductCard, EventThumb } from '../components/EventCard.tsx';
import { EventRow as ProductRow } from '../components/EventsList.tsx';
import { Toast } from '../components/Toast.tsx';
import { type Shown, howSoon, rowLine, rowTag, shownEvent } from '../eventsList.ts';
import { dateLocale } from '../i18n/index.ts';
import {
  type SampleEvent,
  type Shown as DemoShown,
  type Tab,
  phaseWord,
  tagKind,
} from './events.ts';
import { Glyph } from '../components/Glyph.tsx';
import { type CardMilestone, KW } from './kitchen.ts';
import { LayersContext } from '../layers.ts';
import { Chevron, RowWords, Tag } from '../components/SettingsParts.tsx';
import type { Tell } from '../components/SettingsParts.tsx';
import './today.css';
import '../components/SettingsParts.css';
import '../components/eventPage.css';
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

const milestoneAt = (at: string, title: string): Milestone => ({
  at,
  title,
  note: null,
  owner: 'event',
  area: 'events',
  action: null,
});

/** A sample event as the product's list draws one: its place with its city, its start and end as its milestones. */
export function shownSample(event: SampleEvent, now: Date): Shown {
  return {
    ...shownEvent(
      {
        ...event,
        place: event.venue == null ? null : `${event.venue.name}, ${event.venue.city}`,
        photo: event.photo ? 'standIn' : null,
        milestones: [
          milestoneAt(event.startsAt, `${event.name} starts`),
          milestoneAt(event.endsAt, `${event.name} ends`),
        ],
      },
      eventPhase(event, now),
    ),
    mesh: event.mesh,
  };
}

/** The event's cover at a size, or its colour from meshFor while it has no photo. */
export function Thumb({ event, size }: { event: SampleEvent; size: 28 | 40 | 48 }) {
  return (
    <EventThumb event={{ mesh: event.mesh, photo: event.photo ? 'standIn' : null }} size={size} />
  );
}

/** The product's cover card on a sample event, every step offered, as the owner it is shown to. */
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
  onStep: (does: CardStepAction) => void;
}) {
  return (
    <ProductCard
      event={shownSample(event, now)}
      now={now}
      locale={dateLocale()}
      level={level}
      {...(level === 2 && { to: `/demo/events/${event.id}` })}
      guests={guests}
      nextUp={milestone == null ? null : <MilestoneStep milestone={milestone} />}
      takes={() => true}
      onStep={(step) => onStep(step.action)}
    />
  );
}

function MilestoneStep({ milestone }: { milestone: CardMilestone }) {
  return (
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
  );
}

export function PhaseTag({ shown }: { shown: DemoShown }) {
  return <Tag kind={tagKind(shown)} word={phaseWord(shown)} />;
}

/** The product's row on a sample event; where tabs are mixed every row says its phase. With `figures`, the event's guest line sits under the row's link, beside it and never inside it (sc-3786). */
export function EventRow({
  event,
  now,
  tab,
  figures = null,
}: {
  event: SampleEvent;
  now: Date;
  tab: Tab | 'all';
  figures?: ReactNode;
}) {
  const shown = shownSample(event, now);
  const to = `/demo/events/${event.id}`;
  const everyPhase = tab === 'all';

  if (figures == null)
    return (
      <ProductRow event={shown} now={now} locale={dateLocale()} to={to} everyPhase={everyPhase} />
    );

  return <FiguredRow shown={shown} now={now} to={to} everyPhase={everyPhase} figures={figures} />;
}

function FiguredRow({
  shown,
  now,
  to,
  everyPhase,
  figures,
}: {
  shown: Shown;
  now: Date;
  to: string;
  everyPhase: boolean;
  figures: ReactNode;
}) {
  const { t } = useTranslation();
  const tag = rowTag(shown, everyPhase, t);
  const soon = howSoon(shown, now, t);

  return (
    <li className="ev-figured">
      <Link className="desk-row ev-row" to={to}>
        <EventThumb event={shown} size={48} />
        <RowWords
          title={shown.name}
          tag={tag != null && <Tag kind={tag.kind} word={tag.word} />}
          lines={[rowLine(shown, now, dateLocale(), t)]}
        />
        {soon != null && <span className="ev-soon">{soon}</span>}
        <Chevron />
      </Link>
      {figures}
    </li>
  );
}

/** Something an AC adds that main has not built: its words in a dashed pill, naming its story. */
export function NotBuilt({ words }: { words: string }) {
  return <span className="ev-pill">{words}</span>;
}
