import { type ListedEvent } from '@soirely/api-client';
import {
  CALENDAR_SHOWS,
  type CalendarShow,
  type EventPhase,
  calendarDays,
  calledOff,
  inMonth,
  serverClock,
  shownPhase,
  wallDay,
} from '@soirely/domain';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { type BoardStart, CalendarBoard, CalendarTop } from '../../../components/CalendarBoard.tsx';
import { CalendarSubscribe, type FeedSource } from '../../../components/CalendarSubscribe.tsx';
import {
  type CalEvent,
  type CalendarFrame,
  type Item,
  CalendarFrameContext,
  firstOf,
  readKept,
} from '../../../components/calendarWeeks.ts';
import { Refreshing } from '../../../components/OfflineBand.tsx';
import { DeskPage } from '../../../components/SettingsParts.tsx';
import { useDeskTop } from '../../../deskTop.ts';
import { listPhase } from '../../../eventsList.ts';
import { dateLocale } from '../../../i18n/index.ts';
import { useDeskLayers } from '../../../layers.ts';
import { meshFor } from '../../../mesh.ts';
import { keepsWhatLoaded, useOffline } from '../../../offline.ts';
import { useServerNow } from '../../../serverNow.ts';
import { can, useSession } from '../../../session.ts';
import { EventsFirstRun } from '../../../components/EventsList.tsx';

type Load =
  { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; events: ListedEvent[]; at: Date };

/** The Calendar at a desk in A · Weeks as lanes, as the design demo's /demo/calendar draws it (sc-30413). */
export function Calendar() {
  const session = useSession();
  const organisation = session.organisation;

  if (organisation == null) return null;

  return (
    <CalendarOf
      key={organisation.id}
      organisationId={organisation.id}
      organisationName={organisation.name}
      creates={can(session, 'events.create')}
    />
  );
}

function CalendarOf({
  organisationId,
  organisationName,
  creates,
}: {
  organisationId: string;
  organisationName: string;
  creates: boolean;
}) {
  const { t } = useTranslation();
  const desk = useDeskTop();
  const now = useServerNow();
  const zone = readerZone();
  const today = wallDay(now, zone);
  const locale = dateLocale();
  const { layers, covered, setHost } = useDeskLayers();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [feed, setFeed] = useState(false);
  const [start] = useState<BoardStart<CalendarShow>>(() => {
    const place = readKept();

    return {
      view: place?.view ?? 'month',
      at: place == null || inMonth(today, place.month) ? today : firstOf(place.month),
      show: 'all',
      menu: false,
      open: null,
    };
  });
  const title = useRef<HTMLHeadingElement>(null);
  const subscribe = useRef<HTMLButtonElement>(null);
  const { watch, refreshing } = useOffline({
    loaded: load.kind === 'loaded',
    reload: () => setRefresh((n) => n + 1),
    title,
  });

  useEffect(() => {
    let current = true;

    watch(api.allEvents(organisationId)).then(
      (events) => current && setLoad({ kind: 'loaded', events, at: serverClock.now() }),
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

  const events = useMemo(
    () =>
      load.kind === 'loaded'
        ? load.events.map((event) => calEvent(event, shownPhase(event, load.at, now)))
        : [],
    [load, now],
  );
  const frame = useMemo<CalendarFrame>(() => ({ today, zone, linkOf }), [today, zone]);
  const source = useMemo<FeedSource>(
    () => ({
      read: () => api.calendarFeed(organisationId),
      reset: () => api.resetCalendarFeed(organisationId),
      copy: (url) => navigator.clipboard.writeText(url),
    }),
    [organisationId],
  );

  return (
    <DeskPage layers={layers}>
      <CalendarFrameContext value={frame}>
        <div className="ev cal-page" inert={covered}>
          <CalendarTop
            titleRef={title}
            subscribe={subscribe}
            onSubscribe={() => setFeed(true)}
            bell={desk.bell}
          >
            {refreshing && <Refreshing />}
          </CalendarTop>
          {desk.said}
          {load.kind === 'loaded' && events.length === 0 ? (
            <div className="cal-first">
              <EventsFirstRun
                create={creates ? '/app/events/new' : undefined}
                createLabel="events.newEvent"
              />
            </div>
          ) : (
            <CalendarBoard
              start={start}
              events={events}
              load={load.kind}
              shows={CALENDAR_SHOWS}
              showWords={{ all: t('calendar.showAll'), events: t('calendar.showEvents') }}
              daysFor={daysFor}
              lensOf={noLens}
              held={covered}
              locale={locale}
              onRetry={() => {
                setLoad({ kind: 'loading' });
                setAttempt((n) => n + 1);
              }}
            />
          )}
        </div>
      </CalendarFrameContext>
      <div ref={setHost} className="desk-layers" />
      {feed && (
        <CalendarSubscribe
          organisationName={organisationName}
          source={source}
          onClose={() => {
            setFeed(false);
            subscribe.current?.focus();
          }}
        />
      )}
    </DeskPage>
  );
}

function calEvent(event: ListedEvent, phase: EventPhase): CalEvent {
  return {
    ...event,
    shown: listPhase({ phase, calledOff: calledOff(event) }),
    mesh: meshFor(event.id),
    photo: event.cover,
  };
}

function daysFor(events: readonly CalEvent[], show: CalendarShow): Map<string, Item[]> {
  return calendarDays(events, show);
}

function noLens(): null {
  return null;
}

/** An event opens its page; a milestone its action's link, or else its event's All dates. */
function linkOf(item: Item): string {
  const page = `/app/events/${encodeURIComponent(item.event.id)}`;

  return item.kind === 'event' ? page : (item.milestone.action?.link ?? `${page}/dates`);
}

function readerZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
