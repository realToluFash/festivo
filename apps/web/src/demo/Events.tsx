import { DemoBell } from './DemoBell.tsx';
import { OfflineBox } from './DemoOffline.tsx';
import { Glyph } from '../components/Glyph.tsx';
import {
  type EventsLook,
  eventsLookOf,
  eventsLookParams,
  filtered,
  firstDayOfWeek,
  searching,
  whenSpan,
} from '@soirely/domain';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useSearchParams } from 'react-router';

import {
  EventsEmptyTab,
  EventsFirstRun,
  EventsFooter,
  EventsLoading,
  EventsTabs,
  EventsTop,
  NewEventWords,
} from '../components/EventsList.tsx';
import { type Calendar, EventsResults, EventsSearchRow } from '../components/EventsSearch.tsx';
import { summaryWords } from '../eventsList.ts';
import { dateLocale } from '../i18n/index.ts';

import {
  type SampleEvent,
  type Tab,
  CLOCKS,
  DISTINCT_HOSTS,
  EVENT_WORDS as W,
  PAST_PAGE,
  TABS,
  TODAY_IDS,
  listStart,
  listStateOf,
  listed,
  localDay,
  matches,
  rememberTab,
  rememberedTab,
  resetSample,
  sampleEvents,
  withoutTab,
} from './events.ts';
import { DuplicateDialog } from './EventDialogs.tsx';
import { duplicateStart } from './duplicate.ts';
import { GUEST_WORDS as G, SAMPLE_GUESTS, figureOf, guestCountsOf } from './guestCounts.ts';
import { guestLineOf } from './guests.ts';
import { EventCard, EventRow, EventsShell } from './EventParts.tsx';
import { TextAction } from '../components/SettingsParts.tsx';
import type { Tell } from '../components/SettingsParts.tsx';
import { TodaySidebar } from './TodaySidebar.tsx';
import { AccessPaused, Switched } from './OrgSwitcher.tsx';
import { SIDEBAR_EVENTS, VIEWERS } from './settings.ts';
import type { EventKey } from './today.ts';
import { isFresh, usePaused, useSwitcherStart, useWhere } from './switcher.ts';

/** Events at a desk in A · Summary first (Events-A-Desk, page 29): the list from the Today sidebar, on sample data. */
export function Events() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const state = listStateOf(params.get('state'));
  useSwitcherStart();
  const paused = usePaused();
  const fresh = isFresh(useWhere());
  const [told] = useState(() => (location.state as { told?: string } | null)?.told ?? null);
  const [start] = useState(() => {
    if (params.has('state')) resetSample();

    return listStart(state);
  });

  useEffect(() => {
    if (location.state == null) return;

    void navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location, navigate]);

  return (
    <EventsShell
      told={told}
      renderSide={(tell, covered) => (
        <TodaySidebar
          events={start.first || fresh ? [] : sidebarEvents(start.emptied)}
          tell={tell}
          listing
          person={start.asks ? VIEWERS.ana : VIEWERS.folake}
          inert={covered}
        />
      )}
    >
      {(tell) =>
        paused ? (
          <PausedPage />
        ) : (
          <EventsList
            key={fresh ? 'fresh' : 'sample'}
            start={fresh ? { ...start, first: true } : start}
            tell={tell}
          />
        )
      }
    </EventsShell>
  );
}

/** The sidebar's events as the page has them: an emptied tab's events leave the sidebar too. */
function sidebarEvents(emptied: Tab | null): EventKey[] {
  const events = sampleEvents();
  const kept = emptied == null ? events : withoutTab(events, emptied, CLOCKS.rest);

  return SIDEBAR_EVENTS.filter((key) => kept.some((event) => event.id === TODAY_IDS[key]));
}

function EventsList({ start, tell }: { start: ReturnType<typeof listStart>; tell: Tell }) {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const now = CLOCKS.rest;
  const [events] = useState<SampleEvent[]>(() => {
    if (start.first) return [];

    return start.emptied == null ? sampleEvents() : withoutTab(sampleEvents(), start.emptied, now);
  });
  const [tab, setTab] = useState<Tab>(start.tab ?? rememberedTab());
  const [offline, setOffline] = useState(start.offline);
  const [pastPages, setPastPages] = useState(start.pastPages);
  const [failed, setFailed] = useState(start.failed);
  const [moreFailed, setMoreFailed] = useState(start.moreFailed);
  const [copying, setCopying] = useState<SampleEvent | null>(null);
  const calendar: Calendar = {
    today: localDay(now, 'Europe/London'),
    firstDay: firstDayOfWeek(dateLocale()),
    locale: dateLocale(),
  };
  const addressed = ['q', 'type', 'from', 'to', 'host'].some((name) => params.has(name));
  const look =
    !addressed && start.look != null
      ? start.look
      : eventsLookOf(params, calendar.today, calendar.firstDay);
  const span = whenSpan(look.filters.when, calendar.today, calendar.firstDay);
  const lists = listed(events, now);
  const upcoming = [...lists.happeningNow, ...lists.upcoming];
  const byTab: Record<Tab, SampleEvent[]> = {
    upcoming,
    drafts: lists.drafts,
    past: lists.past,
  };
  const looking = searching(look.q) || filtered(look.filters);
  const counts: Record<Tab, number> = {
    upcoming: upcoming.length,
    drafts: lists.drafts.length,
    past: lists.past.length,
  };
  const summary = summaryWords(
    {
      happeningNow: lists.happeningNow.length,
      upcoming: lists.upcoming.length,
      drafts: lists.drafts.length,
    },
    t,
  );
  const guests = guestCountsOf(events, start.noGuests ? {} : SAMPLE_GUESTS, now);
  const guestsOf = (event: SampleEvent) => (start.noGuests ? null : guestLineOf(event.id));
  const firstNew = useRef<HTMLUListElement>(null);

  function apply(next: EventsLook, replace = false): void {
    const kept = new URLSearchParams(params);

    kept.delete('state');
    setParams(eventsLookParams(next, kept, calendar.today, calendar.firstDay), { replace });
  }

  function pick(next: Tab): void {
    setTab(next);
    rememberTab(next);
  }

  function stepOn(event: SampleEvent) {
    return (does: string) => {
      if (does === 'duplicate') setCopying(event);
      else if (does === 'makeLive') tell('Make live has its own design.');
      else void navigate(`/demo/events/${event.id}`, { state: { open: 'dates' } });
    };
  }

  if (start.loading)
    return (
      <div className="desk-page">
        <div className="ev-column">
          <ListTop tell={tell} />
          <Switched />
          <EventsSearchRow
            look={look}
            offline={false}
            waiting
            hosts={DISTINCT_HOSTS}
            calendar={calendar}
            onLook={apply}
          />
          <EventsLoading />
        </div>
      </div>
    );

  if (failed)
    return (
      <div className="desk-page">
        <div className="ev-column">
          <ListTop tell={tell} />
          <Switched />
          <div className="notice notice-broken" role="alert">
            <span className="mark mark-broken" aria-hidden="true">
              ✕
            </span>
            <div className="notice-body">
              <p>{t('events.failed')}</p>
              <button
                type="button"
                className="button button-primary"
                onClick={() => setFailed(false)}
              >
                {t('events.retry')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );

  if (events.length === 0)
    return (
      <div className="desk-page">
        <div className="ev-column">
          <ListTop tell={tell} creates={!start.asks} />
          <Switched />
          <FirstRun tell={tell} asks={start.asks} />
        </div>
      </div>
    );

  return (
    <div className="desk-page">
      <div className="ev-column">
        {offline && <OfflineBox onRetry={() => setOffline(false)} />}
        <div>
          <ListTop tell={tell} />
          {summary != null && <p className="desk-line">{summary}</p>}
        </div>
        <GuestTiles counts={guests} />
        <Switched />
        <EventsSearchRow
          look={look}
          offline={offline}
          hosts={DISTINCT_HOSTS}
          menuStart={start.menu}
          calendar={calendar}
          onLook={apply}
        />
        {looking ? (
          <EventsResults
            look={look}
            groups={TABS.map((one) => {
              const found = byTab[one].filter((event) => matches(event, look, span));

              return {
                tab: one,
                count: found.length,
                rows: found.map((event) => (
                  <EventRow key={event.id} event={event} now={now} tab="all" />
                )),
              };
            })}
            calendar={calendar}
            onLook={apply}
          />
        ) : (
          <>
            <EventsTabs tab={tab} counts={counts} onPick={pick}>
              {tab !== 'past' && byTab[tab][0] != null && (
                <EventCard
                  event={byTab[tab][0]}
                  now={now}
                  level={2}
                  guests={guestsOf(byTab[tab][0])}
                  onStep={stepOn(byTab[tab][0])}
                />
              )}
              {byTab[tab].length === 0 ? (
                <EventsEmptyTab tab={tab} />
              ) : (
                <ul className="desk-rows ev-rows" ref={firstNew}>
                  {(tab === 'past'
                    ? byTab.past.slice(0, PAST_PAGE * pastPages)
                    : byTab[tab].slice(1)
                  ).map((event) => (
                    <EventRow
                      key={event.id}
                      event={event}
                      now={now}
                      tab={tab}
                      guests={guestsOf(event)}
                    />
                  ))}
                </ul>
              )}
              {tab === 'past' && byTab.past.length > PAST_PAGE * pastPages && (
                <TextAction
                  label={W.showMore}
                  onClick={() => {
                    setMoreFailed(false);
                    setPastPages((pages) => pages + 1);
                    window.requestAnimationFrame(() => {
                      const links = firstNew.current?.querySelectorAll<HTMLElement>('a');

                      links?.[PAST_PAGE * pastPages]?.focus();
                    });
                  }}
                />
              )}
              {tab === 'past' && moreFailed && (
                <p className="desk-error" role="alert">
                  <Glyph name="alert" size={15} weight={2.2} />
                  {t('events.moreFailed')}
                </p>
              )}
              {tab === 'past' && pastPages > 1 && (
                <p className="desk-note" role="status">
                  {W.moreShown(Math.min(byTab.past.length, PAST_PAGE * pastPages) - PAST_PAGE)}
                </p>
              )}
              {byTab[tab].length > 0 && <EventsFooter count={byTab[tab].length} />}
            </EventsTabs>
          </>
        )}
      </div>
      {copying != null && (
        <DuplicateDialog
          event={copying}
          start={duplicateStart(null, copying.id)}
          onDismiss={() => setCopying(null)}
          onCreated={(words) => {
            setCopying(null);
            tell(words);
          }}
        />
      )}
    </div>
  );
}

function GuestTiles({ counts }: { counts: ReturnType<typeof guestCountsOf> }) {
  return (
    <ul className="ev-guests" aria-label={G.label}>
      <li className="ev-guest">
        <span className="ev-guest-name">{G.invited}</span>
        <span className="ev-guest-figure">{figureOf(counts.invited)}</span>
        <span className="ev-guest-line">{G.coming(counts.coming)}</span>
      </li>
      <li className="ev-guest">
        <span className="ev-guest-name">{G.replied}</span>
        <span className="ev-guest-figure">{figureOf(counts.replied)}</span>
        <span className="ev-guest-line">{G.notReplied(counts.notReplied)}</span>
      </li>
    </ul>
  );
}

function PausedPage() {
  return (
    <div className="desk-page">
      <Switched />
      <AccessPaused />
    </div>
  );
}

function ListTop({ tell, creates = true }: { tell: Tell; creates?: boolean }) {
  const navigate = useNavigate();

  return (
    <EventsTop
      newEvent={
        creates && (
          <button
            type="button"
            className="ev-new"
            onClick={() => void navigate('/demo/events/new')}
          >
            <NewEventWords />
          </button>
        )
      }
    >
      <DemoBell tell={tell} />
    </EventsTop>
  );
}

/** The product's first run, its Create telling what it opens, and for a role without Create events the ask-an-owner Notice. */
export function FirstRun({ tell, asks = false }: { tell: Tell; asks?: boolean }) {
  return (
    <EventsFirstRun create={asks ? undefined : () => tell('Create an event has its own design.')} />
  );
}
