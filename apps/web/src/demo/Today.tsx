import { formattingLocale } from '@soirely/domain';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { Toast } from '../components/Toast.tsx';
import { AccessPaused, Switched } from './OrgSwitcher.tsx';
import { usePaused, useSwitcherStart } from './switcher.ts';
import { MOMENTS, type MomentName, momentOf, sayIn } from './today.ts';
import { Banner, NowBanner } from './TodayBanner.tsx';
import { FirstRun, NeedsYou, type Tell, ThisWeek, YourEvents } from './TodayParts.tsx';
import { TodaySidebar } from './TodaySidebar.tsx';
import './today.css';

function isMoment(name: string | null): name is MomentName {
  return MOMENTS.some((moment) => moment === name);
}

/** Where signing in lands at a desk (Today-B-Web.dc.html, page 29), on sample data. */
export function Today() {
  const [params] = useSearchParams();
  const raw = params.get('moment');
  const name = isMoment(raw) ? raw : 'plan';
  // The demo's words are English, so its dates are too, in the browser's own region.
  const moment = useMemo(
    () => momentOf(name, sayIn(formattingLocale('en', navigator.language))),
    [name],
  );
  const [told, setTold] = useState<string | null>(null);
  const tell = useCallback<Tell>((words) => setTold(words), []);
  const page = useRef<HTMLElement>(null);
  useSwitcherStart();
  const paused = usePaused();

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
    <div className="today">
      <TodaySidebar
        events={moment.events.map(({ event }) => event)}
        tell={tell}
        onToday={() => page.current?.scrollTo({ top: 0 })}
      />
      <main id="content" ref={page} className="today-main">
        <Switched />
        {paused ? (
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
      {told != null && <Toast key={told} words={told} onClose={() => setTold(null)} />}
    </div>
  );
}
