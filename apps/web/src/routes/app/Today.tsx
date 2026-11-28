import type { ListedEvent } from '@soirely/api-client';
import { firstName, nowAsOfLine, serverClock, todayView } from '@soirely/domain';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { api } from '../../api.ts';
import { NotificationsBell } from '../../components/NotificationsBell.tsx';
import { Refreshing } from '../../components/OfflineBand.tsx';
import { ArrivalNotice } from '../../components/PageArrival.tsx';
import { Skeleton } from '../../components/Skeleton.tsx';
import type { Open } from '../../components/today.ts';
import { Banner, type BannerActions, NowBanner } from '../../components/TodayBanner.tsx';
import { RunNowBanner } from '../../components/TodayRunBanner.tsx';
import { runNowOf } from '../../components/todayRun.ts';
import { useRunSchedule } from '../../components/useRunSchedule.ts';
import { NeedsYou } from '../../components/TodayNeeds.tsx';
import { FirstRun, ThisWeek, YourEvents } from '../../components/TodayParts.tsx';
import { useDeskTop } from '../../deskTop.ts';
import { dateLocale } from '../../i18n/index.ts';
import { keepsWhatLoaded, useOffline } from '../../offline.ts';
import { useServerNow } from '../../serverNow.ts';
import { can, useSession } from '../../session.ts';
import { useFocusOnceShown } from '../../stepFocus.ts';
import { Dashboard } from './Dashboard.tsx';
import { nightTrackPath } from './events/nightArea.ts';
import { todayMoment } from './todayMoment.ts';

type Load =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'loaded'; events: readonly ListedEvent[]; at: Date };

/** Where signing in lands at a desk: Today for anyone in an organisation, as on the app, since a Member granted events one by one sees them too (sc-30413). */
export function SignedInHome() {
  const session = useSession();
  const organisationId = session.organisation?.id;

  if (organisationId == null) return <Dashboard />;

  return <Today key={organisationId} organisationId={organisationId} />;
}

function Today({ organisationId }: { organisationId: string }) {
  const { t } = useTranslation();
  const session = useSession();
  const navigate = useNavigate();
  const desk = useDeskTop();
  const now = useServerNow();
  const creates = can(session, 'events.create');
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const title = useRef<HTMLHeadingElement>(null);
  const waitingTitle = useRef<HTMLHeadingElement>(null);
  const failedLine = useRef<HTMLParagraphElement>(null);
  const land = useFocusOnceShown();
  const { watch, refreshing } = useOffline({
    loaded: load.kind === 'loaded',
    reload: () => setRefresh((n) => n + 1),
    title,
  });

  useEffect(() => {
    let current = true;

    watch(api.allEvents(organisationId)).then(
      (events) => {
        if (!current) return;
        // The waiting title goes when the greeting comes, so whoever was on it moves to the greeting.
        if (waitingTitle.current != null && document.activeElement === waitingTitle.current)
          land(() => title.current);
        setLoad({ kind: 'loaded', events, at: serverClock.now() });
      },
      (error: unknown) =>
        current &&
        setLoad((was) =>
          was.kind === 'loaded' && keepsWhatLoaded(error) ? was : { kind: 'failed' },
        ),
    );

    return () => {
      current = false;
    };
  }, [organisationId, attempt, refresh, watch, land]);

  const reader = {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale: dateLocale(),
  };
  const underWay =
    load.kind === 'loaded' ? (todayView(load, now, reader).now?.event ?? null) : null;
  const { schedule, asOf } = useRunSchedule(underWay);
  const run =
    underWay == null || schedule == null ? null : runNowOf(schedule, now, reader.locale, t);
  const asOfLine =
    schedule == null || asOf == null
      ? null
      : nowAsOfLine(asOf, serverClock.now(), schedule.timeZone, reader.locale);
  const runPath = underWay == null ? null : nightTrackPath(underWay.id, run?.track ?? null);

  const open: Open = (opens) => {
    switch (opens.to) {
      case 'event':
        void navigate(`/app/events/${encodeURIComponent(opens.id)}`);
        return;
      case 'calendar':
        void navigate('/app/calendar');
        return;
      case 'events':
        void navigate('/app/events');
        return;
      case 'create':
        void navigate('/app/events/new');
        return;
      case 'runOfShow':
        if (runPath != null) void navigate(runPath);
        return;
      case 'notifications':
        return;
    }
  };

  if (load.kind !== 'loaded')
    return (
      <div className="today-page">
        <h1 ref={waitingTitle}>{t('nav.today')}</h1>
        {load.kind === 'loading' ? (
          <Skeleton words={t('pending.loading')} shape="line" />
        ) : (
          <ArrivalNotice
            role={attempt > 0 ? undefined : 'alert'}
            line={t('events.failed')}
            lineRef={failedLine}
            focusable
            retry={t('events.retry')}
            onRetry={() => {
              setLoad({ kind: 'loading' });
              setAttempt((n) => n + 1);
              land(() => title.current ?? failedLine.current);
            }}
          />
        )}
      </div>
    );

  const moment = todayMoment(load, now, reader, firstName(session.name), t);
  // Where the shell keeps its band the bell is the band's, so the banner carries only New event there.
  const actions: BannerActions = {
    create: creates,
    bell:
      desk.bell == null ? null : (
        <NotificationsBell userId={session.userId} accountZone={session.timezone} look="banner" />
      ),
  };

  return (
    <div className="today-page">
      {moment.now != null && run != null ? (
        <RunNowBanner
          now={moment.now}
          run={run}
          asOf={asOfLine == null ? null : t(asOfLine.key, asOfLine.values)}
          actions={actions}
          open={open}
          titleRef={title}
        />
      ) : moment.now != null ? (
        <NowBanner now={moment.now} full={false} actions={actions} open={open} titleRef={title} />
      ) : (
        <Banner moment={moment} actions={actions} open={open} titleRef={title} />
      )}
      {refreshing && <Refreshing />}
      {moment.kind === 'first' ? (
        <FirstRun open={open} create={creates} />
      ) : (
        <div className="today-columns">
          <div className="today-left">
            <NeedsYou moment={moment} open={open} />
            <ThisWeek moment={moment} open={open} />
          </div>
          <div className="today-right">
            <YourEvents moment={moment} open={open} />
          </div>
        </div>
      )}
    </div>
  );
}
