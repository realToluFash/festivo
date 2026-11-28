import { type MarkedMilestone, milestoneMoment, namesZone } from '@soirely/domain';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { dateLocale } from '../i18n/index.ts';
import { distanceWords } from '../routes/app/events/distanceWords.ts';
import type { ComingUpShows } from './liveOneDay.ts';

function readerZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Main's Coming up, with the end as Today's live cover says it in place of the finished sentence while the event is on: no ✓, and the inset, heading and rows' height as they are (sc-93858). */
export function ComingUpPart({
  eventId,
  shows,
  timeZone,
  now,
}: {
  eventId: string;
  shows: ComingUpShows;
  timeZone: string;
  now: Date;
}) {
  const { t } = useTranslation();

  return (
    <section className="card coming-up" aria-labelledby="coming-up-title">
      <div className="coming-up-head">
        <h2 id="coming-up-title" tabIndex={-1}>
          {t('timeline.comingUp')}
        </h2>
        <Link className="link-button" to={`/demo/events/${encodeURIComponent(eventId)}/dates`}>
          {t('timeline.allDates')}
        </Link>
      </div>
      <div className="coming-up-rows">
        {shows.kind === 'ends' && (
          <p className="timeline-inset arrives">{t('today.endsToday', { time: shows.time })}</p>
        )}
        {shows.kind === 'finished' && (
          <p className="timeline-inset timeline-finished arrives">
            <span className="timeline-finished-mark" aria-hidden="true">
              ✓
            </span>
            {t('timeline.finished')}
          </p>
        )}
        {shows.kind === 'rows' && (
          <ol className="timeline-list arrives">
            {shows.rows.map((marked, index) => (
              <Row key={index} marked={marked} timeZone={timeZone} now={now} />
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function Row({
  marked: { milestone, nextUp },
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
    <li className="timeline-row">
      <p className="timeline-when">
        <time dateTime={milestone.at}>
          {namesZone(timeZone, readerZone())
            ? t('timeline.momentInZone', { moment, timeZone })
            : moment}
        </time>
        <span className="muted"> · {distanceWords(t, milestone.at, timeZone, now)}</span>
      </p>
      <p className="timeline-title">{milestone.title}</p>
      <div className="timeline-marks">
        <span className="pill-quiet timeline-owner timeline-owner-event">
          {t('timeline.owner_event')}
        </span>
        {nextUp && <span className="pill-quiet timeline-next-up">{t('timeline.nextUp')}</span>}
      </div>
    </li>
  );
}
