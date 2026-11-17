import { formattingLocale } from '@soirely/domain';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';

import { Toast } from '../components/Toast.tsx';
import { LayersContext, useDeskLayers } from '../layers.ts';
import { NoOrganisation } from './NoOrganisation.tsx';
import { VIEWERS } from './settings.ts';
import { AccessPaused, Switched } from './OrgSwitcher.tsx';
import { inNone, isFresh, useSwitcherStart, useWhere } from './switcher.ts';
import {
  EVENTS,
  INVITES_NOT_SENT,
  isNeedsState,
  keyOf,
  MOMENTS,
  type MomentName,
  momentOf,
  sayIn,
} from './today.ts';
import type { Tell } from '../components/SettingsParts.tsx';
import type { Open } from '../components/today.ts';
import { Banner, type BannerActions, NowBanner } from '../components/TodayBanner.tsx';
import { FirstRun, ThisWeek, YourEvents } from '../components/TodayParts.tsx';
import { NeedsYou } from './TodayParts.tsx';
import { TodaySidebar } from './TodaySidebar.tsx';
import { RunNowBanner } from './TodayNow.tsx';
import { isNowState, runNowOf, trackAt } from './todayRun.ts';
import { nightAtUrl } from './night.ts';
import { isLong, LONG_NAME, renamed } from './longName.ts';
import { DeskSearch } from './Search.tsx';
import { REACHES, reachOfRole, type SearchStart } from './search.ts';
import type { DeskPerson } from '../components/DeskSidebar.tsx';
import './today.css';
import './phone.css';

/** The demo's bell, with its sample's three unread. */
const ACTIONS: BannerActions = { create: true, bell: { unread: 3 } };

function isMoment(name: string | null): name is MomentName {
  return MOMENTS.some((moment) => moment === name);
}

/** Who is searching in the states drawn for a role other than an owner's: a Member, a custom role without guests, and one that can find nothing. */
const SEARCHERS = new Map<SearchStart['reach'], DeskPerson>([
  [REACHES.member, { name: 'Kemi Adebayo', initials: 'KA', role: 'Member' }],
  [REACHES.planner, { name: 'Ngozi Eze', initials: 'NE', role: 'Planner' }],
  [REACHES.nobody, { name: 'Tobi Bello', initials: 'TB', role: 'Front desk' }],
]);

/** Where signing in lands at a desk (Today-B-Web.dc.html, page 29), on sample data; `search` opens with the palette over it. */
export function Today({ search = null }: { search?: SearchStart | null }) {
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
  const long = isLong(params);
  const rawNeeds = params.get('needs');
  const needing = name === 'plan' && isNeedsState(rawNeeds) ? rawNeeds : undefined;
  const rawNow = params.get('now');
  const nowState = isNowState(rawNow) ? rawNow : 'on';
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const locale = formattingLocale(language, navigator.language);
  // On the event day, a role with run_of_show.read sees the run of show (sc-61017); `?now=` picks the moment, as the app's demo does.
  const run = useMemo(() => {
    const { clock, items } = trackAt(nowState);

    return runNowOf(items, clock);
  }, [nowState]);
  const moment = useMemo(
    () =>
      renamed(
        momentOf(name, sayIn(formattingLocale('en', navigator.language)), {
          guests: notSent ? INVITES_NOT_SENT : undefined,
          first: asks ? VIEWERS.ana.name.split(' ')[0] : undefined,
          later,
          rows,
          needing,
        }),
        EVENTS.ireti.name,
        long ? LONG_NAME : EVENTS.ireti.name,
      ),
    [name, notSent, asks, later, rows, long, needing],
  );
  const [told, setTold] = useState<string | null>(null);
  const tell = useCallback<Tell>((words) => setTold(words), []);
  const navigate = useNavigate();
  const open = useCallback<Open>(
    (opens) =>
      // The night page (sc-3895) only stands in for where Open run of show lands: its sample event and track are its own, so its Now is not Today's. In the product both read one track.
      opens.to === 'runOfShow' && moment.full
        ? void navigate(nightAtUrl())
        : tell(
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
    [tell, navigate, moment.full],
  );
  const page = useRef<HTMLElement>(null);
  const { layers, covered, setHost } = useDeskLayers();

  if (inNone(where)) return <NoOrganisation />;

  return (
    <LayersContext value={layers}>
      <div className="today dp-fit fits-phone">
        <DeskSearch
          first={search}
          reach={asks ? reachOfRole(VIEWERS.ana.role) : REACHES.owner}
          tell={tell}
        >
          <TodaySidebar
            phone
            events={moment.events.map(({ event }) => keyOf(event.id))}
            person={asks ? VIEWERS.ana : search == null ? undefined : SEARCHERS.get(search.reach)}
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
                {moment.now != null && moment.full ? (
                  <RunNowBanner
                    now={moment.now}
                    run={run}
                    actions={ACTIONS}
                    open={open}
                    language={language}
                    locale={locale}
                  />
                ) : moment.now != null ? (
                  <NowBanner now={moment.now} full={false} actions={ACTIONS} open={open} />
                ) : (
                  <Banner moment={moment} actions={ACTIONS} open={open} />
                )}
                {moment.kind === 'first' ? (
                  <FirstRun open={open} create={!asks} />
                ) : (
                  <div className="today-columns">
                    <div className="today-left">
                      <NeedsYou moment={moment} />
                      <ThisWeek moment={moment} open={open} />
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
        </DeskSearch>
        {told != null && <Toast key={told} words={told} onClose={() => setTold(null)} />}
      </div>
    </LayersContext>
  );
}
