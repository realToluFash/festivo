import { type ListedEvent } from '@soirely/api-client';
import {
  calledOff,
  eventsHome,
  formatEventClock,
  formatEventShortDay,
  formatEventWeekday,
  nextUp,
  serverClock,
  shownPhase,
  withPastPage,
} from '@soirely/domain';
import {
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router';

import { api } from '../../../api.ts';
import { dateLocale } from '../../../i18n/index.ts';
import { useServerNow } from '../../../serverNow.ts';
import { can, useSession } from '../../../session.ts';
import { useFocusOnceShown } from '../../../stepFocus.ts';
import { EventCoverImage } from './EventCoverImage.tsx';
import { typeLabel } from './eventTypes.ts';
import { StatusPill } from './MakeLive.tsx';
import { OutcomeLine } from './OutcomeLine.tsx';
import { distanceWords } from './distanceWords.ts';
import { TABS, type Tab, rememberTab, rememberedTab } from './eventsTab.ts';

const PAST_PAGE = 10;

const TAB_WORD: Record<Tab, string> = {
  upcoming: 'events.tabUpcoming',
  drafts: 'events.tabDrafts',
  past: 'events.tabPast',
};

const EMPTY: Record<Tab, { title: string; line: string }> = {
  upcoming: { title: 'events.emptyUpcomingTitle', line: 'events.emptyUpcoming' },
  drafts: { title: 'events.emptyDraftsTitle', line: 'events.emptyDrafts' },
  past: { title: 'events.emptyPastTitle', line: 'events.emptyPast' },
};

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
  const { t } = useTranslation();
  const session = useSession();
  const organisation = session.organisation;
  const title = useRef<HTMLHeadingElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [deleted] = useState(() => deletedEvent(location.state));

  useEffect(() => {
    if (deletedEvent(location.state) == null) return;

    void navigate(
      { pathname: location.pathname, search: location.search, hash: location.hash },
      { replace: true, state: null },
    );
  }, [location, navigate]);

  if (organisation == null) return null;

  const creates = can(session, 'events.create');

  return (
    <div className="events">
      <div className="events-head">
        <h1 ref={title} tabIndex={-1}>
          {t('events.title')}
        </h1>
        {creates && (
          <Link className="button button-primary" to="/app/events/new">
            {t('events.newEvent')}
          </Link>
        )}
      </div>
      {deleted != null && <OutcomeLine words={t('eventDelete.deleted', { event: deleted })} />}
      <EventsOf
        key={organisation.id}
        organisationId={organisation.id}
        creates={creates}
        title={title}
      />
    </div>
  );
}

function EventsOf({
  organisationId,
  creates,
  title,
}: {
  organisationId: string;
  creates: boolean;
  title: RefObject<HTMLHeadingElement | null>;
}) {
  const { t } = useTranslation();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [more, setMore] = useState<'idle' | 'loading' | 'failed'>('idle');
  const [shown, setShown] = useState('');
  const [tab, setTab] = useState<Tab>(() => rememberedTab(organisationId));
  const failedLine = useRef<HTMLParagraphElement>(null);
  const firstRunTitle = useRef<HTMLHeadingElement>(null);
  const home = useRef<HTMLDivElement>(null);
  const land = useFocusOnceShown();
  const now = useServerNow();

  useEffect(() => {
    let current = true;

    Promise.all([
      api.unfinishedEvents(organisationId),
      api.events(organisationId, { finished: true, itemsPerPage: PAST_PAGE }),
    ]).then(
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
      () => current && setLoad({ kind: 'failed' }),
    );

    return () => {
      current = false;
    };
  }, [organisationId, attempt]);

  if (load.kind === 'loading') {
    return (
      <p className="muted" role="status">
        {t('events.loading')}
      </p>
    );
  }

  if (load.kind === 'failed') {
    return (
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
            className="button"
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
      </div>
    );
  }

  if (load.unfinished.length === 0 && load.pastTotal === 0) {
    return <FirstRun creates={creates} title={firstRunTitle} />;
  }

  const grouped = eventsHome(load, now, dateLocale());
  const loaded = load;
  const events =
    tab === 'upcoming' ? grouped.upcoming : tab === 'drafts' ? grouped.drafts : grouped.past;

  const showMore = () => {
    setMore('loading');
    api
      .events(organisationId, {
        finished: true,
        page: loaded.pastPages + 1,
        itemsPerPage: PAST_PAGE,
      })
      .then(
        (page) => {
          const read = withPastPage(loaded, page, PAST_PAGE);

          setLoad(read.load);
          setShown(t('events.moreShown', { count: read.added }));
          setMore('idle');
        },
        () => setMore('failed'),
      );
  };

  return (
    <div className="events-home" ref={home}>
      {grouped.happeningNow.length > 0 && (
        <section className="events-now" aria-labelledby="events-now-title">
          <h2 id="events-now-title" className="visually-hidden">
            {t('events.happeningNow')}
          </h2>
          <ul className="events-now-list">
            {grouped.happeningNow.map((event) => (
              <li key={event.id}>
                <EventCard event={event} phase="happening_now" now={now} large />
              </li>
            ))}
          </ul>
        </section>
      )}
      <Tabs
        tab={tab}
        counts={{
          upcoming: grouped.upcoming.length,
          drafts: grouped.drafts.length,
          past: grouped.pastCount,
        }}
        onChoose={(next) => {
          rememberTab(organisationId, next);
          setTab(next);
        }}
      >
        {events.length === 0 ? (
          <EmptyTab tab={tab} />
        ) : (
          <ul className="card events-list">
            {events.map((event) => (
              <li key={event.id}>
                <EventCard event={event} phase={shownPhase(event, loaded.at, now)} now={now} />
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
      </Tabs>
    </div>
  );
}

/** A WAI-ARIA tab list: arrow keys, Home and End move between the three and choose as they go. */
function Tabs({
  tab,
  counts,
  onChoose,
  children,
}: {
  tab: Tab;
  counts: Record<Tab, number>;
  onChoose: (tab: Tab) => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const buttons = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});

  const choose = (next: Tab, focus = false) => {
    onChoose(next);
    if (focus) buttons.current[next]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const at = TABS.indexOf(tab);
    const to = {
      ArrowRight: TABS[(at + 1) % TABS.length],
      ArrowLeft: TABS[(at + TABS.length - 1) % TABS.length],
      Home: TABS[0],
      End: TABS[TABS.length - 1],
    }[event.key];

    if (to == null) return;

    event.preventDefault();
    choose(to, true);
  };

  return (
    <div className="events-tabs">
      <div role="tablist" className="events-tab-list" aria-label={t('events.title')}>
        {TABS.map((one) => (
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

function EmptyTab({ tab }: { tab: Tab }) {
  const { t } = useTranslation();

  return (
    <div className="card events-empty">
      <h3>{t(EMPTY[tab].title)}</h3>
      <p className="muted">{t(EMPTY[tab].line)}</p>
    </div>
  );
}

function EventCard({
  event,
  phase,
  now,
  large = false,
}: {
  event: ListedEvent;
  phase: ReturnType<typeof shownPhase>;
  now: Date;
  large?: boolean;
}) {
  const { t } = useTranslation();
  const next = nextUp(event.milestones, now);
  const place = event.venue?.name ?? event.venue?.address?.formatted ?? null;

  return (
    <article className={large ? 'events-card events-card-now' : 'events-card'}>
      <EventCoverImage
        photo={event.cover}
        type={event.type}
        sizes={large ? '12rem' : '6rem'}
        className="events-card-cover"
      />
      <div className="events-card-body">
        <StatusPill phase={phase} />
        <Link className="events-card-name" to={`/app/events/${encodeURIComponent(event.id)}`}>
          {event.name}
        </Link>
        <span className="muted">
          {place == null
            ? typeLabel(event.type, t)
            : t('events.typeAndPlace', { type: typeLabel(event.type, t), place })}
        </span>
        {next != null && (
          <span className="events-card-next">
            <span className="events-card-next-word">{t('timeline.nextUp')}</span> {next.title}
            {next.action != null && (
              <>
                {' '}
                <Link className="events-card-action" to={next.action.link}>
                  {next.action.label}
                </Link>
              </>
            )}
          </span>
        )}
      </div>
      <span className="muted events-card-date">
        <CardDate event={event} phase={phase} now={now} />
      </span>
    </article>
  );
}

function CardDate({
  event,
  phase,
  now,
}: {
  event: ListedEvent;
  phase: ReturnType<typeof shownPhase>;
  now: Date;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();

  if (phase === 'happening_now') {
    return t('events.startedToday', {
      time: formatEventClock(event.startsAt, event.timeZone, locale),
      timeZone: event.timeZone,
    });
  }

  if (phase === 'finished' && calledOff(event) && event.concludedAt != null) {
    return t('events.calledOffOn', {
      date: formatEventShortDay(event.concludedAt, event.timeZone, locale),
    });
  }

  return t('events.dateAway', {
    date: formatEventWeekday(event.startsAt, event.timeZone, locale),
    distance: distanceWords(t, event.startsAt, event.timeZone, now),
  });
}

function FirstRun({
  creates,
  title,
}: {
  creates: boolean;
  title: RefObject<HTMLHeadingElement | null>;
}) {
  const { t } = useTranslation();
  const steps = [
    'events.firstRunStepName',
    'events.firstRunStepDefaults',
    'events.firstRunStepOpen',
  ];

  return (
    <section className="card events-first-run" aria-labelledby="events-first-run-title">
      <h2 id="events-first-run-title" ref={title} tabIndex={-1}>
        {t('events.firstRunTitle')}
      </h2>
      <ol className="steps-list">
        {steps.map((step, index) => (
          <li key={step}>
            <span className="step-mark" aria-hidden="true">
              {index + 1}
            </span>
            <span>{t(step)}</span>
          </li>
        ))}
      </ol>
      {creates ? (
        <Link className="button button-primary events-first-run-create" to="/app/events/new">
          {t('events.firstRunCreate')}
        </Link>
      ) : (
        <div className="notice notice-quiet">
          <p>{t('events.firstRunAskOwner')}</p>
        </div>
      )}
    </section>
  );
}

/** Set by Delete event on its way to the Events list, which says the event was deleted. */
function deletedEvent(state: unknown): string | null {
  const deleted =
    typeof state === 'object' && state != null && 'deletedEvent' in state
      ? state.deletedEvent
      : null;

  return typeof deleted === 'string' ? deleted : null;
}
