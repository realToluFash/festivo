import {
  ApiError,
  type OrganisationEvent,
  type Schedule,
  asSchedule,
  realtimeTopic,
} from '@soirely/api-client';
import {
  type RunFigure,
  type RunRow,
  asksNextStep,
  collisionWords,
  figureSaid,
  figureWords,
  formatWallClock,
  nextWords,
  timeSlot,
  wallAt,
} from '@soirely/domain';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { api } from '../../../api.ts';
import { Glyph } from '../../../components/Glyph.tsx';
import { Skeleton } from '../../../components/Skeleton.tsx';
import { dateLocale } from '../../../i18n/index.ts';
import { pageTitle, usePageTitle } from '../../../pageTitle.ts';
import { useServerNow } from '../../../serverNow.ts';
import { canOn } from '../../../session.ts';
import { eventAreaPath } from './EventNav.tsx';
import { type RunItem, type RunTrackView, runViews, said } from './runArea.ts';
import { dayName } from './scheduleArea.ts';
import { useHubTopics } from './useHubTopics.ts';
import '../../../components/eventPage.css';
import './guests.css';
import './schedule.css';
import './runArea.css';

type Load = { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; schedule: Schedule };

/** /app/events/:id/run (sc-1404): each track's planned and expected times, how far behind it runs, fixed times and what would run into them, as its demo draws it. */
export function RunArea({ event }: { event: OrganisationEvent }) {
  const { t } = useTranslation();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  usePageTitle(pageTitle(t, [t('runView.title'), event.name]));

  useEffect(() => {
    let current = true;

    api.schedule(event.id).then(
      (schedule) => current && setLoad({ kind: 'loaded', schedule }),
      () => current && setLoad((was) => (was.kind === 'loaded' ? was : { kind: 'failed' })),
    );

    return () => {
      current = false;
    };
  }, [event.id, attempt]);

  const topics = useMemo(() => [realtimeTopic('EventSchedule', event.id)], [event.id]);
  useHubTopics(
    topics,
    () => api.scheduleSubscription(event.id),
    (data) => {
      const schedule = asSchedule(data);
      if (schedule == null) setAttempt((n) => n + 1);
      else setLoad({ kind: 'loaded', schedule });
    },
    () => setAttempt((n) => n + 1),
  );

  return (
    <div className="desk-page ev-page gs mn ro rv">
      <div className="ev-wide mn-page">
        <Crumbs event={event} />
        {load.kind === 'loaded' ? (
          <RunView
            event={event}
            schedule={load.schedule}
            onSchedule={(schedule) => setLoad({ kind: 'loaded', schedule })}
          />
        ) : (
          <>
            <header className="gs-top">
              <div className="mn-head">
                <h1 className="gs-title">{t('runView.title')}</h1>
              </div>
            </header>
            {load.kind === 'loading' && (
              <Skeleton words={t('runView.loading')} shape="rows" rowHeight={56} />
            )}
            {load.kind === 'failed' && (
              <div className="sn-card" role="alert">
                <p className="mn-failed">
                  <Glyph name="alert" size={17} weight={2.2} />
                  {t('runView.failed')}
                </p>
                <div>
                  <button
                    type="button"
                    className="gs-pill is-secondary"
                    onClick={() => {
                      setLoad({ kind: 'loading' });
                      setAttempt((n) => n + 1);
                    }}
                  >
                    {t('schedule.tryAgain')}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Crumbs({ event }: { event: OrganisationEvent }) {
  const { t } = useTranslation();

  return (
    <div className="ev-crumb-row">
      <nav className="ev-crumb" aria-label={t('schedule.crumb')}>
        <ol>
          <li className="ev-crumb-part">
            <Link to="/app/events">{t('schedule.events')}</Link>
          </li>
          <li className="ev-crumb-part">
            <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
            <Link className="ev-crumb-name" to={`/app/events/${encodeURIComponent(event.id)}`}>
              {event.name}
            </Link>
          </li>
          <li className="ev-crumb-part">
            <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
            <Link className="ev-crumb-name" to={eventAreaPath(event.id, 'schedule')}>
              {t('schedule.title')}
            </Link>
          </li>
          <li className="ev-crumb-part" aria-current="page">
            <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
            <span className="ev-crumb-name">{t('runView.title')}</span>
          </li>
        </ol>
      </nav>
    </div>
  );
}

function RunView({
  event,
  schedule,
  onSchedule,
}: {
  event: OrganisationEvent;
  schedule: Schedule;
  onSchedule: (schedule: Schedule) => void;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const now = wallAt(useServerNow(), schedule.timeZone);
  const manage = canOn(event, 'run_of_show.manage');
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const views = runViews(schedule.items, now, t('schedule.main'), (day) =>
    dayName(day, { locale, zone: schedule.timeZone }),
  );

  async function mark(item: RunItem, how: 'start' | 'finish') {
    setBusy(item.id);
    setFailed(null);
    try {
      onSchedule(await api.markScheduleItem(event.id, item.id, how));
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setFailed(error.problem.title);
        api.schedule(event.id).then(onSchedule, () => undefined);
      } else {
        setFailed(t('runView.markFailed'));
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <header className="gs-top rv-top">
        <div className="mn-head">
          <h1 className="gs-title">{t('runView.title')}</h1>
          <p className="mn-sub">{t('runView.sub')}</p>
        </div>
        <p className="rv-clock">
          <Glyph name="clock" size={16} weight={2.2} />
          <span>
            <span className="num">{t('runView.clock', timeSlot(now, locale))}</span>
          </span>
        </p>
      </header>
      {!manage && (
        <p className="mn-lock">
          <Glyph name="lock" size={16} weight={2.2} />
          {t('schedule.lock')}
        </p>
      )}
      {failed != null && (
        <p className="mn-failed" role="alert">
          <Glyph name="alert" size={17} weight={2.2} />
          {failed}
        </p>
      )}
      {views.length === 0 && <p className="mn-sub">{t('runView.empty')}</p>}
      {views.map((view) => (
        <TrackTable
          key={view.key}
          view={view}
          manage={manage}
          busy={busy}
          onMark={(item, how) => void mark(item, how)}
        />
      ))}
    </>
  );
}

function FigureMark({ figure, name }: { figure: RunFigure; name: string }) {
  const { t } = useTranslation();

  return (
    <p
      className={`rv-figure is-${figure.kind === 'onTime' ? 'on-time' : figure.kind}`}
      role="status"
    >
      <span className="visually-hidden">{said(t, figureSaid(name, figure))}</span>
      {figure.kind !== 'done' && (
        <span className="rv-figure-shown" aria-hidden="true">
          <Glyph
            name={figure.kind === 'behind' ? 'clock' : figure.kind === 'last' ? 'arrow' : 'tick'}
            size={14}
            weight={2.6}
          />
          <span className="num">{said(t, figureWords(figure))}</span>
        </span>
      )}
    </p>
  );
}

function TrackTable({
  view,
  manage,
  busy,
  onMark,
}: {
  view: RunTrackView;
  manage: boolean;
  busy: string | null;
  onMark: (item: RunItem, how: 'start' | 'finish') => void;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const name = said(t, view.name);
  const headingId = `rv-track-${view.key.replace(/[^A-Za-z0-9-]/g, '-')}`;

  return (
    <section className="rv-track" aria-labelledby={headingId}>
      <div className="rv-track-top">
        <h2 id={headingId}>{name}</h2>
        <FigureMark figure={view.track.figure} name={name} />
      </div>
      {view.track.collisions.map(({ before, fixed }) => (
        <p key={`${before.id}|${fixed.id}`} className="rv-collision">
          <Glyph name="warn" size={16} weight={2.4} />
          <span>{said(t, collisionWords(before, fixed, locale))}</span>
        </p>
      ))}
      <table className="rv-table" aria-labelledby={headingId}>
        <thead>
          <tr>
            <th scope="col">{t('schedule.starts')}</th>
            <th scope="col">{t('schedule.lasts')}</th>
            <th scope="col">{t('schedule.item')}</th>
            <th scope="col">{t('schedule.owner')}</th>
            {manage && (
              <th scope="col" className="rv-act-col">
                <span className="visually-hidden">{t('runView.mark')}</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {view.track.rows.map((row) => (
            <RunRowView
              key={row.item.id}
              row={row}
              manage={manage}
              busy={busy === row.item.id}
              onMark={onMark}
            />
          ))}
        </tbody>
      </table>
      <p className="rv-next">
        {said(t, nextWords(view.track, locale))}
        {asksNextStep(view.track, manage) && ` ${t('runView.nextStep')}`}
      </p>
    </section>
  );
}

function RunRowView({
  row,
  manage,
  busy,
  onMark,
}: {
  row: RunRow<RunItem>;
  manage: boolean;
  busy: boolean;
  onMark: (item: RunItem, how: 'start' | 'finish') => void;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const { item, phase } = row;

  return (
    <tr className={`rv-row is-${phase}`}>
      <td className="rv-starts">
        <span className="num">{formatWallClock(item.planned, locale)}</span>
        {phase !== 'waiting' && item.startedAt != null ? (
          <span className="rv-second is-started num">
            {t('runView.started', timeSlot(item.startedAt, locale))}
          </span>
        ) : row.expected != null ? (
          <span className="rv-second is-expected num">
            {t('runView.about', timeSlot(row.expected, locale))}
          </span>
        ) : null}
      </td>
      <td className={item.lengthMinutes == null ? 'rv-lasts is-none' : 'rv-lasts num'}>
        {item.lengthMinutes == null
          ? t('runView.noLength')
          : t('schedule.minutes', { count: item.lengthMinutes })}
      </td>
      <th scope="row" className="rv-item">
        <span className="rv-item-line">
          <span className="rv-title">{item.title}</span>
          {phase !== 'waiting' && (
            <span className={`rv-phase is-${phase}`}>
              <Glyph name={phase === 'done' ? 'tick' : 'arrow'} size={12} weight={2.6} />
              {phase === 'done' ? t('runView.done') : t('runView.now')}
            </span>
          )}
          {item.fixedTime && (
            <span className="rv-fixed">
              <Glyph name="lock" size={12} weight={2.4} />
              {t('schedule.fixed')}
            </span>
          )}
        </span>
        {row.startedBefore != null && (
          <span className="rv-before">
            {t('runView.startedBefore', { title: row.startedBefore.title })}
          </span>
        )}
      </th>
      <td className={item.ownerName == null ? 'rv-owner is-none' : 'rv-owner'}>
        {item.ownerName ?? t('runView.noOwner')}
      </td>
      {manage && (
        <td className="rv-act-col">
          {phase === 'waiting' ? (
            <button
              type="button"
              className="rv-act"
              aria-label={t('runView.startNamed', { title: item.title })}
              disabled={busy}
              onClick={() => onMark(item, 'start')}
            >
              {t('runView.start')}
            </button>
          ) : phase === 'now' ? (
            <button
              type="button"
              className="rv-act is-primary"
              aria-label={t('runView.finishNamed', { title: item.title })}
              disabled={busy}
              onClick={() => onMark(item, 'finish')}
            >
              {t('runView.finish')}
            </button>
          ) : null}
        </td>
      )}
    </tr>
  );
}
