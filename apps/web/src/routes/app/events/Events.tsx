import { type ListedEvent } from '@soirely/api-client';
import {
  EVENTS_TABS,
  type EventPhase,
  type EventsTab,
  eventDays,
  eventsHome,
  formatEventClock,
  formatEventShortDay,
  formatEventWeekday,
  howSoonPhrase,
  nextStep,
  rememberEventsTab,
  rememberedEventsTab,
  serverClock,
  shownPhase,
  withPastPage,
} from '@soirely/domain';
import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router';

import { api } from '../../../api.ts';
import { Refreshing } from '../../../components/OfflineBand.tsx';
import { Skeleton } from '../../../components/Skeleton.tsx';
import { dateLocale, useShownLanguage } from '../../../i18n/index.ts';
import { keepsWhatLoaded, useOffline } from '../../../offline.ts';
import { useServerNow } from '../../../serverNow.ts';
import { can, useSession } from '../../../session.ts';
import { useFocusOnceShown } from '../../../stepFocus.ts';
import { typeLabel } from './eventTypes.ts';
import { FirstRun } from './FirstRun.tsx';
import { StatusPill } from './MakeLive.tsx';
import { OutcomeLine } from './OutcomeLine.tsx';
import { Placeholder } from './Placeholder.tsx';

const PAST_PAGE = 10;

const TAB_WORD: Record<EventsTab, string> = {
  upcoming: 'events.tabUpcoming',
  drafts: 'events.tabDrafts',
  past: 'events.tabPast',
};

const EMPTY: Record<EventsTab, { title: string; line: string }> = {
  upcoming: { title: 'events.emptyUpcomingTitle', line: 'events.emptyUpcoming' },
  drafts: { title: 'events.emptyDraftsTitle', line: 'events.emptyDrafts' },
  past: { title: 'events.emptyPastTitle', line: 'events.emptyPast' },
};

const PLACEHOLDER_TILES = [
  'events.tileGuestsInvited',
  'events.tileRepliesIn',
  'events.tileNeedAttention',
];

const NOW_FIGURES = ['events.arrived', 'events.course', 'events.nextCue'];

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

export function Events() {
  const session = useSession();
  const organisation = session.organisation;
  const location = useLocation();
  const navigate = useNavigate();
  const [notice, setNotice] = useState(() => arrival(location.state));
  const [shownAt, setShownAt] = useState(location.key);

  if (location.key !== shownAt) {
    setShownAt(location.key);
    setNotice(
      arrival(location.state) ?? (notice?.replacing ? { ...notice, replacing: false } : null),
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
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [more, setMore] = useState<'idle' | 'loading' | 'failed'>('idle');
  const [shown, setShown] = useState('');
  const [tab, setTab] = useState<EventsTab>(() => rememberedEventsTab(organisationId));
  const title = useRef<HTMLHeadingElement>(null);
  const failedLine = useRef<HTMLParagraphElement>(null);
  const firstRunTitle = useRef<HTMLHeadingElement>(null);
  const home = useRef<HTMLDivElement>(null);
  const land = useFocusOnceShown();
  const now = useServerNow();
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

  const page = (summary: string | null, body: ReactNode) => (
    <div className="events">
      <div className="events-head">
        <div className="events-title">
          <h1 ref={title} tabIndex={-1}>
            {t('events.title')}
          </h1>
          {refreshing ? (
            <p className="events-summary">
              <Refreshing />
            </p>
          ) : (
            summary != null && <p className="events-summary">{summary}</p>
          )}
        </div>
        {creates && (
          <Link className="button button-primary" to="/app/events/new">
            {t('events.newEvent')}
          </Link>
        )}
      </div>
      {deleted != null && <OutcomeLine words={t('eventDelete.deleted', { event: deleted })} />}
      {body}
    </div>
  );

  if (load.kind === 'loading') {
    return page(null, <Skeleton words={t('events.loading')} shape="rows" rowHeight={76} />);
  }

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
    return page(null, <FirstRun creates={creates} title={firstRunTitle} />);
  }

  const grouped = eventsHome(load, now, dateLocale());
  const loaded = load;
  const counts: Record<EventsTab, number> = {
    upcoming: grouped.upcoming.length,
    drafts: grouped.drafts.length,
    past: grouped.pastCount,
  };
  const events =
    tab === 'upcoming' ? grouped.upcoming : tab === 'drafts' ? grouped.drafts : grouped.past;
  const parts = [
    grouped.happeningNow.length > 0 &&
      t('events.summaryHappeningNow', { count: grouped.happeningNow.length }),
    counts.upcoming > 0 && t('events.summaryUpcoming', { count: counts.upcoming }),
    counts.drafts > 0 && t('events.summaryDrafts', { count: counts.drafts }),
  ].filter((part) => part !== false);
  const summary =
    parts.length === 0
      ? null
      : parts.reduceRight((rest, first) => t('events.summaryJoin', { first, rest }));

  const showMore = () => {
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
        },
        () => setMore('failed'),
      );
  };

  return page(
    summary,
    <div className="events-home arrives" ref={home}>
      <ul className="events-tiles">
        <li className="events-tile">
          <span className="events-tile-label">{t('events.tileUpcoming')}</span>
          <span className="events-tile-number">{counts.upcoming}</span>
        </li>
        {PLACEHOLDER_TILES.map((label) => (
          <li key={label} className="events-tile">
            <Placeholder label={t(label)} labelClass="events-tile-label" />
          </li>
        ))}
      </ul>
      {grouped.happeningNow.length > 0 && (
        <section className="events-now" aria-labelledby="events-now-title">
          <h2 id="events-now-title" className="visually-hidden">
            {t('events.happeningNow')}
          </h2>
          <ul className="events-now-list">
            {grouped.happeningNow.map((event) => (
              <li key={event.id}>
                <HappeningNow event={event} now={now} />
              </li>
            ))}
          </ul>
        </section>
      )}
      <Tabs
        tab={tab}
        counts={counts}
        onChoose={(next) => {
          rememberEventsTab(organisationId, next);
          setTab(next);
        }}
      >
        <div className="events-table">
          <div className="events-table-head" aria-hidden="true">
            <span>{t('events.columnEvent')}</span>
            <span>{t('events.columnDates')}</span>
            <span>{t('events.columnStatus')}</span>
            <span>{t('events.columnGuests')}</span>
            <span>{t('events.columnReplies')}</span>
            <span>{t('events.columnNextStep')}</span>
          </div>
          {events.length === 0 ? (
            <EmptyTab tab={tab} />
          ) : (
            <ul className="events-list">
              {events.map((event) => (
                <li key={event.id}>
                  <EventRow event={event} phase={shownPhase(event, loaded.at, now)} now={now} />
                </li>
              ))}
            </ul>
          )}
          {tab === 'past' && grouped.past.length < grouped.pastCount && (
            <div className="events-more">
              <button
                type="button"
                className="button"
                disabled={more === 'loading'}
                onClick={showMore}
              >
                {t('events.showMore')}
              </button>
              {more === 'failed' && <p role="alert">{t('events.moreFailed')}</p>}
            </div>
          )}
          {tab === 'past' && (
            <p className="visually-hidden" aria-live="polite">
              {shown}
            </p>
          )}
          {counts[tab] > 0 && (
            <p className="events-footer">{t('events.footer', { count: counts[tab] })}</p>
          )}
        </div>
      </Tabs>
    </div>,
  );
}

/** A WAI-ARIA tab list: arrow keys, Home and End move between the three and choose as they go. */
function Tabs({
  tab,
  counts,
  onChoose,
  children,
}: {
  tab: EventsTab;
  counts: Record<EventsTab, number>;
  onChoose: (tab: EventsTab) => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const buttons = useRef<Partial<Record<EventsTab, HTMLButtonElement | null>>>({});

  const choose = (next: EventsTab, focus = false) => {
    onChoose(next);
    if (focus) buttons.current[next]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const at = EVENTS_TABS.indexOf(tab);
    const to = {
      ArrowRight: EVENTS_TABS[(at + 1) % EVENTS_TABS.length],
      ArrowLeft: EVENTS_TABS[(at + EVENTS_TABS.length - 1) % EVENTS_TABS.length],
      Home: EVENTS_TABS[0],
      End: EVENTS_TABS[EVENTS_TABS.length - 1],
    }[event.key];

    if (to == null) return;

    event.preventDefault();
    choose(to, true);
  };

  return (
    <div className="events-tabs">
      <div role="tablist" className="events-tab-list" aria-label={t('events.title')}>
        {EVENTS_TABS.map((one) => (
          <button
            key={one}
            ref={(button) => {
              buttons.current[one] = button;
            }}
            type="button"
            role="tab"
            id={`events-tab-${one}`}
            aria-controls={`events-panel-${one}`}
            aria-selected={one === tab}
            tabIndex={one === tab ? 0 : -1}
            className="events-tab"
            onClick={() => choose(one)}
            onKeyDown={onKeyDown}
          >
            {t(TAB_WORD[one])} <span className="events-tab-count">{counts[one]}</span>
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`events-panel-${tab}`}
        aria-labelledby={`events-tab-${tab}`}
        className="events-panel"
      >
        <h2 className="visually-hidden">{t(TAB_WORD[tab])}</h2>
        {children}
      </div>
    </div>
  );
}

function EmptyTab({ tab }: { tab: EventsTab }) {
  const { t } = useTranslation();

  return (
    <div className="events-empty">
      <h3>{t(EMPTY[tab].title)}</h3>
      <p className="muted">{t(EMPTY[tab].line)}</p>
    </div>
  );
}

function eventLink(event: ListedEvent): string {
  return `/app/events/${encodeURIComponent(event.id)}`;
}

/** One link for the whole event, with nothing to press inside it (sc-22103). */
function EventRow({ event, phase, now }: { event: ListedEvent; phase: EventPhase; now: Date }) {
  const { t } = useTranslation();
  const soon = useHowSoon(event, phase, now);

  return (
    <Link className="events-row" to={eventLink(event)}>
      <span className="events-row-event">
        <span className="events-row-name">{event.name}</span>
        <TypeAndPlace event={event} />
      </span>
      <span className="events-row-dates">
        <EventDates event={event} soon={soon} />
      </span>
      <span className="events-row-status">
        <StatusPill phase={phase} />
      </span>
      <Placeholder label={t('events.columnGuests')} labelHidden />
      <Placeholder label={t('events.columnReplies')} labelHidden />
      <span className="events-row-next">
        <NextStep event={event} phase={phase} now={now} />
      </span>
    </Link>
  );
}

function HappeningNow({ event, now }: { event: ListedEvent; now: Date }) {
  const { t } = useTranslation();
  const step = nextStep(event, 'happening_now', now);
  const soon = useHowSoon(event, 'happening_now', now);

  return (
    <Link className="events-now-card" to={eventLink(event)}>
      <span className="events-now-body">
        <span className="events-now-main">
          <span className="events-now-when">
            <span className="events-now-dates">
              <EventDates event={event} part="days" />
            </span>
            <StatusPill phase="happening_now" />
          </span>
          <span className="events-now-name">
            <span className="events-now-title">{event.name}</span>
            <TypeAndPlace event={event} />
          </span>
          <span className="muted">
            <EventDates event={event} part="time" soon={soon} />
          </span>
        </span>
        <span className="events-now-figures">
          {NOW_FIGURES.map((label) => (
            <Placeholder key={label} label={t(label)} />
          ))}
        </span>
      </span>
      {step?.kind === 'nextUp' && (
        <span className="events-now-next">
          <span className="events-now-next-word">{t('timeline.nextUp')}</span>{' '}
          <span>{step.milestone.title}</span>
        </span>
      )}
    </Link>
  );
}

function TypeAndPlace({ event }: { event: ListedEvent }) {
  const { t } = useTranslation();
  const place = event.venue?.name ?? event.venue?.address?.formatted ?? null;
  const type = typeLabel(event.type, t);

  return (
    <span className="events-type-place">
      {place == null ? type : t('events.typeAndPlace', { type, place })}
    </span>
  );
}

/** Its day or its first and last day, then its start and zone, all in the event's own zone, and how soon it is. */
function EventDates({
  event,
  part = 'both',
  soon = null,
}: {
  event: ListedEvent;
  part?: 'days' | 'time' | 'both';
  soon?: string | null;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const days = eventDays(event);

  if (days.kind === 'calledOffOn') {
    return part === 'time'
      ? null
      : t('events.calledOffOn', {
          date: formatEventShortDay(days.concludedAt, event.timeZone, locale),
        });
  }

  const first = formatEventWeekday(days.startsAt, event.timeZone, locale);
  const dates =
    days.kind === 'oneDay'
      ? first
      : t('events.days', { first, last: formatEventWeekday(days.endsAt, event.timeZone, locale) });
  const time = t('events.timeAndZone', {
    time: formatEventClock(event.startsAt, event.timeZone, locale),
    timeZone: event.timeZone,
  });
  const timeAndSoon =
    soon == null ? (
      time
    ) : (
      <>
        {t('events.thenSoon', { when: time })} <span className="events-soon">{soon}</span>
      </>
    );

  if (part === 'days') return dates;
  if (part === 'time') return timeAndSoon;

  return (
    <>
      <span>{dates}</span>
      <span className="muted events-row-time">{timeAndSoon}</span>
    </>
  );
}

/** "in 32 days", or "Ends tomorrow" once under way; null where the event has no phrase (sc-25008). */
function useHowSoon(event: ListedEvent, phase: EventPhase, now: Date): string | null {
  const { t } = useTranslation();
  const language = useShownLanguage();

  return howSoonPhrase(event, phase, now, language, (time) => t('events.endsIn', { time }));
}

function NextStep({ event, phase, now }: { event: ListedEvent; phase: EventPhase; now: Date }) {
  const { t } = useTranslation();
  const step = nextStep(event, phase, now);

  switch (step?.kind) {
    case undefined:
      return null;
    case 'makeLive':
      return t('events.nextMakeLive');
    case 'changeDates':
      return t('events.nextChangeDates');
    case 'resume':
      return t('events.nextResume');
    case 'nextUp':
      return (
        <>
          <span className="events-row-next-word">{t('timeline.nextUp')}</span>{' '}
          {step.milestone.title}
        </>
      );
  }
}

/** The deleted notice belongs to the entry Delete event lands on, which Events replaces once to drop its state, and to no other (sc-22103). */
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
