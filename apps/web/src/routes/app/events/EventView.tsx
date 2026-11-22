import { ApiError, type OrganisationEvent, eventVersion } from '@soirely/api-client';
import {
  type PlaceholderEventArea,
  eventMovesInto,
  formatEventRange,
  isPlaceholderEventArea,
  rememberTabHolding,
  shownPhase,
} from '@soirely/domain';
import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useParams } from 'react-router';

import { api } from '../../../api.ts';
import { Glyph } from '../../../components/Glyph.tsx';
import { Refreshing } from '../../../components/OfflineBand.tsx';
import { keepsWhatLoaded, useOffline } from '../../../offline.ts';
import { keepLoaded, keptFor, keptKeys, rekeep } from '../../../tabKept.ts';
import { dateLocale } from '../../../i18n/index.ts';
import { ArrivalNotice } from '../../../components/PageArrival.tsx';
import { pageTitle, usePageTitle } from '../../../pageTitle.ts';
import { LayersContext, useDeskLayers } from '../../../layers.ts';
import { useLoadedAt, useServerNow } from '../../../serverNow.ts';
import { canOn, outsideOn, switchOrganisation, useSession } from '../../../session.ts';
import { useFocusOnceShown } from '../../../stepFocus.ts';
import { DuplicateEvent } from './DuplicateEvent.tsx';
import { DraftRow, StatusPill } from './MakeLive.tsx';
import { PausedRow } from './PauseEvent.tsx';
import { OutcomeLine } from './OutcomeLine.tsx';
import { EventPeople } from './EventPeople.tsx';
import { GuestsArea, GuestsGone } from './GuestsArea.tsx';
import { RunArea } from './RunArea.tsx';
import { BudgetArea } from './BudgetArea.tsx';
import { MenuArea } from './MenuArea.tsx';
import { SeePicksArea } from './SeePicksArea.tsx';
import { ScheduleOrNight } from './NightArea.tsx';
import { SeatingArea } from './SeatingArea.tsx';
import { JobsShiftsArea } from './JobsShiftsArea.tsx';
import { RosterArea } from './RosterArea.tsx';
import { StationsArea } from './StationsArea.tsx';
import { PAGE_NEEDS } from './handoff.ts';
import { typeLabel } from './eventTypes.ts';
import { AllDates } from './Timeline.tsx';
import { EventCrumb, Overview, PhaseChange } from './EventOverview.tsx';
import { OutsideOverview } from './OutsideOverview.tsx';
import { OutsideGone } from '../OutsideShell.tsx';
import { useGoneEvent, useShowEvent } from './EventNav.tsx';
import { Arrived, Skeleton } from '../../../components/Skeleton.tsx';
import { Switched } from '../../../components/Switched.tsx';
import { NotFound } from '../../public/NotFound.tsx';
import '../../../components/eventsDesk.css';
import './budget.css';

type Load =
  | { kind: 'loading' }
  | { kind: 'failed'; offline?: boolean }
  | { kind: 'notFound' }
  | { kind: 'loaded'; event: OrganisationEvent; tag: string };

type Page =
  | 'event'
  | 'guests'
  | 'dates'
  | 'people'
  | 'run'
  | 'staffJobs'
  | 'staffStations'
  | 'menuPicks'
  | PlaceholderEventArea;

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

/** The run view: the schedule as the night runs (sc-1404). */
export function EventRun() {
  return <ForEvent page="run" />;
}

export function EventRoster() {
  return <ForEvent page="staff" />;
}

export function EventJobsShifts() {
  return <ForEvent page="staffJobs" />;
}

export function EventStations() {
  return <ForEvent page="staffStations" />;
}

export function EventMenuPicks() {
  return <ForEvent page="menuPicks" />;
}

/** Staff opens its first tab, the Roster (sc-3906). */
export function EventStaff() {
  const { eventId = '' } = useParams();

  return <Navigate replace to={`/app/events/${encodeURIComponent(eventId)}/staff/roster`} />;
}

/** Budget, with its pages for everything due and for each vendor quoted (sc-87). */
export function EventBudget() {
  return <ForEvent page="budget" />;
}

/** One of the areas not built yet: its panel says it is coming (sc-22103). */
export function EventAreaPage() {
  const { area = '' } = useParams();

  return isPlaceholderEventArea(area) ? <ForEvent page={area} /> : <Withheld />;
}

/** The event its link opened in another organisation, carried into that organisation so it shows at once, with Now working in under its crumb (sc-80863). */
interface Moved {
  organisationId: string;
  name: string;
  event: OrganisationEvent;
  tag: string;
}

function ForEvent({ page }: { page: Page }) {
  const session = useSession();
  const { eventId = '' } = useParams();
  const outside = outsideOn(session, eventId);
  const organisationId = outside == null ? (session.organisation?.id ?? null) : OUTSIDE;
  const [moved, setMoved] = useState<Moved | null>(null);
  // The link moves the account once, from the organisation it was opened in: a pick in the switcher after that is the person's, and stays (sc-46032).
  const [link, setLink] = useState({ eventId, openIn: organisationId });

  if (moved != null && (moved.organisationId !== organisationId || moved.event.id !== eventId))
    setMoved(null);
  if (link.eventId !== eventId) setLink({ eventId, openIn: organisationId });
  else if (link.openIn != null && link.openIn !== organisationId)
    setLink({ eventId, openIn: null });

  if (organisationId == null) return null;

  const movesInto =
    page === 'event' && outside == null && link.openIn === organisationId
      ? (event: OrganisationEvent, tag: string): boolean => {
          const into = eventMovesInto(event, organisationId, session.organisations);
          const membership = session.organisations.find(({ id }) => id === into);

          if (membership == null) return false;
          setLink({ eventId, openIn: null });
          setMoved({ organisationId: membership.id, name: membership.name, event, tag });
          switchOrganisation(membership.id);

          return true;
        }
      : null;

  return (
    <EventOf
      key={`${organisationId}:${eventId}`}
      organisationId={organisationId}
      eventId={eventId}
      page={page}
      moved={moved?.organisationId === organisationId ? moved : null}
      movesInto={movesInto}
    />
  );
}

/** Held from outside an organisation (sc-71), by a member of another as much as by an account in none (sc-68438): the event is the account's whichever organisation it belongs to. */
const OUTSIDE = 'outside';

function ofOrganisation(event: OrganisationEvent, organisationId: string): boolean {
  return organisationId === OUTSIDE || event.organisationId === organisationId;
}

function Withheld() {
  return (
    <div className="event-page">
      <EventCrumb name={null} />
      <NotFound />
    </div>
  );
}

/** Without budget.read, as the Budget's demo draws it (sc-85, sc-101): the event's name, then Not available, and no word of what is withheld. */
function BudgetWithheld({ event }: { event: OrganisationEvent }) {
  const { t } = useTranslation();

  return (
    <div className="event-page">
      <EventCrumb
        name={event.name}
        area={{
          label: t('eventPage.notAvailable'),
          event: `/app/events/${encodeURIComponent(event.id)}`,
        }}
      />
      <div className="bt-gone ev">
        <h1 className="bt-title" tabIndex={-1}>
          {t('eventPage.notFound')}
        </h1>
        <Link className="desk-text" to="/app/events">
          <Glyph name="back" size={17} weight={2.4} />
          {t('eventPage.backToEvents')}
        </Link>
      </div>
    </div>
  );
}

function EventOf({
  organisationId,
  eventId,
  page,
  moved,
  movesInto,
}: {
  organisationId: string;
  eventId: string;
  page: Page;
  moved: Moved | null;
  /** Moves the account into the event's organisation, or answers false when it may not. */
  movesInto: ((event: OrganisationEvent, tag: string) => boolean) | null;
}) {
  const { t } = useTranslation();
  const session = useSession();
  const outside = outsideOn(session, eventId);
  const noOrganisation = session.organisation == null && session.pausedIn == null;
  const looking = outside != null && outside.role !== 'can_edit' ? outside : null;
  const [load, setLoad] = useState<Load>(
    moved == null ? { kind: 'loading' } : { kind: 'loaded', event: moved.event, tag: moved.tag },
  );
  const moves = useRef(movesInto);
  useEffect(() => {
    moves.current = movesInto;
  });
  const [attempt, setAttempt] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const failedLine = useRef<HTMLParagraphElement>(null);
  const land = useFocusOnceShown();
  const answered = useRef<Date | null>(null);
  const { watch, keep, refreshing } = useOffline({
    loaded: load.kind === 'loaded',
    reload: () => setRefresh((n) => n + 1),
    title: heading,
    event: true,
  });

  useEffect(() => {
    let current = true;

    watch(api.taggedEvent(eventId)).then(
      ({ event, tag }) => {
        if (!current) return;
        if (!ofOrganisation(event, organisationId) && moves.current?.(event, tag) === true) return;
        answered.current = new Date();
        setLoad((was) => {
          if (!ofOrganisation(event, organisationId)) return { kind: 'notFound' };

          try {
            return was.kind === 'loaded' && eventVersion(tag) < eventVersion(was.tag)
              ? was
              : { kind: 'loaded', event, tag };
          } catch {
            return { kind: 'failed' };
          }
        });
      },
      (error: unknown) => {
        if (!current) return;
        const found = keepsWhatLoaded(error)
          ? keptFor<{ event: OrganisationEvent; tag: string }>(keptKeys.event(eventId), error)
          : null;
        const kept =
          found != null && ofOrganisation(found.value.event, organisationId) ? found : null;

        if (kept != null) keep(kept.at);
        setLoad((was) =>
          was.kind === 'loaded' && keepsWhatLoaded(error)
            ? was
            : kept != null
              ? { kind: 'loaded', ...kept.value }
              : error instanceof ApiError && error.status === 404
                ? { kind: 'notFound' }
                : { kind: 'failed', offline: keepsWhatLoaded(error) },
        );
      },
    );

    return () => {
      current = false;
    };
  }, [organisationId, eventId, attempt, refresh, watch, keep]);

  useEffect(() => {
    if (load.kind !== 'loaded') return;

    const shown = { event: load.event, tag: load.tag };
    const key = keptKeys.event(eventId);

    if (answered.current == null) rekeep(key, shown);
    else keepLoaded(key, shown, answered.current);
    answered.current = null;
  }, [load, eventId]);
  const budgetUnseen =
    page === 'budget' && load.kind === 'loaded' && !canOn(load.event, PAGE_NEEDS.budget);
  useShowEvent(eventId, load.kind === 'loaded' ? load.event : undefined);
  // Until Overview has the event, it stands under the organisation's sidebar, the switcher still naming the one worked in (sc-80863).
  useGoneEvent(
    eventId,
    (page === 'event' && outside == null && load.kind !== 'loaded') ||
      (page === 'guests' && load.kind === 'notFound') ||
      (load.kind === 'failed' && load.offline === true),
  );

  if (noOrganisation && load.kind === 'notFound') return <OutsideGone eventId={eventId} />;

  if (page === 'guests' && load.kind === 'notFound')
    return (
      <GuestsGone heading={heading}>
        <EventCrumb name={null} />
      </GuestsGone>
    );

  if (page === 'seating' && load.kind === 'loaded')
    return canOn(load.event, PAGE_NEEDS.seating) ? (
      <SeatingArea event={load.event} />
    ) : (
      <Withheld />
    );

  if (page === 'menu' && load.kind === 'loaded')
    return canOn(load.event, PAGE_NEEDS.menu) ? <MenuArea event={load.event} /> : <Withheld />;

  if (page === 'menuPicks' && load.kind === 'loaded')
    return canOn(load.event, PAGE_NEEDS.menu) ? <SeePicksArea event={load.event} /> : <Withheld />;

  if (page === 'budget' && load.kind === 'loaded')
    return budgetUnseen ? <BudgetWithheld event={load.event} /> : <BudgetArea event={load.event} />;

  if (page === 'schedule' && load.kind === 'loaded')
    return canOn(load.event, PAGE_NEEDS.schedule) ? (
      <ScheduleOrNight event={load.event} />
    ) : (
      <Withheld />
    );

  if (page === 'run' && load.kind === 'loaded')
    return canOn(load.event, PAGE_NEEDS.run) ? <RunArea event={load.event} /> : <Withheld />;

  if (page === 'staff' && load.kind === 'loaded')
    return canOn(load.event, PAGE_NEEDS.staff) ? <RosterArea event={load.event} /> : <Withheld />;

  if (page === 'staffJobs' && load.kind === 'loaded')
    return canOn(load.event, PAGE_NEEDS.staff) ? (
      <JobsShiftsArea event={load.event} />
    ) : (
      <Withheld />
    );

  if (page === 'staffStations' && load.kind === 'loaded')
    return canOn(load.event, PAGE_NEEDS.staff) ? <StationsArea event={load.event} /> : <Withheld />;

  if (page === 'guests' && load.kind === 'loaded')
    return canOn(load.event, PAGE_NEEDS.guests) ? (
      <GuestsArea
        event={load.event}
        tag={load.tag}
        heading={heading}
        onChange={(event, tag) => setLoad({ kind: 'loaded', event, tag })}
      />
    ) : (
      <Withheld />
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
            {looking != null ? (
              refreshing && <Refreshing />
            ) : (
              <EventCrumb name={load.kind === 'loaded' ? load.event.name : null}>
                {refreshing && <Refreshing />}
              </EventCrumb>
            )}
            {moved != null && <Switched name={moved.name} />}
            {states}
            {load.kind === 'loaded' && (
              <Arrived>
                {looking != null ? (
                  <OutsideOverview event={load.event} held={looking} heading={heading} />
                ) : (
                  <Overview
                    event={load.event}
                    tag={load.tag}
                    heading={heading}
                    onChange={(event, tag) => setLoad({ kind: 'loaded', event, tag })}
                  />
                )}
              </Arrived>
            )}
          </div>
        )}
      </EventDesk>
    );

  return (
    <AskHost>
      {(covered) => (
        <div className={page === 'people' ? 'event-page is-people' : 'event-page'} inert={covered}>
          <EventCrumb
            name={load.kind === 'loaded' ? load.event.name : null}
            area={
              page === 'people'
                ? {
                    label: t('eventPeople.title'),
                    event: `/app/events/${encodeURIComponent(eventId)}`,
                  }
                : undefined
            }
          >
            {refreshing && <Refreshing />}
          </EventCrumb>

          {states}

          {load.kind === 'loaded' && (
            <Arrived>
              {page !== 'people' && (
                <EventTop
                  event={load.event}
                  tag={load.tag}
                  heading={heading}
                  onChange={(event, tag) => setLoad({ kind: 'loaded', event, tag })}
                />
              )}
              {page === 'dates' && <AllDatesPage event={load.event} heading={heading} />}
              {page === 'people' && <PeoplePage event={load.event} />}
              {isPlaceholderEventArea(page) &&
                page !== 'menu' &&
                page !== 'seating' &&
                page !== 'schedule' && <AreaComing event={load.event} area={page} />}
            </Arrived>
          )}
        </div>
      )}
    </AskHost>
  );
}

/** Above every area but Overview, whose cover card is its top, and People, which opens on its own title (sc-69635): the name, the phase, the dates, the venue, and the phase's one primary (sc-22103). */
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

/** Where Make live asks from the row heading an area (sc-48603): the desk's dialog over a page that keeps its own look. */
function AskHost({ children }: { children: (covered: boolean) => ReactNode }) {
  const { layers, covered, setHost } = useDeskLayers();

  return (
    <LayersContext value={layers}>
      {children(covered)}
      <div ref={setHost} className="desk desk-layers" />
    </LayersContext>
  );
}
