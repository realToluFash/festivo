import { ApiError, type OrganisationEvent } from '@soirely/api-client';
import { type EventPhase, formatEventRange, shownPhase } from '@soirely/domain';
import { type RefObject, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate, useParams } from 'react-router';

import { api } from '../../../api.ts';
import { dateLocale } from '../../../i18n/index.ts';
import { ArrivalNotice } from '../../../components/PageArrival.tsx';
import { Arriving } from '../../../pageArrival.ts';
import { pageTitle, usePageTitle } from '../../../pageTitle.ts';
import { useLoadedAt, useServerNow } from '../../../serverNow.ts';
import { can, useSession } from '../../../session.ts';
import { useFocusOnceShown } from '../../../stepFocus.ts';
import { type EditOutcome } from './EditEvent.tsx';
import { CalledOffNotice, EndButton } from './EndEvent.tsx';
import { EventCoverImage } from './EventCoverImage.tsx';
import { PHASE_WORD } from './eventWords.ts';
import { DraftRow, StatusPill } from './MakeLive.tsx';
import { typeLabel } from './eventTypes.ts';

type Load =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'notFound' }
  | { kind: 'loaded'; event: OrganisationEvent };

type Page = 'event' | 'guests';

export function EventView() {
  return <ForEvent page="event" />;
}

export function EventGuests() {
  return <ForEvent page="guests" />;
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

    api.event(eventId).then(
      (event) =>
        current &&
        setLoad(
          event.organisationId === organisationId
            ? { kind: 'loaded', event }
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
        <Link className="link-button event-back" to="/app/events">
          <span aria-hidden="true">‹ </span>
          {t('events.title')}
        </Link>
      ) : (
        <Link className="link-button event-back" to={`/app/events/${encodeURIComponent(eventId)}`}>
          <span aria-hidden="true">‹ </span>
          {t('eventPage.backToEvent')}
        </Link>
      )}

      {load.kind === 'loading' && (
        <p className="muted" role="status">
          {t('eventPage.loading')}
        </p>
      )}

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

      {load.kind === 'loaded' &&
        (page === 'event' ? (
          <EventPage
            event={load.event}
            heading={heading}
            onChange={(event) => setLoad({ kind: 'loaded', event })}
          />
        ) : (
          <GuestsComing event={load.event} heading={heading} />
        ))}
    </div>
  );
}

function EventPage({
  event,
  heading,
  onChange,
}: {
  event: OrganisationEvent;
  heading: RefObject<HTMLHeadingElement | null>;
  onChange: (event: OrganisationEvent) => void;
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
  const now = useServerNow();
  const loadedAt = useLoadedAt(event);
  const phase = shownPhase(event, loadedAt, now);

  useEffect(() => {
    if (editOutcome(location.state) == null && coverRefusal(location.state) == null) return;

    void navigate(
      { pathname: location.pathname, search: location.search, hash: location.hash },
      { replace: true, state: null },
    );
  }, [location, navigate]);

  return (
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
        now={now}
        manages={can(session, 'events.manage')}
        heading={heading}
        onChange={onChange}
        onMadeLive={() => setMadeLive(true)}
      />
      {madeLive && <OutcomeLine words={t('eventLive.madeLive')} />}
      {ended && <OutcomeLine words={t(PHASE_WORD.finished)} />}
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
      </div>
    </section>
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

/** Where the page begins after Save changes; once the person has moved focus, it is announced instead (sc-11370). */
function OutcomeLine({ words }: { words: string }) {
  const arriving = useContext(Arriving);
  const [taking] = useState(arriving);
  const [announced, setAnnounced] = useState('');

  useEffect(() => {
    if (taking) return;

    // Set after the region is in the page, so a screen reader hears the change rather than missing a region born full.
    const id = window.setTimeout(() => setAnnounced(words), 0);

    return () => window.clearTimeout(id);
  }, [taking, words]);

  return taking ? (
    <p className="event-page-outcome" tabIndex={-1} data-page-focus="">
      {words}
    </p>
  ) : (
    <p className={announced === '' ? 'visually-hidden' : 'event-page-outcome'} role="status">
      {announced}
    </p>
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
