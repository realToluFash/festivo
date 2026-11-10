import { type ListedEvent } from '@soirely/api-client';
import {
  type EventsLook,
  type EventsSearch,
  type EventsTab,
  eventsHome,
  eventsLookOf,
  eventsLookParams,
  eventsSearchOf,
  firstDayOfWeek,
  rememberEventsTab,
  rememberedEventsTab,
  serverClock,
  shownPhase,
  takesCardStep,
  wallDay,
  withPastPage,
} from '@soirely/domain';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Link,
  NavigationType,
  useLocation,
  useNavigate,
  useNavigationType,
  useSearchParams,
} from 'react-router';

import { api } from '../../../api.ts';
import { type ButtonStep, EventCard } from '../../../components/EventCard.tsx';
import {
  EventRow,
  EventsEmptyTab,
  EventsFirstRun,
  EventsFooter,
  EventsLoading,
  EventsTabs,
  EventsTop,
  NewEventWords,
} from '../../../components/EventsList.tsx';
import {
  type Calendar,
  EventsReadOut,
  EventsResults,
  EventsSearchRow,
  type ResultsGroup,
} from '../../../components/EventsSearch.tsx';
import { Glyph } from '../../../components/Glyph.tsx';
import { Refreshing } from '../../../components/OfflineBand.tsx';
import { TextAction } from '../../../components/SettingsParts.tsx';
import { type Shown, listEventOf, shownEvent, summaryWords } from '../../../eventsList.ts';
import { dateLocale } from '../../../i18n/index.ts';
import { keepsWhatLoaded, useOffline } from '../../../offline.ts';
import { useServerNow } from '../../../serverNow.ts';
import { can, useSession } from '../../../session.ts';
import { useFocusOnceShown } from '../../../stepFocus.ts';
import { DuplicateDialog } from './DuplicateEvent.tsx';
import { OutcomeLine } from './OutcomeLine.tsx';

const PAST_PAGE = 10;

type Load =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | {
      kind: 'loaded';
      unfinished: ListedEvent[];
      past: ListedEvent[];
      pastTotal: number;
      pastPages: number;
      at: Date;
    };

type Found =
  | { search: string; kind: 'loading' }
  | { search: string; kind: 'failed' }
  | {
      search: string;
      kind: 'loaded';
      unfinished: ListedEvent[];
      past: ListedEvent[];
      at: Date;
    };

function readerZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function Events() {
  const session = useSession();
  const organisation = session.organisation;
  const location = useLocation();
  const navigate = useNavigate();
  const returned = useNavigationType() === NavigationType.Pop;
  const [notice, setNotice] = useState(() => (returned ? null : arrival(location.state)));
  const [shownAt, setShownAt] = useState(location.key);

  if (location.key !== shownAt) {
    setShownAt(location.key);
    setNotice(
      returned
        ? null
        : (arrival(location.state) ?? (notice?.replacing ? { ...notice, replacing: false } : null)),
    );
  }

  useEffect(() => {
    if (deletedEvent(location.state) == null) return;

    void navigate(
      { pathname: location.pathname, search: location.search, hash: location.hash },
      { replace: true, state: null },
    );
  }, [location, navigate]);

  if (organisation == null) return null;

  return (
    <EventsOf
      key={organisation.id}
      organisationId={organisation.id}
      creates={can(session, 'events.create')}
      deleted={notice?.event ?? null}
    />
  );
}

function eventLink(event: { id: string }): string {
  return `/app/events/${encodeURIComponent(event.id)}`;
}

/** Events as its demo draws it (sc-30413): the search and Filter (sc-30302), the tabs, the soonest event as the card, then its rows; Past ten at a time. While something is searched or filtered, one set of results instead of the tabs. */
function EventsOf({
  organisationId,
  creates,
  deleted,
}: {
  organisationId: string;
  creates: boolean;
  deleted: string | null;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [more, setMore] = useState<'idle' | 'loading' | 'failed'>('idle');
  const [shown, setShown] = useState<string | null>(null);
  const [tab, setTab] = useState<EventsTab>(() => rememberedEventsTab(organisationId));
  const [copying, setCopying] = useState<ListedEvent | null>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const failedLine = useRef<HTMLParagraphElement>(null);
  const firstRunTitle = useRef<HTMLHeadingElement>(null);
  const home = useRef<HTMLDivElement>(null);
  const rows = useRef<HTMLUListElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const land = useFocusOnceShown();
  const now = useServerNow();
  const locale = dateLocale();
  const [params, setParams] = useSearchParams();
  const calendar: Calendar = {
    today: wallDay(now, readerZone()),
    firstDay: firstDayOfWeek(locale),
    locale,
  };
  const look = eventsLookOf(params, calendar.today, calendar.firstDay);
  const search = eventsSearchOf(look, calendar.today, calendar.firstDay);
  const searchKey = search == null ? null : JSON.stringify(search);
  const [found, setFound] = useState<Found | null>(null);
  const [searchAttempt, setSearchAttempt] = useState(0);
  const [hosts, setHosts] = useState<readonly string[]>([]);
  const { watch, refreshing } = useOffline({
    loaded: load.kind === 'loaded',
    reload: () => setRefresh((n) => n + 1),
    title,
  });

  useEffect(() => {
    let current = true;

    watch(
      Promise.all([
        api.unfinishedEvents(organisationId),
        api.events(organisationId, { finished: true, itemsPerPage: PAST_PAGE }),
      ]),
    ).then(
      ([unfinished, past]) =>
        current &&
        setLoad({
          kind: 'loaded',
          unfinished,
          past: past.events,
          pastTotal: past.total,
          pastPages: 1,
          at: serverClock.now(),
        }),
      (error: unknown) =>
        current &&
        setLoad((was) =>
          was.kind === 'loaded' && keepsWhatLoaded(error) ? was : { kind: 'failed' },
        ),
    );

    return () => {
      current = false;
    };
  }, [organisationId, attempt, refresh, watch]);

  useEffect(() => {
    let current = true;

    api.eventHosts(organisationId).then(
      (names) => current && setHosts(names),
      () => undefined,
    );

    return () => {
      current = false;
    };
  }, [organisationId, refresh]);

  useEffect(() => {
    if (searchKey == null) return;

    let current = true;

    watch(api.searchedEvents(organisationId, JSON.parse(searchKey) as EventsSearch)).then(
      ({ unfinished, past }) =>
        current &&
        setFound({ search: searchKey, kind: 'loaded', unfinished, past, at: serverClock.now() }),
      (error: unknown) =>
        current &&
        setFound((was) =>
          was?.kind === 'loaded' && was.search === searchKey && keepsWhatLoaded(error)
            ? was
            : { search: searchKey, kind: 'failed' },
        ),
    );

    return () => {
      current = false;
    };
  }, [organisationId, searchKey, searchAttempt, refresh, watch]);

  const onLook = (next: EventsLook, typing = false) =>
    setParams(eventsLookParams(next, params, calendar.today, calendar.firstDay), {
      replace: typing,
    });

  const page = (summary: string | null, body: ReactNode) => (
    <div className="desk ev">
      <div className="ev-column">
        <div>
          <EventsTop
            title={title}
            newEvent={
              creates && (
                <Link className="ev-new" to="/app/events/new">
                  <NewEventWords />
                </Link>
              )
            }
          />
          {refreshing ? (
            <p className="desk-line">
              <Refreshing />
            </p>
          ) : (
            summary != null && <p className="desk-line">{summary}</p>
          )}
        </div>
        {deleted != null && <OutcomeLine words={t('eventDelete.deleted', { event: deleted })} />}
        {body}
      </div>
    </div>
  );

  const searchRow = (waiting: boolean) => (
    <EventsSearchRow
      look={look}
      offline={false}
      waiting={waiting}
      hosts={hosts}
      calendar={calendar}
      onLook={onLook}
    />
  );

  if (load.kind === 'loading')
    return page(
      null,
      <>
        {searchRow(true)}
        <EventsLoading />
      </>,
    );

  if (load.kind === 'failed') {
    return page(
      null,
      <div className="notice notice-broken" role={attempt > 0 ? undefined : 'alert'}>
        <span className="mark mark-broken" aria-hidden="true">
          ✕
        </span>
        <div className="notice-body">
          <p ref={failedLine} tabIndex={-1}>
            {t('events.failed')}
          </p>
          <button
            type="button"
            className="button button-primary"
            onClick={() => {
              setLoad({ kind: 'loading' });
              setAttempt((n) => n + 1);
              land(
                () =>
                  failedLine.current ??
                  firstRunTitle.current ??
                  (home.current == null ? null : title.current),
              );
            }}
          >
            {t('events.retry')}
          </button>
        </div>
      </div>,
    );
  }

  if (load.unfinished.length === 0 && load.pastTotal === 0) {
    return page(
      null,
      <EventsFirstRun create={creates ? '/app/events/new' : undefined} title={firstRunTitle} />,
    );
  }

  const loaded = load;
  const grouped = eventsHome(loaded, now, locale);
  const shownOf = (events: readonly ListedEvent[]) =>
    events.map((event) => shownEvent(listEventOf(event), shownPhase(event, loaded.at, now)));
  const tabs: Record<EventsTab, Shown[]> = {
    upcoming: shownOf([...grouped.happeningNow, ...grouped.upcoming]),
    drafts: shownOf(grouped.drafts),
    past: shownOf(grouped.past),
  };
  const counts: Record<EventsTab, number> = {
    upcoming: tabs.upcoming.length,
    drafts: tabs.drafts.length,
    past: grouped.pastCount,
  };
  const events = tabs[tab];
  const card = tab === 'past' ? null : (events[0] ?? null);
  const listed = tab === 'past' ? events : events.slice(1);
  const summary = summaryWords(
    {
      happeningNow: grouped.happeningNow.length,
      upcoming: grouped.upcoming.length,
      drafts: grouped.drafts.length,
    },
    t,
  );
  const loadedEvent = (id: string) =>
    [...loaded.unfinished, ...loaded.past].find((event) => event.id === id) ?? null;

  const showMore = () => {
    if (more === 'loading') return;

    const before = loaded.past.length;

    setMore('loading');
    api
      .events(organisationId, {
        finished: true,
        page: loaded.pastPages + 1,
        itemsPerPage: PAST_PAGE,
      })
      .then(
        (next) => {
          const read = withPastPage(loaded, next, PAST_PAGE);

          setLoad(read.load);
          setShown(t('events.moreShown', { count: read.added }));
          setMore('idle');
          window.requestAnimationFrame(() =>
            rows.current?.querySelectorAll<HTMLElement>('a')[before]?.focus(),
          );
        },
        () => setMore('failed'),
      );
  };

  const onStep = (event: Shown, step: ButtonStep) => {
    if (step.action === 'duplicate') {
      opener.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setCopying(loadedEvent(event.id));
    } else if (step.action === 'changeDates') {
      void navigate(`${eventLink(event)}/edit#starts`);
    } else {
      void navigate(eventLink(event));
    }
  };

  const matchedGroups = ((): ResultsGroup[] | null => {
    if (search == null || found?.kind !== 'loaded') return null;

    const matched = eventsHome({ ...found, pastTotal: found.past.length }, now, locale);
    const shownMatched = (events: readonly ListedEvent[]) =>
      events.map((event) => shownEvent(listEventOf(event), shownPhase(event, found.at, now)));
    return (
      [
        ['upcoming', [...matched.happeningNow, ...matched.upcoming]],
        ['drafts', matched.drafts],
        ['past', matched.past],
      ] as const
    ).map(([group, events]) => ({
      tab: group,
      count: events.length,
      rows: shownMatched(events).map((event) => (
        <EventRow
          key={event.id}
          event={event}
          now={now}
          locale={locale}
          to={eventLink(event)}
          everyPhase
        />
      )),
    }));
  })();

  const results = () => {
    if (found?.kind === 'failed' && found.search === searchKey)
      return (
        <div className="notice notice-broken" role="alert">
          <span className="mark mark-broken" aria-hidden="true">
            ✕
          </span>
          <div className="notice-body">
            <p>{t('events.failed')}</p>
            <button
              type="button"
              className="button button-primary"
              onClick={() => {
                setFound({ search: found.search, kind: 'loading' });
                setSearchAttempt((n) => n + 1);
              }}
            >
              {t('events.retry')}
            </button>
          </div>
        </div>
      );

    if (matchedGroups == null) return <EventsLoading />;

    return <EventsResults look={look} groups={matchedGroups} calendar={calendar} onLook={onLook} />;
  };

  return page(
    summary,
    <>
      {searchRow(false)}
      {search != null ? (
        <div className="ev-column">
          <EventsReadOut groups={matchedGroups} />
          {results()}
        </div>
      ) : (
        <div className="ev-column arrives" ref={home}>
          <EventsTabs
            tab={tab}
            counts={counts}
            onPick={(next) => {
              rememberEventsTab(organisationId, next);
              setTab(next);
            }}
          >
            {card != null && (
              <EventCard
                event={card}
                now={now}
                locale={locale}
                level={2}
                to={eventLink(card)}
                takes={(action) => {
                  const event = loadedEvent(card.id);

                  return event != null && takesCardStep(event, action);
                }}
                onStep={(step) => onStep(card, step)}
              />
            )}
            {events.length === 0 ? (
              <EventsEmptyTab tab={tab} />
            ) : (
              <ul className="desk-rows ev-rows" ref={rows}>
                {listed.map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    now={now}
                    locale={locale}
                    to={eventLink(event)}
                  />
                ))}
              </ul>
            )}
            {tab === 'past' && grouped.past.length < grouped.pastCount && (
              <TextAction label={t('events.showMore')} onClick={showMore} />
            )}
            {tab === 'past' && more === 'failed' && (
              <p className="desk-error" role="alert">
                <Glyph name="alert" size={15} weight={2.2} />
                {t('events.moreFailed')}
              </p>
            )}
            {tab === 'past' && shown != null && (
              <p className="desk-note" role="status">
                {shown}
              </p>
            )}
            {counts[tab] > 0 && <EventsFooter count={counts[tab]} />}
          </EventsTabs>
        </div>
      )}
      {copying != null && (
        <DuplicateDialog
          event={copying}
          onClose={() => {
            setCopying(null);
            window.setTimeout(() => opener.current?.focus(), 0);
          }}
        />
      )}
    </>,
  );
}

/** The deleted notice belongs to the entry Delete event lands on, which Events replaces once to drop its state, and to no other: Back, Forward or a reload can reach an entry whose replace never landed (sc-22103). */
function arrival(state: unknown): { event: string; replacing: boolean } | null {
  const event = deletedEvent(state);

  return event == null ? null : { event, replacing: true };
}

/** Set by Delete event on its way to the Events list, which says the event was deleted. */
function deletedEvent(state: unknown): string | null {
  const deleted =
    typeof state === 'object' && state != null && 'deletedEvent' in state
      ? state.deletedEvent
      : null;

  return typeof deleted === 'string' ? deleted : null;
}
