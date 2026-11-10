import { formattingLocale } from '@soirely/domain';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { Toast } from '../components/Toast.tsx';
import { LayersContext, useDeskLayers } from '../layers.ts';
import { NoOrganisation } from './NoOrganisation.tsx';
import { VIEWERS } from './settings.ts';
import { AccessPaused, Switched } from './OrgSwitcher.tsx';
import { inNone, isFresh, useSwitcherStart, useWhere } from './switcher.ts';
import { INVITES_NOT_SENT, keyOf, MOMENTS, type MomentName, momentOf, sayIn } from './today.ts';
import type { Tell } from '../components/SettingsParts.tsx';
import type { Open } from '../components/today.ts';
import { Banner, type BannerActions, NowBanner } from '../components/TodayBanner.tsx';
import { FirstRun, ThisWeek, YourEvents } from '../components/TodayParts.tsx';
import { NeedsYou } from './TodayParts.tsx';
import { TodaySidebar } from './TodaySidebar.tsx';
import { ThisWeekInRows } from './TodayWeek.tsx';
import './today.css';

/** The demo's bell, with its sample's three unread. */
const ACTIONS: BannerActions = { create: true, unread: 3 };

function isMoment(name: string | null): name is MomentName {
  return MOMENTS.some((moment) => moment === name);
}

/** Where signing in lands at a desk (Today-B-Web.dc.html, page 29), on sample data. */
export function Today() {
  useSwitcherStart();
  const where = useWhere();
  const [params] = useSearchParams();
  const raw = params.get('moment');
  // A role without Create events: Events' firstAsk, on Today (sc-30413, #36412).
  const asks = raw === 'firstAsk' && !isFresh(where);
  const name = isFresh(where) || asks ? 'first' : isMoment(raw) ? raw : 'plan';
  // The demo's words are English, so its dates are too, in the browser's own region.
  const notSent = name === 'plan' && params.get('invites') === 'none';
  const later = name === 'plan' && params.get('starts') === 'later';
  const rows = name === 'plan' && params.get('week') === 'rows';
  const moment = useMemo(
    () =>
      momentOf(name, sayIn(formattingLocale('en', navigator.language)), {
        guests: notSent ? INVITES_NOT_SENT : undefined,
        first: asks ? VIEWERS.ana.name.split(' ')[0] : undefined,
        later,
        rows,
      }),
    [name, notSent, asks, later, rows],
  );
  const [told, setTold] = useState<string | null>(null);
  const tell = useCallback<Tell>((words) => setTold(words), []);
  const open = useCallback<Open>(
    (opens) =>
      tell(
        opens.to === 'event'
          ? `${opens.name} has its own design.`
          : opens.to === 'create'
            ? 'Create an event has its own design.'
            : opens.to === 'notifications'
              ? 'Notifications have their own design.'
              : opens.to === 'runOfShow'
                ? 'The run of show has its own design.'
                : opens.to === 'calendar'
                  ? 'Calendar has its own design.'
                  : 'Events has its own design.',
      ),
    [tell],
  );
  const page = useRef<HTMLElement>(null);
  const { layers, covered, setHost } = useDeskLayers();

  useEffect(() => {
    const search = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k' || !(event.metaKey || event.ctrlKey)) return;

      event.preventDefault();
      tell('Search has its own design.');
    };

    window.addEventListener('keydown', search);

    return () => window.removeEventListener('keydown', search);
  }, [tell]);

  if (inNone(where)) return <NoOrganisation />;

  return (
    <LayersContext value={layers}>
      <div className="today">
        <TodaySidebar
          events={moment.events.map(({ event }) => keyOf(event.id))}
          person={asks ? VIEWERS.ana : undefined}
          tell={tell}
          onToday={() => page.current?.scrollTo({ top: 0 })}
          inert={covered}
        />
        <main id="content" ref={page} className="today-main" inert={covered}>
          <Switched />
          {where.paused ? (
            <AccessPaused />
          ) : (
            <>
              {moment.now != null ? (
                <NowBanner now={moment.now} full={moment.full} actions={ACTIONS} open={open} />
              ) : (
                <Banner moment={moment} actions={ACTIONS} open={open} />
              )}
              {moment.kind === 'first' ? (
                <FirstRun open={open} create={!asks} />
              ) : (
                <div className="today-columns">
                  <div className="today-left">
                    <NeedsYou moment={moment} tell={tell} />
                    {rows ? (
                      <ThisWeekInRows moment={moment} open={open} />
                    ) : (
                      <ThisWeek moment={moment} open={open} />
                    )}
                  </div>
                  <div className="today-right">
                    <YourEvents moment={moment} open={open} />
                  </div>
                </div>
              )}
            </>
          )}
        </main>
        <div ref={setHost} className="desk desk-layers" />
        {told != null && <Toast key={told} words={told} onClose={() => setTold(null)} />}
      </div>
    </LayersContext>
  );
}
