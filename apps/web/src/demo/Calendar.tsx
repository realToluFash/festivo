import { formattingLocale } from '@soirely/domain';
import { type TFunction } from 'i18next';
import { type ReactNode, type RefObject, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

import { CalendarBoard } from '../components/CalendarBoard.tsx';
import { CalendarSubscribe, type FeedSource } from '../components/CalendarSubscribe.tsx';
import {
  type CalendarFrame,
  type CalendarLens,
  type MarkItem,
  CalendarFrameContext,
  readKept,
} from '../components/calendarWeeks.ts';
import { Glyph } from '../components/Glyph.tsx';
import { DemoBell } from './DemoBell.tsx';
import type { Tell } from '../components/SettingsParts.tsx';
import {
  type CalendarStart,
  type Feed,
  type Show,
  CAL_WORDS as W,
  FEED_LINK,
  NEW_FEED_LINK,
  OPENED_IN_APP,
  READER_ZONE,
  SHOWS,
  TODAY,
  calendarStart,
  calendarStateOf,
  itemLink,
  listedOf,
} from './calendar.ts';
import {
  daysFor,
  isOverdue,
  needsLabel,
  needsLanding,
  needsTime,
  seeded,
} from './calendarNeeds.ts';
import { EventsShell } from './EventParts.tsx';
import { CLOCKS, REUNION, TODAY_IDS, resetSample, sampleEvent, sampleEvents } from './events.ts';
import { FirstRun } from './Events.tsx';
import { AccessPaused, Switched } from './OrgSwitcher.tsx';
import { SIDEBAR_EVENTS } from './settings.ts';
import { usePaused, useSwitcherStart, useWhere } from './switcher.ts';
import { TodaySidebar } from './TodaySidebar.tsx';

const FRAME: CalendarFrame = { today: TODAY, zone: READER_ZONE, linkOf: itemLink };

/** The Calendar at a desk in B · A · Weeks as lanes (calendar-lanes-spec): the product's weeks as one scroll, on the demo's sample. */
export function Calendar() {
  const [params] = useSearchParams();
  const raw = params.get('state');
  useSwitcherStart();

  return <CalendarAt key={raw ?? ''} raw={raw} />;
}

function CalendarAt({ raw }: { raw: string | null }) {
  const paused = usePaused();
  const [start] = useState(() => {
    if (raw != null) resetSample();

    return calendarStart(calendarStateOf(raw), readKept());
  });

  return (
    <EventsShell
      renderSide={(tell, covered) => (
        <TodaySidebar
          events={
            start.none ? [] : SIDEBAR_EVENTS.filter((key) => sampleEvent(TODAY_IDS[key]) != null)
          }
          tell={tell}
          calendar
          inert={covered}
        />
      )}
    >
      {(tell) =>
        paused ? (
          <div className="desk-page">
            <Switched />
            <AccessPaused />
          </div>
        ) : (
          <CalendarPage start={start} tell={tell} />
        )
      }
    </EventsShell>
  );
}

function needsLines(t: TFunction, item: MarkItem, locale: string): ReactNode[] {
  const time = needsTime(t, item.event, item.milestone.at, locale);

  return [
    isOverdue(item.milestone, CLOCKS.rest) ? (
      <span key="time" className="cal-late cal-late-line">
        <Glyph name="clock" size={14} weight={2.4} />
        <span>{`${time} · ${W.overdue}`}</span>
      </span>
    ) : (
      time
    ),
    <span key="event" className="cal-row-event">
      {item.event.name}
    </span>,
  ];
}

/** Only what needs you (sc-32803), which the product's Calendar does not build (sc-29884). */
function needsLens(t: TFunction, locale: string): CalendarLens {
  return {
    late: (item) => item.milestone.owner === 'you' && isOverdue(item.milestone, CLOCKS.rest),
    label: (item) => needsLabel(t, item, locale, CLOCKS.rest),
    lines: (item) => needsLines(t, item, locale),
    emptyDay: W.emptyNeedsDay,
    emptyMonth: W.emptyNeedsMonth,
    landing: needsLanding,
  };
}

/** The Calendar's title row once the band leaves (sc-39471): Subscribe, then the bell last, as Events ends with New event and the bell. */
function TopWithBell({
  subscribe,
  onSubscribe,
  tell,
}: {
  subscribe: RefObject<HTMLButtonElement | null>;
  onSubscribe: () => void;
  tell: Tell;
}) {
  const { t } = useTranslation();

  return (
    <header className="desk-top ev-top">
      <h1 className="desk-title ev-title" tabIndex={-1}>
        {t('calendar.title')}
      </h1>
      <button ref={subscribe} type="button" className="cal-subscribe" onClick={onSubscribe}>
        <Glyph name="calendar" size={18} weight={2.2} />
        {t('calendarFeed.open')}
      </button>
      <DemoBell tell={tell} />
    </header>
  );
}

function CalendarPage({ start, tell }: { start: CalendarStart; tell: Tell }) {
  const { t } = useTranslation();
  const where = useWhere();
  const organisation = where.places.find((place) => place.id === where.current)?.name ?? '';
  const [locale] = useState(() => formattingLocale('en', navigator.language));
  const [load, setLoad] = useState(start.load);
  const [feed, setFeed] = useState<Feed | null>(start.feed);
  const subscribe = useRef<HTMLButtonElement>(null);
  const events = useMemo(() => {
    if (start.none) return [];

    const listed = listedOf(
      start.reunion ? [...sampleEvents(), REUNION] : sampleEvents(),
      CLOCKS.rest,
    );

    return start.needs == null ? listed : seeded(listed, start.needs);
  }, [start]);
  const reads = useRef(0);
  const source = useMemo<FeedSource>(
    () => ({
      read: () => {
        reads.current += 1;
        if (start.read === 'waiting') return new Promise<never>(() => undefined);
        if (start.read === 'unreadable' && reads.current === 1)
          return Promise.reject(new Error('unreadable'));

        return Promise.resolve(feedLink(FEED_LINK));
      },
      reset: () => Promise.resolve(feedLink(NEW_FEED_LINK)),
      copy: (url) =>
        start.feed === 'refused'
          ? Promise.reject(new Error('refused'))
          : navigator.clipboard.writeText(url),
    }),
    [start.feed, start.read],
  );
  const needs = useMemo(() => needsLens(t, locale), [t, locale]);

  function retry(): void {
    setLoad('loading');
    window.setTimeout(() => setLoad('loaded'), 700);
  }

  return (
    <CalendarFrameContext value={FRAME}>
      <div className="desk-page cal-page">
        <TopWithBell subscribe={subscribe} onSubscribe={() => setFeed('open')} tell={tell} />
        <Switched />
        {start.none ? (
          <div className="cal-first">
            <FirstRun tell={tell} asks={start.asks} />
          </div>
        ) : (
          <CalendarBoard
            start={start}
            events={events}
            load={load}
            shows={SHOWS}
            showWords={{
              all: t('calendar.showAll'),
              events: t('calendar.showEvents'),
              needs: W.showNeedsYou,
            }}
            daysFor={daysFor}
            lensOf={(show: Show) => (show === 'needs' ? needs : null)}
            held={feed != null}
            locale={locale}
            onRetry={retry}
          />
        )}
        {feed != null && (
          <CalendarSubscribe
            organisationName={organisation}
            source={source}
            {...(start.read === 'loaded' && { first: feedLink(FEED_LINK) })}
            confirm={feed === 'reset'}
            refused={feed === 'refused'}
            instead={OPENED_IN_APP}
            onClose={() => {
              setFeed(null);
              subscribe.current?.focus();
            }}
          />
        )}
      </div>
    </CalendarFrameContext>
  );
}

function feedLink(url: string): { url: string; webcal: string } {
  return { url, webcal: url.replace(/^https:/, 'webcal:') };
}
