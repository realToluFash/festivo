import { ApiError, type OrganisationEvent } from '@soirely/api-client';
import {
  type EventPhase,
  type PlaceholderEventArea,
  formatEventRange,
  isPlaceholderEventArea,
  rememberTabHolding,
  shownPhase,
} from '@soirely/domain';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate, useParams } from 'react-router';

import { BackControl } from '../../../components/BackControl.tsx';
import { api } from '../../../api.ts';
import { dateLocale } from '../../../i18n/index.ts';
import { ArrivalNotice } from '../../../components/PageArrival.tsx';
import { pageTitle, usePageTitle } from '../../../pageTitle.ts';
import { useLoadedAt, useServerNow } from '../../../serverNow.ts';
import { can, useSession } from '../../../session.ts';
import { useFocusOnceShown } from '../../../stepFocus.ts';
import { type EditOutcome } from './EditEvent.tsx';
import { DeleteEvent } from './DeleteEvent.tsx';
import { DuplicateEvent } from './DuplicateEvent.tsx';
import { CalledOffNotice, EndButton } from './EndEvent.tsx';
import { EventCoverImage } from './EventCoverImage.tsx';
import { PHASE_WORD } from './eventWords.ts';
import { DraftRow, StatusPill } from './MakeLive.tsx';
import { MuteEvent } from './MuteEvent.tsx';
import { PauseButton, PausedRow } from './PauseEvent.tsx';
import { OutcomeLine } from './OutcomeLine.tsx';
import { typeLabel } from './eventTypes.ts';
import { ComingUp, AllDates } from './Timeline.tsx';
import { Arrived, Skeleton } from '../../../components/Skeleton.tsx';
import { NotFound } from '../../public/NotFound.tsx';

type Load =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'notFound' }
  | { kind: 'loaded'; event: OrganisationEvent; tag: string };

type Page = 'event' | 'guests' | 'dates' | PlaceholderEventArea;

export function EventView() {
  return <ForEvent page="event" />;
}

export function EventGuests() {
  return <ForEvent page="guests" />;
}

export function EventDates() {
  return <ForEvent page="dates" />;
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
  const heading = useRef<HTMLHeadingElement>(null);
  const failedLine = useRef<HTMLParagraphElement>(null);
  const land = useFocusOnceShown();

  useEffect(() => {
    let current = true;

    api.taggedEvent(eventId).then(
      ({ event, tag }) =>
        current &&
        setLoad(
          event.organisationId === organisationId
            ? { kind: 'loaded', event, tag }
            : { kind: 'notFound' },
        ),
      (error: unknown) =>
        current &&
        setLoad(
          error instanceof ApiError && error.status === 404
            ? { kind: 'notFound' }
            : { kind: 'failed' },
        ),
    );

    return () => {
      current = false;
    };
  }, [organisationId, eventId, attempt]);

  return (
    <div className="event-page">
      {page === 'event' ? (
        <BackControl className="event-back" label={t('events.title')} to="/app/events" />
      ) : (
        <BackControl
          className="event-back"
          label={t('eventPage.backToEvent')}
          to={`/app/events/${encodeURIComponent(eventId)}`}
        />
      )}

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

      {load.kind === 'loaded' && (
        <Arrived>
          {page === 'event' && (
            <EventPage
              event={load.event}
              tag={load.tag}
              heading={heading}
              onChange={(event, tag = load.tag) => setLoad({ kind: 'loaded', event, tag })}
            />
          )}
          {page === 'guests' && <GuestsComing event={load.event} heading={heading} />}
          {page === 'dates' && <AllDatesPage event={load.event} heading={heading} />}
          {isPlaceholderEventArea(page) && (
            <AreaComing event={load.event} area={page} heading={heading} />
          )}
        </Arrived>
      )}
    </div>
  );
}

function EventPage({
  event,
  tag,
  heading,
  onChange,
}: {
  event: OrganisationEvent;
  tag: string;
  heading: RefObject<HTMLHeadingElement | null>;
  onChange: (event: OrganisationEvent, tag?: string) => void;
}) {
  const { t } = useTranslation();
  const session = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [outcome] = useState(() => editOutcome(location.state));
  const [coverRefused] = useState(() => coverRefusal(location.state));
  const coverLine = useRef<HTMLParagraphElement>(null);
  const [madeLive, setMadeLive] = useState(false);
  const [ended, setEnded] = useState(false);
  const [moved, setMoved] = useState<'paused' | 'resumed' | null>(null);
  const now = useServerNow();
  const loadedAt = useLoadedAt(event);
  const phase = shownPhase(event, loadedAt, now);

  useEffect(() => rememberTabHolding(event.organisationId, phase), [event.organisationId, phase]);

  useEffect(() => {
    if (editOutcome(location.state) == null && coverRefusal(location.state) == null) return;

    void navigate(
      { pathname: location.pathname, search: location.search, hash: location.hash },
      { replace: true, state: null },
    );
  }, [location, navigate]);

  return (
    <>
      <section className="card event-page-card" aria-labelledby="event-title">
        <EventCoverImage
          photo={event.cover}
          type={event.type}
          sizes="(width <= 40rem) 100vw, 45rem"
          className="event-page-cover"
        />
        <div className="event-page-head">
          <h1 id="event-title" ref={heading} tabIndex={-1}>
            {event.name}
          </h1>
          <StatusPill phase={phase} />
          <PhaseChange key={loadedAt.getTime()} phase={phase} />
        </div>
        <p className="muted">{typeLabel(event.type, t)}</p>
        <p>
          {t('eventPage.when', {
            range: formatEventRange(event.startsAt, event.endsAt, event.timeZone, dateLocale()),
            timeZone: event.timeZone,
          })}
        </p>
        <CalledOffNotice event={event} />
        <DraftRow
          event={event}
          tag={tag}
          now={now}
          manages={can(session, 'events.manage')}
          heading={heading}
          onChange={onChange}
          onMadeLive={() => setMadeLive(true)}
        />
        {madeLive && <OutcomeLine words={t('eventLive.madeLive')} />}
        {ended && <OutcomeLine words={t(PHASE_WORD.finished)} />}
        <PausedRow
          event={event}
          phase={phase}
          manages={can(session, 'events.manage')}
          heading={heading}
          onChange={onChange}
          onResumed={() => setMoved('resumed')}
        />
        {moved != null && (
          <OutcomeLine key={moved} words={t(`eventPause.${moved}`, { name: event.name })} />
        )}
        <Venue event={event} manages={can(session, 'events.manage')} />
        {coverRefused != null && (
          <ArrivalNotice
            role="alert"
            line={t('eventCover.createdWithout', { reason: coverRefused })}
            lineRef={coverLine}
            focusable={false}
            retry={t('eventEdit.open')}
            onRetry={() => void navigate(`/app/events/${encodeURIComponent(event.id)}/edit#cover`)}
          />
        )}
        {outcome != null && (
          <OutcomeLine
            words={outcome === 'saved' ? t('eventEdit.saved') : t('eventEdit.nothingChanged')}
          />
        )}
        <div className="event-page-actions">
          {can(session, 'events.manage') && (
            <Link className="button" to={`/app/events/${encodeURIComponent(event.id)}/edit`}>
              {t('eventEdit.open')}
            </Link>
          )}
          {can(session, 'events.manage') && (
            <PauseButton
              event={event}
              phase={phase}
              heading={heading}
              onChange={onChange}
              onPaused={() => setMoved('paused')}
            />
          )}
          {can(session, 'events.manage') && (
            <EndButton
              event={event}
              phase={phase}
              now={now}
              heading={heading}
              onChange={onChange}
              onEnded={() => setEnded(true)}
            />
          )}
          <Link className="button" to={`/app/events/${encodeURIComponent(event.id)}/guests`}>
            {t('eventPage.guests')}
          </Link>
          {can(session, 'events.create') && <DuplicateEvent event={event} />}
        </div>
        <MuteEvent eventId={event.id} />
        {can(session, 'events.create') && <DeleteEvent event={event} />}
      </section>
      <ComingUp event={event} now={now} />
    </>
  );
}

/** With coordinates, the address opens OpenStreetMap there; with no venue, somebody who manages events can go and add it (sc-3589). */
function Venue({ event, manages }: { event: OrganisationEvent; manages: boolean }) {
  const { t } = useTranslation();
  const venue = event.venue;
  const address = venue?.address ?? null;
  const { latitude, longitude } = address ?? { latitude: null, longitude: null };

  if (venue == null) {
    return (
      <div className="event-page-venue" role="group" aria-label={t('eventPage.venue')}>
        <p>{t('eventPage.venueToBeConfirmed')}</p>
        {manages && (
          <Link
            className="link-button event-page-venue-link"
            to={`/app/events/${encodeURIComponent(event.id)}/edit#venue`}
          >
            {t('eventPage.addVenue')}
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="event-page-venue" role="group" aria-label={t('eventPage.venue')}>
      {venue.name != null && <p className="event-page-venue-name">{venue.name}</p>}
      {address != null && <p>{address.formatted}</p>}
      {latitude != null && longitude != null && (
        <a
          className="link-button event-page-venue-link"
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

/** WCAG 2.2 §4.1.3: a phase the clock changes on an open page is said politely; one the server sends is not. */
function PhaseChange({ phase }: { phase: EventPhase }) {
  const { t } = useTranslation();
  const [opened] = useState(phase);

  return (
    <p className="visually-hidden" aria-live="polite">
      {phase === opened ? '' : t(PHASE_WORD[phase])}
    </p>
  );
}

/** Set by New event when the event was created and its staged cover was refused or failed to save. */
function coverRefusal(state: unknown): string | null {
  const refused =
    typeof state === 'object' && state != null && 'coverRefused' in state
      ? state.coverRefused
      : null;

  return typeof refused === 'string' ? refused : null;
}

function editOutcome(state: unknown): EditOutcome | null {
  const edit = typeof state === 'object' && state != null && 'edit' in state ? state.edit : null;

  return edit === 'saved' || edit === 'unchanged' ? edit : null;
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
    <section className="card timeline-page">
      <h1 ref={heading} tabIndex={-1}>
        {t('timeline.allDates')}
      </h1>
      <AllDates event={event} now={now} heading={heading} />
    </section>
  );
}

function GuestsComing({
  event,
  heading,
}: {
  event: OrganisationEvent;
  heading: RefObject<HTMLHeadingElement | null>;
}) {
  const { t } = useTranslation();

  usePageTitle(pageTitle(t, [t('eventPage.guests'), event.name]));

  return (
    <section className="card">
      <h1 ref={heading} tabIndex={-1}>
        {t('eventPage.guests')}
      </h1>
      <p>{t('eventPage.guestsComing')}</p>
    </section>
  );
}

function AreaComing({
  event,
  area,
  heading,
}: {
  event: OrganisationEvent;
  area: PlaceholderEventArea;
  heading: RefObject<HTMLHeadingElement | null>;
}) {
  const { t } = useTranslation();
  const now = useServerNow();
  const loadedAt = useLoadedAt(event);

  usePageTitle(pageTitle(t, [t(`eventNav.${area}`), event.name]));

  return (
    <>
      <div className="event-page-head">
        <h1 ref={heading} tabIndex={-1}>
          {event.name}
        </h1>
        <StatusPill phase={shownPhase(event, loadedAt, now)} />
      </div>
      <section className="card event-area" aria-labelledby="event-area-title">
        <h2 id="event-area-title">{t(`eventNav.${area}`)}</h2>
        <p>{t(`eventNav.${area}Coming`)}</p>
      </section>
    </>
  );
}
