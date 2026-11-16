import {
  type OrganisationEvent,
  type PressLost,
  type QueuedPress,
  type Schedule,
  type ScheduleItemPress,
  asSchedule,
  enqueuePress,
  pressedAtOf,
  realtimeTopic,
  sendQueue,
} from '@soirely/api-client';
import {
  type LaterRow,
  type NightTrack,
  type NightView,
  endNowShows,
  formatWallClock,
  nightDayOf,
  nightTracks,
  nightView,
  runItemOf,
  serverClock,
  shownPhase,
  timeSlot,
  wallOfZoned,
  zonedAt,
} from '@soirely/domain';
import type { TFunction } from 'i18next';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';

import { api } from '../../../api.ts';
import { Glyph } from '../../../components/Glyph.tsx';
import { useDeskTop } from '../../../deskTop.ts';
import { dateLocale } from '../../../i18n/index.ts';
import { pageTitle, usePageTitle } from '../../../pageTitle.ts';
import { useLoadedAt, useServerNow } from '../../../serverNow.ts';
import { canOn } from '../../../session.ts';
import { NightSwitch } from './NightSwitch.tsx';
import {
  durationWords,
  keptPresses,
  pressStoreOf,
  scheduleViewPath,
  weekdayOf,
  withPresses,
} from './nightArea.ts';
import type { RunItem } from './runArea.ts';
import { ScheduleArea } from './ScheduleArea.tsx';
import { useHubTopics } from './useHubTopics.ts';
import '../../../components/SettingsParts.css';
import '../../../components/eventsDesk.css';
import '../../../components/eventPage.css';
import './guests.css';
import './schedule.css';
import './runArea.css';
import './night.css';

const RETRY_MS = 15_000;

type Load = { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; schedule: Schedule };

/** The Schedule's address while the event is happening opens Run of show (sc-3895); `?view=schedule` keeps the Schedule. */
export function ScheduleOrNight({ event }: { event: OrganisationEvent }) {
  const [params] = useSearchParams();
  const now = useServerNow();
  const loadedAt = useLoadedAt(event);
  const happening = shownPhase(event, loadedAt, now) === 'happening_now';

  if (!happening) return <ScheduleArea event={event} />;
  if (params.get('view') === 'schedule') return <ScheduleArea event={event} night />;

  return <NightArea event={event} />;
}

function NightArea({ event }: { event: OrganisationEvent }) {
  const { t } = useTranslation();
  const kept = useMemo(() => keptPresses(event.id), [event.id]);
  const store = useMemo(() => pressStoreOf(kept), [kept]);
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [queue, setQueue] = useState<QueuedPress[]>(() => kept.read());
  const [offline, setOffline] = useState(false);
  const [syncedAt, setSyncedAt] = useState(() => serverClock.now());
  const [lost, setLost] = useState<PressLost | null>(null);
  const [said, setSaid] = useState('');
  const sending = useRef(false);
  const again = useRef(false);
  const wasOffline = useRef(false);

  usePageTitle(pageTitle(t, [t('runView.title'), event.name]));

  const loaded = useCallback((schedule: Schedule) => {
    setLoad({ kind: 'loaded', schedule });
    setSyncedAt(serverClock.now());
  }, []);

  useEffect(() => {
    let current = true;

    api.schedule(event.id).then(
      (schedule) => current && loaded(schedule),
      () => current && setLoad((was) => (was.kind === 'loaded' ? was : { kind: 'failed' })),
    );

    return () => {
      current = false;
    };
  }, [event.id, attempt, loaded]);

  const topics = useMemo(() => [realtimeTopic('EventSchedule', event.id)], [event.id]);
  useHubTopics(
    topics,
    () => api.scheduleSubscription(event.id),
    (data) => {
      const schedule = asSchedule(data);
      if (schedule == null) setAttempt((n) => n + 1);
      else loaded(schedule);
    },
    () => setAttempt((n) => n + 1),
  );

  const flush = useCallback(async () => {
    if (sending.current) {
      again.current = true;
      return;
    }
    sending.current = true;
    try {
      do {
        again.current = false;
        const sent = await sendQueue(store, (press) =>
          api.pressScheduleItem(press.eventId, press.itemId, press.kind, press),
        );
        const stuck = sent.left.length > 0;

        if (sent.schedule != null) loaded(sent.schedule);
        else if (sent.lost.length > 0) api.schedule(event.id).then(loaded, () => undefined);
        const last = sent.lost.filter((one) => one.by != null).at(-1);
        if (last != null) setLost(last);
        setQueue(kept.read());
        setOffline(stuck);
        if (!stuck && wasOffline.current) setSaid(t('night.sent'));
        wasOffline.current = stuck;
        if (stuck) break;
      } while (again.current);
    } finally {
      sending.current = false;
    }
  }, [event.id, kept, store, loaded, t]);

  useEffect(() => {
    if (kept.read().length > 0) void flush();
  }, [kept, flush]);

  useEffect(() => {
    const retry = () => void flush();

    window.addEventListener('online', retry);
    const timer = offline ? window.setInterval(retry, RETRY_MS) : undefined;

    return () => {
      window.removeEventListener('online', retry);
      window.clearInterval(timer);
    };
  }, [offline, flush]);

  const press = useCallback(
    async (item: RunItem, kind: ScheduleItemPress, words: string) => {
      await enqueuePress(store, {
        eventId: event.id,
        itemId: item.id,
        kind,
        title: item.title,
        key: crypto.randomUUID(),
        pressedAt: pressedAtOf(serverClock.now()),
      });
      setQueue(kept.read());
      setLost(null);
      setSaid(words);
      void flush();
    },
    [event.id, kept, store, flush],
  );

  return (
    <div className="desk ev desk-page ev-page gs mn ro rv nt">
      <div className="ev-wide mn-page">
        <Crumbs event={event} />
        {load.kind === 'loaded' ? (
          <Night
            event={event}
            schedule={withPresses(load.schedule, event.id, queue)}
            queued={queue.length}
            offline={offline}
            syncedAt={syncedAt}
            lost={lost}
            onDismiss={() => setLost(null)}
            onTry={() => void flush()}
            onPress={(item, kind, words) => void press(item, kind, words)}
          />
        ) : (
          <>
            <header className="gs-top nt-top">
              <div className="mn-head">
                <h1 className="gs-title">{t('runView.title')}</h1>
              </div>
            </header>
            {load.kind === 'loading' && <Bones />}
            {load.kind === 'failed' && (
              <div className="nt-card" role="alert">
                <p className="mn-failed">
                  <Glyph name="alert" size={17} weight={2.2} />
                  {t('runView.failed')}
                </p>
                <div>
                  <button
                    type="button"
                    className="rv-act"
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
        <div className="visually-hidden" aria-live="polite">
          {said}
        </div>
      </div>
    </div>
  );
}

function Bones() {
  const { t } = useTranslation();

  return (
    <div className="nt-grid" role="progressbar" aria-label={t('runView.loading')}>
      <div className="nt-column">
        <div className="nt-card is-dark nt-bones is-tall" />
        <div className="nt-card nt-bones" />
      </div>
      <div className="nt-card nt-bones is-tall" />
    </div>
  );
}

function Crumbs({ event }: { event: OrganisationEvent }) {
  const { t } = useTranslation();
  const desk = useDeskTop();

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
          <li className="ev-crumb-part" aria-current="page">
            <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
            <span className="ev-crumb-name">{t('runView.title')}</span>
          </li>
        </ol>
      </nav>
      <NightSwitch eventId={event.id} on="night" />
      {desk.bell}
    </div>
  );
}

interface Acts {
  done: (item: RunItem) => void;
  skip: (item: RunItem) => void;
  start: (item: RunItem) => void;
  choose: (item: RunItem) => void;
}

type View = NightView<RunItem>;

function Night({
  event,
  schedule,
  queued,
  offline,
  syncedAt,
  lost,
  onDismiss,
  onTry,
  onPress,
}: {
  event: OrganisationEvent;
  schedule: Schedule;
  queued: number;
  offline: boolean;
  syncedAt: Date;
  lost: PressLost | null;
  onDismiss: () => void;
  onTry: () => void;
  onPress: (item: RunItem, kind: ScheduleItemPress, words: string) => void;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const serverNow = useServerNow();
  const zone = schedule.timeZone;
  const now = zonedAt(serverNow, zone);
  const manage = canOn(event, 'run_of_show.manage');
  const items = schedule.items.map(runItemOf);
  const tracks = nightTracks(items, now);
  const today = nightDayOf(now);
  const [trackKey, setTrackKey] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [rows] = useState(() => new Map<string, HTMLButtonElement>());
  const track = tracks.find((one) => one.key === trackKey) ?? tracks[0] ?? null;
  const view = track == null ? null : nightView(track, now, zone);
  const chosenRow =
    view?.later.find((row) => row.item.id === chosen && row.mark === 'notStarted') ?? null;
  const labelOf = (one: NightTrack<RunItem>) => {
    const place = one.place ?? t('schedule.main');

    return one.day === today
      ? place
      : t('runView.trackOnDay', { place, day: weekdayOf(one.day, locale) });
  };
  const endNow = endNowShows(items, now, {
    happening: true,
    eventsManage: canOn(event, 'events.manage'),
    manage,
  });

  const settle = () => {
    setChosen(null);
    setMoving(false);
  };
  const acts: Acts = {
    done: (item) => {
      settle();
      onPress(
        item,
        'done',
        view?.next == null
          ? t('night.saidDone', { title: item.title })
          : t('night.saidDoneNext', { title: item.title, next: view.next.item.title }),
      );
    },
    skip: (item) => {
      settle();
      onPress(item, 'skip', t('night.saidSkipped', { title: item.title }));
    },
    start: (item) => {
      settle();
      onPress(item, 'start', t('night.saidStarted', { title: item.title }));
    },
    choose: (item) => {
      setChosen(item.id);
      setMoving(false);
    },
  };
  const close = () => {
    const row = chosen == null ? undefined : rows.get(chosen);
    settle();
    row?.focus();
  };

  return (
    <>
      <Head
        view={view}
        now={now}
        label={track == null ? '' : labelOf(track)}
        many={tracks.length > 1}
        menuOpen={menuOpen}
        onMenu={() => setMenuOpen(!menuOpen)}
      />
      {menuOpen && view != null && tracks.length > 1 && (
        <ul className="nt-menu" aria-label={t('night.tracks')}>
          {tracks.map((one) => {
            const on = one.key === track?.key;

            return (
              <li key={one.key}>
                <button
                  type="button"
                  className="nt-menu-row"
                  aria-pressed={on}
                  onClick={() => {
                    setTrackKey(one.key);
                    setMenuOpen(false);
                    settle();
                  }}
                >
                  <span>{labelOf(one)}</span>
                  {on && <Glyph name="tick" size={16} weight={2.6} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <Strip
        offline={offline}
        queued={queued}
        age={Math.max(1, Math.round((serverNow.getTime() - syncedAt.getTime()) / 60_000))}
        onTry={onTry}
      />
      {!manage && (
        <p className="nt-view-only">
          <span className="nt-pill">
            <Glyph name="eye" size={14} weight={2.4} />
            {t('night.viewOnly')}
          </span>
          <span>{t('night.viewOnlyLine')}</span>
        </p>
      )}
      {lost?.by != null && (
        <div className="nt-alert" role="alert">
          <p className="nt-alert-words">
            <strong>{lost.press.title}</strong>
            <span>
              {t('night.alreadyStarted', { name: lost.by.name, ...timeSlot(lost.by.at, locale) })}
            </span>
          </p>
          <button type="button" className="rv-act" onClick={onDismiss}>
            {t('night.dismiss')}
          </button>
        </div>
      )}
      <div className="nt-split">
        <div className="nt-cards">
          <Cards
            eventId={event.id}
            view={view}
            label={track == null ? '' : labelOf(track)}
            place={track?.place ?? t('schedule.main')}
            manage={manage}
            endNow={endNow}
            chosen={chosenRow?.item.id ?? null}
            acts={acts}
            rows={rows}
          />
        </div>
        {chosenRow != null && view != null && (
          <aside className="nt-panel" aria-label={chosenRow.item.title}>
            <Chosen
              row={chosenRow}
              busy={view.now != null}
              manage={manage}
              moving={moving}
              onMove={setMoving}
              onClose={close}
              acts={acts}
            />
          </aside>
        )}
      </div>
    </>
  );
}

function useClock(): (time: string) => string {
  const locale = dateLocale();

  return (time) => formatWallClock(wallOfZoned(time), locale);
}

function Head({
  view,
  now,
  label,
  many,
  menuOpen,
  onMenu,
}: {
  view: View | null;
  now: string;
  label: string;
  many: boolean;
  menuOpen: boolean;
  onMenu: () => void;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const clock = useClock();
  const header = view?.header;
  const figure =
    header == null || header.kind === 'finished'
      ? null
      : header.kind === 'onTime'
        ? t('runView.onTime')
        : t('night.behind', { duration: durationWords(t, header.minutes) });

  return (
    <header className="gs-top nt-top">
      <div className="mn-head">
        <h1 className="gs-title">{t('runView.title')}</h1>
        {view != null && (
          <div className="nt-head-line">
            {many ? (
              <button
                type="button"
                className="nt-picker"
                aria-expanded={menuOpen}
                aria-label={t('night.track', { place: label })}
                onClick={onMenu}
              >
                <span>{label}</span>
                <Glyph name="chevdown" size={16} weight={2.4} />
              </button>
            ) : (
              <span className="nt-place">{label}</span>
            )}
            <span className="nt-sub num">
              {view.endsAbout == null
                ? t('night.progress', { done: view.done, count: view.total })
                : t('night.progressEnds', {
                    done: view.done,
                    count: view.total,
                    time: clock(view.endsAbout),
                  })}
            </span>
          </div>
        )}
      </div>
      <div className="nt-head-end">
        <p className="rv-clock">
          <Glyph name="clock" size={16} weight={2.2} />
          <span className="num">{formatWallClock(wallOfZoned(now), locale)}</span>
        </p>
        {figure != null && header != null && (
          <p className={`nt-figure is-${header.kind}`}>
            <span className="nt-figure-mark" aria-hidden="true" />
            <span className="num">{figure}</span>
          </p>
        )}
      </div>
    </header>
  );
}

function Strip({
  offline,
  queued,
  age,
  onTry,
}: {
  offline: boolean;
  queued: number;
  age: number;
  onTry: () => void;
}) {
  const { t } = useTranslation();

  if (!offline)
    return (
      <p className="nt-strip">
        <span className="nt-dot" aria-hidden="true" />
        {t('night.live')}
      </p>
    );

  return (
    <div className="nt-strip is-off">
      <span className="nt-ring" aria-hidden="true" />
      <p className="nt-strip-words">
        <strong>{t('night.reconnecting', { age: durationWords(t, age) })}</strong>
        {queued > 0 && <span>{t('night.waiting', { count: queued })}</span>}
      </p>
      <button type="button" className="rv-act" onClick={onTry}>
        {t('night.tryNow')}
      </button>
    </div>
  );
}

function Cards({
  eventId,
  view,
  label,
  place,
  manage,
  endNow,
  chosen,
  acts,
  rows,
}: {
  eventId: string;
  view: View | null;
  label: string;
  place: string;
  manage: boolean;
  endNow: boolean;
  chosen: string | null;
  acts: Acts;
  rows: Map<string, HTMLButtonElement>;
}) {
  const { t } = useTranslation();
  const clock = useClock();

  if (view == null)
    return (
      <section className="nt-card nt-empty">
        <Glyph name="day" size={24} weight={2.2} />
        <h2>{t('night.nothingToday')}</h2>
        <Link className="nt-link" to={scheduleViewPath(eventId)}>
          {t('night.openSchedule')}
        </Link>
      </section>
    );
  if (view.header.kind === 'finished') {
    const { end } = view;
    const late = end?.minutesLate ?? null;

    return (
      <section className="nt-card nt-end">
        <span className="nt-end-tick" aria-hidden="true">
          <Glyph name="tick" size={22} weight={2.6} />
        </span>
        <h2>{t('night.everything')}</h2>
        {late != null && (
          <p className="nt-end-sentence">
            {late > 0
              ? t('night.finishedBehind', { count: late })
              : late < 0
                ? t('night.finishedAhead', { count: -late })
                : t('night.finishedOnPlan')}
          </p>
        )}
        {late != null && end?.actualEnd != null && end.plannedEnd != null && (
          <p className="nt-muted">
            {t('night.workedOut', {
              actual: clock(end.actualEnd),
              planned: clock(end.plannedEnd),
            })}
          </p>
        )}
        {endNow && (
          <Link className="nt-link" to={`/app/events/${encodeURIComponent(eventId)}`}>
            {t('eventEnd.endNow')}
          </Link>
        )}
      </section>
    );
  }

  return (
    <div className="nt-grid">
      <div className="nt-column">
        <NowCard view={view} label={label} manage={manage} acts={acts} />
        <NextCard view={view} place={place} manage={manage} acts={acts} />
      </div>
      <section className="nt-card" aria-labelledby="nt-later">
        <div>
          <h2 id="nt-later" className="nt-label">
            {t('night.later')}
          </h2>
          <p className="nt-muted">{t('night.laterNote')}</p>
        </div>
        {view.later.length === 0 ? (
          <p className="nt-muted">{t('night.nothingElse', { place })}</p>
        ) : (
          <ul className="nt-later">
            {view.later.map((row) => (
              <li key={row.item.id}>
                <LaterLine
                  row={row}
                  on={row.item.id === chosen}
                  choosable={manage && row.mark === 'notStarted'}
                  onChoose={() => acts.choose(row.item)}
                  rows={rows}
                  time={row.at == null ? null : clock(row.at)}
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
  label,
  manage,
  acts,
}: {
  view: View;
  label: string;
  manage: boolean;
  acts: Acts;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const clock = useClock();
  const { now, elapsed } = view;

  if (now == null || elapsed == null)
    return (
      <section className="nt-card is-dark" aria-label={t('night.now')}>
        <p className="nt-label">{t('night.now')}</p>
        <h2 className="nt-now-title">{t('night.nothingOn')}</h2>
        {view.lastFinished != null && (
          <p className="nt-on-dark-muted">
            {t('night.lastFinished', {
              title: view.lastFinished.item.title,
              time: clock(view.lastFinished.at),
            })}
          </p>
        )}
      </section>
    );

  const over = elapsed.over > 0;

  return (
    <section className="nt-card is-dark" aria-label={t('night.now')}>
      <p className="nt-label">
        {t('night.nowSince', timeSlot(now.startedAt ?? now.planned, locale))}
      </p>
      <h2 className="nt-now-title">{now.title}</h2>
      <p className="nt-on-dark-muted">
        {t('night.ownerPlace', { owner: now.ownerName ?? t('schedule.noOwner'), place: label })}
      </p>
      {view.startedBefore != null && (
        <p className="nt-on-dark-muted">
          {t('runView.startedBefore', { title: view.startedBefore.title })}
        </p>
      )}
      <p className={over ? 'nt-elapsed is-over' : 'nt-elapsed'}>
        <span className={over ? 'nt-ring' : ''} aria-hidden="true">
          {!over && <Glyph name="clock" size={18} weight={2.4} />}
        </span>
        <span className="num">
          {over
            ? t('night.over', { duration: durationWords(t, elapsed.over) })
            : durationWords(t, elapsed.minutes)}
        </span>
      </p>
      {now.lengthMinutes == null ? (
        <p className="nt-on-dark-muted">{t('runView.noLength')}</p>
      ) : (
        <div className="nt-lasts">
          <span className="nt-on-dark-muted">{t('night.lasts', { count: now.lengthMinutes })}</span>
          <progress className="nt-bar" max={1} value={elapsed.share ?? 0} aria-hidden="true" />
        </div>
      )}
      {manage && (
        <div className="nt-pair">
          <button
            type="button"
            className="nt-big is-filled is-wide"
            aria-label={t('night.doneNamed', { title: now.title })}
            onClick={() => acts.done(now)}
          >
            {t('runView.done')}
          </button>
          <button
            type="button"
            className="nt-big is-on-dark"
            aria-label={t('night.skipNamed', { title: now.title })}
            onClick={() => acts.skip(now)}
          >
            {t('night.skip')}
          </button>
        </div>
      )}
    </section>
  );
}

function ownerAndLength(t: TFunction, item: RunItem): string {
  const owner = item.ownerName ?? t('schedule.noOwner');

  return item.lengthMinutes == null
    ? t('night.ownerNoLength', { owner })
    : t('night.ownerLasts', { owner, count: item.lengthMinutes });
}

function NextCard({
  view,
  place,
  manage,
  acts,
}: {
  view: View;
  place: string;
  manage: boolean;
  acts: Acts;
}) {
  const { t } = useTranslation();
  const clock = useClock();
  const { next } = view;

  return (
    <section className="nt-card" aria-label={t('night.next')}>
      <p className="nt-label">{t('night.next')}</p>
      {next == null ? (
        <p className="nt-muted">{t('night.nothingElse', { place })}</p>
      ) : (
        <>
          <p className="nt-time num">
            <span className="visually-hidden">
              {next.expected == null
                ? clock(next.planned)
                : t('night.plannedAbout', {
                    planned: clock(next.planned),
                    expected: clock(next.expected),
                  })}
            </span>
            <span aria-hidden="true">{clock(next.planned)}</span>
            {next.expected != null && (
              <span className="nt-about" aria-hidden="true">
                <Glyph name="arrow" size={16} weight={2.4} />
                {t('runView.about', { time: clock(next.expected) })}
              </span>
            )}
          </p>
          <h2 className="nt-next-title">{next.item.title}</h2>
          <p className="nt-muted">{ownerAndLength(t, next.item)}</p>
          {manage &&
            (view.now == null ? (
              <button
                type="button"
                className="nt-big is-filled"
                aria-label={t('night.startNamed', { title: next.item.title })}
                onClick={() => acts.start(next.item)}
              >
                {t('night.startNow')}
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
  const { t } = useTranslation();

  return (
    <p className="nt-inset">
      <span className="nt-pause" aria-hidden="true" />
      {t('night.finishFirst')}
    </p>
  );
}

function LaterLine({
  row,
  on,
  choosable,
  onChoose,
  rows,
  time,
}: {
  row: LaterRow<RunItem>;
  on: boolean;
  choosable: boolean;
  onChoose: () => void;
  rows: Map<string, HTMLButtonElement>;
  time: string | null;
}) {
  const { t } = useTranslation();
  const words =
    row.mark === 'skipped'
      ? t('night.rowSkipped')
      : row.mark === 'done'
        ? t('night.rowDone', { time })
        : t('night.rowNotStarted', { time });
  const inner = (
    <>
      <span className={`nt-mark is-${row.mark}`} aria-hidden="true">
        {row.mark === 'done' && <Glyph name="tick" size={12} weight={3} />}
      </span>
      <span className="nt-later-words">
        <span className={row.mark === 'skipped' ? 'nt-later-title is-struck' : 'nt-later-title'}>
          {row.item.title}
        </span>
        <span className="nt-muted num">{words}</span>
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
  row: LaterRow<RunItem>;
  busy: boolean;
  manage: boolean;
  moving: boolean;
  onMove: (moving: boolean) => void;
  onClose: () => void;
  acts: Acts;
}) {
  const { t } = useTranslation();
  const clock = useClock();
  const { item } = row;
  const head = (title: string) => (
    <div className="nt-panel-head">
      <h2>{title}</h2>
      <button type="button" className="nt-close" aria-label={t('schedule.close')} onClick={onClose}>
        <Glyph name="clear" size={20} weight={2.4} />
      </button>
    </div>
  );

  if (moving)
    return (
      <>
        {head(t('night.moveNamed', { title: item.title }))}
        <button type="button" className="nt-big" onClick={() => onMove(false)}>
          {t('night.leaveIt')}
        </button>
      </>
    );

  return (
    <>
      {head(item.title)}
      <p className="nt-muted num">
        {t('night.chosenLine', {
          time: row.at == null ? '' : clock(row.at),
          rest: ownerAndLength(t, item),
        })}
      </p>
      {manage &&
        (busy ? (
          <FinishFirst />
        ) : (
          <button
            type="button"
            className="nt-big is-filled"
            aria-label={t('night.startNamed', { title: item.title })}
            onClick={() => acts.start(item)}
          >
            {t('night.startNow')}
          </button>
        ))}
      <button
        type="button"
        className="nt-big"
        aria-label={t('night.skipNamed', { title: item.title })}
        onClick={() => acts.skip(item)}
      >
        {t('night.skip')}
      </button>
      <button
        type="button"
        className="nt-big"
        aria-label={t('night.moveNamed', { title: item.title })}
        onClick={() => onMove(true)}
      >
        {t('night.move')}
      </button>
    </>
  );
}
