import { ApiError, type OrganisationEvent, eventVersion } from '@soirely/api-client';
import {
  type PlaceholderEventArea,
  formatEventRange,
  isPlaceholderEventArea,
  rememberTabHolding,
  shownPhase,
} from '@soirely/domain';
import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';

import { BackControl } from '../../../components/BackControl.tsx';
import { api } from '../../../api.ts';
import { Refreshing } from '../../../components/OfflineBand.tsx';
import { keepsWhatLoaded, useOffline } from '../../../offline.ts';
import { dateLocale } from '../../../i18n/index.ts';
import { ArrivalNotice } from '../../../components/PageArrival.tsx';
import { pageTitle, usePageTitle } from '../../../pageTitle.ts';
import { LayersContext, useDeskLayers } from '../../../layers.ts';
import { useLoadedAt, useServerNow } from '../../../serverNow.ts';
import { canOn, useSession } from '../../../session.ts';
import { useFocusOnceShown } from '../../../stepFocus.ts';
import { DuplicateEvent } from './DuplicateEvent.tsx';
import { DraftRow, StatusPill } from './MakeLive.tsx';
import { PausedRow } from './PauseEvent.tsx';
import { OutcomeLine } from './OutcomeLine.tsx';
import { EventPeople } from './EventPeople.tsx';
import { GuestsArea } from './GuestsArea.tsx';
import { SeatingArea } from './SeatingArea.tsx';
import { typeLabel } from './eventTypes.ts';
import { AllDates } from './Timeline.tsx';
import { EventCrumb, Overview, PhaseChange } from './EventOverview.tsx';
import { useShowEvent } from './EventNav.tsx';
import { Arrived, Skeleton } from '../../../components/Skeleton.tsx';
import { NotFound } from '../../public/NotFound.tsx';

type Load =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'notFound' }
  | { kind: 'loaded'; event: OrganisationEvent; tag: string };

type Page = 'event' | 'guests' | 'dates' | 'people' | PlaceholderEventArea;

export function EventView() {
  return <ForEvent page="event" />;
}

export function EventGuests() {
  return <ForEvent page="guests" />;
}

export function EventDates() {
  return <ForEvent page="dates" />;
}

export function EventPeoplePage() {
  return <ForEvent page="people" />;
}

/** One of the areas not built yet: its panel says it is coming (sc-22103). */
export function EventAreaPage() {
  const { area = '' } = useParams();

  return isPlaceholderEventArea(area) ? <ForEvent page={area} /> : <NotFound />;
}

function ForEvent({ page }: { page: Page }) {
  const session = useSession();
  const { eventId = '' } = useParams();
  const organisationId = session.organisation?.id;

  if (organisationId == null) return null;

  return (
    <EventOf
      key={`${organisationId}:${eventId}`}
      organisationId={organisationId}
      eventId={eventId}
      page={page}
    />
  );
}

function EventOf({
  organisationId,
  eventId,
  page,
}: {
  organisationId: string;
  eventId: string;
  page: Page;
}) {
  const { t } = useTranslation();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const failedLine = useRef<HTMLParagraphElement>(null);
  const land = useFocusOnceShown();
  const { watch, refreshing } = useOffline({
    loaded: load.kind === 'loaded',
    reload: () => setRefresh((n) => n + 1),
    title: heading,
  });

  useEffect(() => {
    let current = true;

    watch(api.taggedEvent(eventId)).then(
      ({ event, tag }) =>
        current &&
        setLoad((was) => {
          if (event.organisationId !== organisationId) return { kind: 'notFound' };

          try {
            return was.kind === 'loaded' && eventVersion(tag) < eventVersion(was.tag)
              ? was
              : { kind: 'loaded', event, tag };
          } catch {
            return { kind: 'failed' };
          }
        }),
      (error: unknown) =>
        current &&
        setLoad((was) =>
          was.kind === 'loaded' && keepsWhatLoaded(error)
            ? was
            : error instanceof ApiError && error.status === 404
              ? { kind: 'notFound' }
              : { kind: 'failed' },
        ),
    );

    return () => {
      current = false;
    };
  }, [organisationId, eventId, attempt, refresh, watch]);
  useShowEvent(eventId, load.kind === 'loaded' ? load.event : undefined);

  if (page === 'seating' && load.kind === 'loaded')
    return canOn(load.event, 'seating.read') ? <SeatingArea event={load.event} /> : <NotFound />;

  if (page === 'guests' && load.kind === 'loaded')
    return canOn(load.event, 'guests.read') ? (
      <GuestsArea
        event={load.event}
        tag={load.tag}
        heading={heading}
        onChange={(event, tag) => setLoad({ kind: 'loaded', event, tag })}
      />
    ) : (
      <NotFound />
    );

  const states = (
    <>
      {load.kind === 'loading' &&
        (page === 'event' ? (
          <Skeleton
            words={t('eventPage.loading')}
            shape="cards"
            titled
            cards={[{ cover: true, lines: 2 }, { lines: 3 }, { lines: 2 }]}
          />
        ) : (
          <Skeleton words={t('eventPage.loading')} shape="rows" rowHeight={56} />
        ))}

      {load.kind === 'failed' && (
        <ArrivalNotice
          role={attempt > 0 ? undefined : 'alert'}
          line={t('eventPage.failed')}
          lineRef={failedLine}
          focusable
          retry={t('events.retry')}
          onRetry={() => {
            setLoad({ kind: 'loading' });
            setAttempt((n) => n + 1);
            land(() => heading.current ?? failedLine.current);
          }}
        />
      )}

      {load.kind === 'notFound' && (
        <section className="card">
          <h1 ref={heading} tabIndex={-1}>
            {t('eventPage.notFound')}
          </h1>
        </section>
      )}
    </>
  );

  if (page === 'event')
    return (
      <EventDesk>
        {(covered) => (
          <div className="event-page ev-wide" inert={covered}>
            <EventCrumb name={load.kind === 'loaded' ? load.event.name : null}>
              {refreshing && <Refreshing />}
            </EventCrumb>
            {states}
            {load.kind === 'loaded' && (
              <Arrived>
                <Overview
                  event={load.event}
                  tag={load.tag}
                  heading={heading}
                  onChange={(event, tag) => setLoad({ kind: 'loaded', event, tag })}
                />
              </Arrived>
            )}
          </div>
        )}
      </EventDesk>
    );

  return (
    <div className="event-page">
      <div className="event-crumbs">
        <BackControl
          className="event-back"
          label={t('eventPage.backToEvent')}
          to={`/app/events/${encodeURIComponent(eventId)}`}
        />
        {refreshing && <Refreshing />}
      </div>

      {states}

      {load.kind === 'loaded' && (
        <Arrived>
          <EventTop
            event={load.event}
            tag={load.tag}
            heading={heading}
            onChange={(event, tag) => setLoad({ kind: 'loaded', event, tag })}
          />
          {page === 'dates' && <AllDatesPage event={load.event} heading={heading} />}
          {page === 'people' && <PeoplePage event={load.event} />}
          {isPlaceholderEventArea(page) && page !== 'seating' && (
            <AreaComing event={load.event} area={page} />
          )}
        </Arrived>
      )}
    </div>
  );
}

/** Above every area but Overview, whose cover card is its top: the name, the phase, the dates, the venue, and the phase's one primary (sc-22103). */
function EventTop({
  event,
  tag,
  heading,
  onChange,
}: {
  event: OrganisationEvent;
  tag: string;
  heading: RefObject<HTMLHeadingElement | null>;
  onChange: (event: OrganisationEvent, tag: string) => void;
}) {
  const { t } = useTranslation();
  const [madeLive, setMadeLive] = useState(false);
  const [resumed, setResumed] = useState(false);
  const now = useServerNow();
  const loadedAt = useLoadedAt(event);
  const phase = shownPhase(event, loadedAt, now);
  const manages = canOn(event, 'events.manage');

  useEffect(() => rememberTabHolding(event.organisationId, phase), [event.organisationId, phase]);

  return (
    <section className="event-top" aria-labelledby="event-title">
      <div className="event-top-head">
        <div className="event-top-title">
          <h1 id="event-title" ref={heading} tabIndex={-1}>
            {event.name}
          </h1>
          <StatusPill phase={phase} />
          <PhaseChange key={loadedAt.getTime()} phase={phase} />
        </div>
        {phase === 'finished' && canOn(event, 'events.create') && (
          <div className="event-top-primary">
            <DuplicateEvent event={event} primary />
          </div>
        )}
      </div>
      <p className="event-top-type">{typeLabel(event.type, t)}</p>
      <p className="event-top-when">
        {t('eventPage.when', {
          range: formatEventRange(event.startsAt, event.endsAt, event.timeZone, dateLocale()),
          timeZone: event.timeZone,
        })}
      </p>
      <TopVenue event={event} />
      <DraftRow
        event={event}
        tag={tag}
        now={now}
        manages={manages}
        heading={heading}
        onChange={onChange}
        onMadeLive={() => setMadeLive(true)}
      />
      {madeLive && <OutcomeLine words={t('eventLive.madeLive')} />}
      <PausedRow
        event={event}
        phase={phase}
        manages={manages}
        heading={heading}
        onChange={onChange}
        onResumed={() => setResumed(true)}
      />
      {resumed && <OutcomeLine words={t('eventPause.resumed', { name: event.name })} />}
    </section>
  );
}

/** The venue's name, else its address, else Venue to be confirmed; Open in maps when it has coordinates (sc-3589). */
function TopVenue({ event }: { event: OrganisationEvent }) {
  const { t } = useTranslation();
  const venue = event.venue;
  const address = venue?.address ?? null;
  const { latitude, longitude } = address ?? { latitude: null, longitude: null };
  const place = venue?.name ?? address?.formatted ?? null;

  return (
    <div className="event-top-venue" role="group" aria-label={t('eventPage.venue')}>
      <p>{place ?? t('eventPage.venueToBeConfirmed')}</p>
      {latitude != null && longitude != null && (
        <a
          className="link-button"
          href={`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('eventPage.openInMaps')}
        </a>
      )}
    </div>
  );
}

function AllDatesPage({
  event,
  heading,
}: {
  event: OrganisationEvent;
  heading: RefObject<HTMLHeadingElement | null>;
}) {
  const { t } = useTranslation();
  const now = useServerNow();

  usePageTitle(pageTitle(t, [t('timeline.allDates'), event.name]));

  return (
    <section className="card timeline-page" aria-labelledby="all-dates-title">
      <h2 id="all-dates-title">{t('timeline.allDates')}</h2>
      <AllDates event={event} now={now} heading={heading} />
    </section>
  );
}

function PeoplePage({ event }: { event: OrganisationEvent }) {
  const { t } = useTranslation();

  usePageTitle(pageTitle(t, [t('eventPeople.title'), event.name]));

  return <EventPeople event={event} />;
}

function AreaComing({ event, area }: { event: OrganisationEvent; area: PlaceholderEventArea }) {
  const { t } = useTranslation();

  usePageTitle(pageTitle(t, [t(`eventNav.${area}`), event.name]));

  return (
    <section className="card event-area" aria-labelledby="event-area-title">
      <h2 id="event-area-title">{t(`eventNav.${area}`)}</h2>
      <p>{t(`eventNav.${area}Coming`)}</p>
    </section>
  );
}

/** A desk for the event's page: the dialogs its edits ask in, over the page they make inert. */
function EventDesk({ children }: { children: (covered: boolean) => ReactNode }) {
  const { layers, covered, setHost } = useDeskLayers();

  return (
    <LayersContext value={layers}>
      <div className="desk ev event-desk">
        {children(covered)}
        <div ref={setHost} className="desk-layers" />
      </div>
    </LayersContext>
  );
}
