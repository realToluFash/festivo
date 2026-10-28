import { type OrganisationEvent } from '@soirely/api-client';
import {
  comingUp,
  type EventTimeline as Timeline,
  formatEventMoment,
  type MarkedMilestone,
  markedMilestones,
  type MilestoneOwner,
  namesZone,
  serverClock,
} from '@soirely/domain';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { api } from '../../../api.ts';
import { dateLocale } from '../../../i18n/index.ts';
import { useFocusOnceShown } from '../../../stepFocus.ts';
import { distanceWords } from './distanceWords.ts';

type Load =
  { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; timeline: Timeline; at: Date };

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

/** Read again when the event's status moves, so a Call off or End now shows its dates without a reload; judged by a clock no older than the read, so a date it stamped is never still ahead. */
function useTimeline(
  { id: eventId, status }: OrganisationEvent,
  heading: RefObject<HTMLHeadingElement | null>,
  now: Date,
): { load: Load; now: Date; retried: boolean; retry: () => void } {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const land = useFocusOnceShown();

  useEffect(() => {
    let current = true;

    api.eventTimeline(eventId).then(
      (timeline) => current && setLoad({ kind: 'loaded', timeline, at: serverClock.now() }),
      () => current && setLoad({ kind: 'failed' }),
    );

    return () => {
      current = false;
    };
  }, [eventId, status, attempt]);

  return {
    load,
    now: load.kind === 'loaded' && load.at > now ? load.at : now,
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

/** Event View's panel: the next four, or why there are none, in rows held at one height. */
export function ComingUp({ event, now: tick }: { event: OrganisationEvent; now: Date }) {
  const { t } = useTranslation();
  const heading = useRef<HTMLHeadingElement>(null);
  const { load, now, retried, retry } = useTimeline(event, heading, tick);
  const shown = load.kind === 'loaded' ? comingUp(load.timeline.milestones, now) : [];

  return (
    <section className="card coming-up" aria-labelledby="coming-up-title">
      <div className="coming-up-head">
        <h2 id="coming-up-title" ref={heading} tabIndex={-1}>
          {t('timeline.comingUp')}
        </h2>
        {load.kind !== 'failed' && (
          <Link className="link-button" to={`/app/events/${encodeURIComponent(event.id)}/dates`}>
            {t('timeline.allDates')}
          </Link>
        )}
      </div>
      <div className="coming-up-rows" aria-busy={load.kind === 'loading'}>
        {load.kind === 'loading' && <DatesLoading />}
        {load.kind === 'failed' && <DatesFailed announced={retried} onRetry={retry} />}
        {load.kind === 'loaded' && shown.length === 0 && (
          <p className="timeline-inset timeline-finished">
            <span className="timeline-finished-mark" aria-hidden="true">
              ✓
            </span>
            {t('timeline.finished')}
          </p>
        )}
        {load.kind === 'loaded' && shown.length > 0 && (
          <ol className="timeline-list">
            {shown.map((marked, index) => (
              <MilestoneRow
                key={index}
                marked={marked}
                timeZone={load.timeline.timeZone}
                now={now}
                distance
              />
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

/** Every milestone, earliest first, under the line naming the event's zone. */
export function AllDates({
  event,
  now: tick,
  heading,
}: {
  event: OrganisationEvent;
  now: Date;
  heading: RefObject<HTMLHeadingElement | null>;
}) {
  const { t } = useTranslation();
  const { load, now, retried, retry } = useTimeline(event, heading, tick);

  return (
    <>
      {load.kind === 'loading' && <DatesLoading />}
      {load.kind === 'failed' && <DatesFailed announced={retried} onRetry={retry} />}
      {load.kind === 'loaded' && (
        <>
          <p className="muted">{t('timeline.intro', { timeZone: load.timeline.timeZone })}</p>
          <ol className="timeline-list">
            {markedMilestones(load.timeline.milestones, now).map((marked, index) => (
              <MilestoneRow
                key={index}
                marked={marked}
                timeZone={load.timeline.timeZone}
                now={now}
                distance={false}
              />
            ))}
          </ol>
          <dl className="timeline-key">
            {(['event', 'you', 'automatic'] as const).map((owner) => (
              <div key={owner}>
                <dt>
                  <OwnerPill owner={owner} />
                </dt>
                <dd>{t(OWNER_KEY[owner])}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </>
  );
}

function DatesLoading() {
  const { t } = useTranslation();

  return (
    <p className="timeline-inset" role="status">
      <span className="pending-spinner" aria-hidden="true" />
      {t('timeline.loading')}
    </p>
  );
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

function MilestoneRow({
  marked,
  timeZone,
  now,
  distance,
}: {
  marked: MarkedMilestone;
  timeZone: string;
  now: Date;
  distance: boolean;
}) {
  const { t } = useTranslation();
  const { milestone, standing, nextUp } = marked;
  const moment = formatEventMoment(milestone.at, timeZone, dateLocale());

  return (
    <li className={`timeline-row${standing === 'passed' ? ' timeline-row-passed' : ''}`}>
      <p className="timeline-when">
        <time dateTime={milestone.at}>
          {distance && namesZone(timeZone, readerZone())
            ? t('timeline.momentInZone', { moment, timeZone })
            : moment}
        </time>
        {distance && (
          <span className="muted">
            {' '}
            · <Distance at={milestone.at} timeZone={timeZone} now={now} />
          </span>
        )}
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
