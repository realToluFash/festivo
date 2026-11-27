import { type OrganisationEvent } from '@soirely/api-client';
import {
  comingUpPanel,
  formatEventClock,
  type EventTimeline as Timeline,
  type MarkedMilestone,
  markedMilestones,
  type MilestoneOwner,
  namesZone,
  milestoneMoment,
  neverReached,
  serverClock,
  shownBeside,
  shownPhase,
} from '@soirely/domain';
import { type RefObject, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { api } from '../../../api.ts';
import { listEventOf, rowLine, shownEvent } from '../../../eventsList.ts';
import { dateLocale } from '../../../i18n/index.ts';
import { useLoadedAt } from '../../../serverNow.ts';
import { useFocusOnceShown } from '../../../stepFocus.ts';
import { distanceWords } from './distanceWords.ts';
import { EventThumb } from '../../../components/EventCard.tsx';
import { Glyph, type GlyphName } from '../../../components/Glyph.tsx';
import { RowWords } from '../../../components/SettingsParts.tsx';
import { Skeleton } from '../../../components/Skeleton.tsx';
import '../../../components/SettingsParts.css';
import '../../../components/eventPage.css';
import './guests.css';
import './allDates.css';

type Load =
  { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; timeline: Timeline; at: Date };

const FAILED: Load = { kind: 'failed' };

/** The event's band, which the dates read beside (sc-98386): its Try again presses, each a read of the dates too, and whether it is up, which is how long a read that never reached Soirely keeps the dates shown. */
export interface Beside {
  reloads: number;
  underBand: boolean;
}

const OWNER_WORD: Record<MilestoneOwner, string> = {
  event: 'timeline.owner_event',
  you: 'timeline.owner_you',
  automatic: 'timeline.owner_automatic',
};

const OWNER_KEY: Record<MilestoneOwner, string> = {
  event: 'timeline.key_event',
  you: 'timeline.key_you',
  automatic: 'timeline.key_automatic',
};

const OWNER_GLYPH: Record<MilestoneOwner, GlyphName> = {
  event: 'events',
  you: 'user',
  automatic: 'refresh',
};

/** Read again when the event's status moves, so a Call off or End now shows its dates without a reload; judged by a clock no older than the read, so a date it stamped is never still ahead. */
export interface TimelineRead {
  load: Load;
  now: Date;
  retried: boolean;
  retry: () => void;
}

/** One read of the dates, told apart by what starts it; `kept` holds only while the read that never reached Soirely is the one out or last finished, so a read still out shows what it loaded whatever the band does. */
interface Read {
  eventId: string;
  status: OrganisationEvent['status'];
  attempt: number;
  reloads: number;
}

function sameRead(a: Read, b: Read): boolean {
  return (
    a.eventId === b.eventId &&
    a.status === b.status &&
    a.attempt === b.attempt &&
    a.reloads === b.reloads
  );
}

export function useTimeline(
  { id: eventId, status }: OrganisationEvent,
  heading: RefObject<HTMLHeadingElement | null>,
  now: Date,
  { reloads, underBand }: Beside,
): TimelineRead {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [unreached, setUnreached] = useState<Read | null>(null);
  const [attempt, setAttempt] = useState(0);
  const land = useFocusOnceShown();

  useEffect(() => {
    let current = true;
    const read: Read = { eventId, status, attempt, reloads };

    api.eventTimeline(eventId).then(
      (timeline) => {
        if (!current) return;
        setLoad({ kind: 'loaded', timeline, at: serverClock.now() });
      },
      (error: unknown) => {
        if (!current) return;
        setLoad((was) => (was.kind === 'loaded' && neverReached(error) ? was : FAILED));
        setUnreached(neverReached(error) ? read : null);
      },
    );

    return () => {
      current = false;
    };
  }, [eventId, status, attempt, reloads]);

  const kept = unreached != null && sameRead(unreached, { eventId, status, attempt, reloads });
  const shown = shownBeside(load, kept, underBand, FAILED);

  return {
    load: shown,
    now: shown.kind === 'loaded' && shown.at > now ? shown.at : now,
    retried: attempt > 0,
    retry: () => {
      setLoad({ kind: 'loading' });
      setAttempt((n) => n + 1);
      land(() => heading.current);
    },
  };
}

function readerZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Event View's panel: the next four, or why there are none, in rows held at one height; while it is on with none, when it ends, as Today's live cover says it (sc-93858). */
export function ComingUp({
  event,
  timeline: { load, now, retried, retry },
  heading,
}: {
  event: OrganisationEvent;
  /** Read once for the page, whose card shows its Next up too; `heading` is where its Try again lands. */
  timeline: TimelineRead;
  heading: RefObject<HTMLHeadingElement | null>;
}) {
  const { t } = useTranslation();
  const panel = load.kind === 'loaded' ? comingUpPanel(event, load.timeline.milestones, now) : null;

  return (
    <section className="card coming-up" aria-labelledby="coming-up-title">
      <div className="coming-up-head">
        <h2 id="coming-up-title" ref={heading} tabIndex={-1}>
          {t('timeline.comingUp')}
        </h2>
        {load.kind === 'failed' ? (
          <span className="link-button coming-up-link-held" aria-hidden="true">
            {t('timeline.allDates')}
          </span>
        ) : (
          <Link className="link-button" to={`/app/events/${encodeURIComponent(event.id)}/dates`}>
            {t('timeline.allDates')}
          </Link>
        )}
      </div>
      <div className="coming-up-rows">
        {load.kind === 'loading' && <DatesLoading />}
        {load.kind === 'failed' && <DatesFailed announced={retried} onRetry={retry} />}
        {load.kind === 'loaded' && panel?.kind === 'endsToday' && (
          <p className="timeline-inset arrives">
            {t('today.endsToday', {
              time: formatEventClock(event.endsAt, event.timeZone, dateLocale()),
            })}
          </p>
        )}
        {load.kind === 'loaded' && panel?.kind === 'finished' && (
          <p className="timeline-inset timeline-finished arrives">
            <span className="timeline-finished-mark" aria-hidden="true">
              ✓
            </span>
            {t('timeline.finished')}
          </p>
        )}
        {load.kind === 'loaded' && panel?.kind === 'rows' && (
          <ol className="timeline-list arrives">
            {panel.rows.map((marked, index) => (
              <MilestoneRow
                key={index}
                marked={marked}
                timeZone={load.timeline.timeZone}
                now={now}
              />
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

/** All dates as its demo draws it (sc-98187): the title, the event's strip, then every milestone earliest first in flat rows under the line naming the event's zone, and the key. */
export function AllDates({
  event,
  now: tick,
  heading,
  beside,
}: {
  event: OrganisationEvent;
  now: Date;
  heading: RefObject<HTMLHeadingElement | null>;
  beside: Beside;
}) {
  const { t } = useTranslation();
  const { load, now, retried, retry } = useTimeline(event, heading, tick, beside);
  const loadedAt = useLoadedAt(event);
  const strip = shownEvent(
    listEventOf({ ...event, milestones: [] }),
    shownPhase(event, loadedAt, tick),
  );

  return (
    <div className="dates">
      <h1 ref={heading} className="gs-title" tabIndex={-1}>
        {t('timeline.allDates')}
      </h1>
      <div className="ev-strip">
        <EventThumb event={strip} size={40} />
        <RowWords title={event.name} lines={[rowLine(strip, tick, dateLocale(), t)]} />
      </div>
      {load.kind === 'loading' && <DatesLoading />}
      {load.kind === 'failed' && (
        <div className="dates-failed" role={retried ? 'alert' : undefined}>
          <p>
            <Glyph name="alert" size={16} weight={2.2} />
            {t('timeline.failed')}
          </p>
          <button type="button" className="gs-pill is-secondary" onClick={retry}>
            {t('timeline.retry')}
          </button>
        </div>
      )}
      {load.kind === 'loaded' && (
        <>
          <p className="dates-intro">{t('timeline.intro', { timeZone: load.timeline.timeZone })}</p>
          <ol className="desk-rows ev-details arrives">
            {markedMilestones(load.timeline.milestones, now, event.status === 'ended').map(
              (marked, index) => (
                <DateRow key={index} marked={marked} timeZone={load.timeline.timeZone} now={now} />
              ),
            )}
          </ol>
          <dl className="dates-key">
            {(['event', 'you', 'automatic'] as const).map((owner) => (
              <div key={owner} className="dates-key-row">
                <OwnerLead owner={owner} />
                <dt>{t(OWNER_WORD[owner])}</dt>
                <dd>{t(OWNER_KEY[owner])}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </div>
  );
}

function OwnerLead({ owner }: { owner: MilestoneOwner }) {
  return (
    <span className="ev-lead" aria-hidden="true">
      <Glyph name={OWNER_GLYPH[owner]} size={22} weight={2} />
    </span>
  );
}

function DateRow({
  marked: { milestone, standing, nextUp },
  timeZone,
  now,
}: {
  marked: MarkedMilestone;
  timeZone: string;
  now: Date;
}) {
  const { t } = useTranslation();
  const moment = milestoneMoment(milestone.at, timeZone, now, dateLocale());

  return (
    <li>
      <div className="desk-row dates-row">
        <OwnerLead owner={milestone.owner} />
        <RowWords
          title={milestone.title}
          lines={[
            <time key="when" dateTime={milestone.at}>
              {t('timeline.ownerMoment', { owner: t(OWNER_WORD[milestone.owner]), moment })}
            </time>,
            ...(milestone.note == null ? [] : [milestone.note]),
          ]}
        />
        <span className="dates-tags">
          {standing === 'overdue' && (
            <span className="dates-tag is-overdue">
              <Glyph name="alert" size={13} weight={2.4} />
              {t('timeline.overdue')}
            </span>
          )}
          {standing === 'passed' && (
            <span className="dates-tag is-passed">
              <Glyph name="tick" size={13} weight={2.6} />
              {t('timeline.passed')}
            </span>
          )}
          {nextUp && <span className="dates-tag">{t('timeline.nextUp')}</span>}
        </span>
      </div>
      {milestone.action != null && (
        <Link className="desk-text ev-maps" to={milestone.action.link}>
          {milestone.action.label}
          <Glyph name="arrow" size={16} weight={2.4} />
        </Link>
      )}
    </li>
  );
}

function DatesLoading() {
  const { t } = useTranslation();

  return <Skeleton words={t('timeline.loading')} shape="rows" rowHeight={56} rows={3} inCard />;
}

/** Said aloud only when a retry fails: on arrival the page's own heading comes first. */
function DatesFailed({ announced, onRetry }: { announced: boolean; onRetry: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="timeline-inset timeline-failed" role={announced ? 'alert' : undefined}>
      <p>
        <span className="timeline-failed-mark" aria-hidden="true">
          ✕
        </span>
        {t('timeline.failed')}
      </p>
      <button type="button" className="button" onClick={onRetry}>
        {t('timeline.retry')}
      </button>
    </div>
  );
}

/** A Coming up row: the moment, named with its zone when the reader's differs, and how far off it is. */
function MilestoneRow({
  marked,
  timeZone,
  now,
}: {
  marked: MarkedMilestone;
  timeZone: string;
  now: Date;
}) {
  const { t } = useTranslation();
  const { milestone, standing, nextUp } = marked;
  const moment = milestoneMoment(milestone.at, timeZone, now, dateLocale());

  return (
    <li className={`timeline-row${standing === 'passed' ? ' timeline-row-passed' : ''}`}>
      <p className="timeline-when">
        <time dateTime={milestone.at}>
          {namesZone(timeZone, readerZone())
            ? t('timeline.momentInZone', { moment, timeZone })
            : moment}
        </time>
        <span className="muted">
          {' '}
          · <Distance at={milestone.at} timeZone={timeZone} now={now} />
        </span>
      </p>
      <p className="timeline-title">{milestone.title}</p>
      {milestone.note != null && <p className="muted timeline-note">{milestone.note}</p>}
      <div className="timeline-marks">
        <OwnerPill owner={milestone.owner} />
        {standing === 'passed' && (
          <span className="pill-quiet timeline-passed">
            <span aria-hidden="true">✓ </span>
            {t('timeline.passed')}
          </span>
        )}
        {standing === 'overdue' && (
          <span className="pill-quiet timeline-overdue">
            <span aria-hidden="true">⚠ </span>
            {t('timeline.overdue')}
          </span>
        )}
        {nextUp && <span className="pill-quiet timeline-next-up">{t('timeline.nextUp')}</span>}
      </div>
      {milestone.action != null && (
        <Link className="desk-text timeline-action" to={milestone.action.link}>
          {milestone.action.label}
          <Glyph name="arrow" size={16} weight={2.4} />
        </Link>
      )}
    </li>
  );
}

function OwnerPill({ owner }: { owner: MilestoneOwner }) {
  const { t } = useTranslation();

  return (
    <span className={`pill-quiet timeline-owner timeline-owner-${owner}`}>
      {t(OWNER_WORD[owner])}
    </span>
  );
}

function Distance({ at, timeZone, now }: { at: string; timeZone: string; now: Date }) {
  const { t } = useTranslation();

  return distanceWords(t, at, timeZone, now);
}
