import { formattingLocale } from '@soirely/domain';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { Toast } from '../components/Toast.tsx';
import { LayersContext, useDeskLayers } from '../layers.ts';
import { NoOrganisation } from './NoOrganisation.tsx';
import { AccessPaused, Switched } from './OrgSwitcher.tsx';
import { inNone, isFresh, useSwitcherStart, useWhere } from './switcher.ts';
import { MOMENTS, type MomentName, momentOf, sayIn } from './today.ts';
import { Banner, NowBanner } from './TodayBanner.tsx';
import type { Tell } from '../components/SettingsParts.tsx';
import { FirstRun, NeedsYou, ThisWeek, YourEvents } from './TodayParts.tsx';
import { TodaySidebar } from './TodaySidebar.tsx';
import './today.css';

function isMoment(name: string | null): name is MomentName {
  return MOMENTS.some((moment) => moment === name);
}

/** Where signing in lands at a desk (Today-B-Web.dc.html, page 29), on sample data. */
export function Today() {
  useSwitcherStart();
  const where = useWhere();
  const [params] = useSearchParams();
  const raw = params.get('moment');
  const name = isFresh(where) ? 'first' : isMoment(raw) ? raw : 'plan';
  // The demo's words are English, so its dates are too, in the browser's own region.
  const moment = useMemo(
    () => momentOf(name, sayIn(formattingLocale('en', navigator.language))),
    [name],
  );
  const [told, setTold] = useState<string | null>(null);
  const tell = useCallback<Tell>((words) => setTold(words), []);
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
          events={moment.events.map(({ event }) => event)}
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
                <NowBanner now={moment.now} full={moment.full} tell={tell} />
              ) : (
                <Banner moment={moment} tell={tell} />
              )}
              {moment.kind === 'first' ? (
                <FirstRun tell={tell} />
              ) : (
                <div className="today-columns">
                  <div className="today-left">
                    <NeedsYou moment={moment} tell={tell} />
                    <ThisWeek moment={moment} tell={tell} />
                  </div>
                  <div className="today-right">
                    <YourEvents moment={moment} tell={tell} />
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
