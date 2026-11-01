import { ApiError, type OrganisationEvent } from '@soirely/api-client';
import {
  type EventPhase,
  type PlaceholderEventArea,
  formatEventRange,
  isPlaceholderEventArea,
  rememberTabHolding,
  shownPhase,
} from '@soirely/domain';
import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';
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
import { PHASE_WORD } from './eventWords.ts';
import { DraftRow, StatusPill } from './MakeLive.tsx';
import { MuteEvent } from './MuteEvent.tsx';
import { PauseButton, PausedRow } from './PauseEvent.tsx';
import { OutcomeLine } from './OutcomeLine.tsx';
import { Placeholder } from './Placeholder.tsx';
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
          <EventTop
            event={load.event}
            tag={load.tag}
            heading={heading}
            onChange={(event, tag = load.tag) => setLoad({ kind: 'loaded', event, tag })}
          />
          {page === 'event' && (
            <Overview
              event={load.event}
              heading={heading}
              onChange={(event, tag = load.tag) => setLoad({ kind: 'loaded', event, tag })}
            />
          )}
          {page === 'guests' && <GuestsComing event={load.event} />}
          {page === 'dates' && <AllDatesPage event={load.event} heading={heading} />}
          {isPlaceholderEventArea(page) && <AreaComing event={load.event} area={page} />}
        </Arrived>
      )}
    </div>
  );
}

/** Above every area: the name, the phase, the dates, the venue, and the phase's one primary (sc-22103). */
function EventTop({
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
  const [madeLive, setMadeLive] = useState(false);
  const [resumed, setResumed] = useState(false);
  const now = useServerNow();
  const loadedAt = useLoadedAt(event);
  const phase = shownPhase(event, loadedAt, now);
  const manages = can(session, 'events.manage');

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
        {phase === 'finished' && can(session, 'events.create') && (
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
      <p className="event-top-invited">
        <Placeholder label={t('eventPage.invited')} />
      </p>
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

const OVERVIEW_TILES = ['tileComing', 'tileMealPicks', 'tileSeated', 'tileBudgetUsed'] as const;

/** The page's first area: [fd]'s tiles, then Details and Coming up, with Manage beside them where there is room. */
function Overview({
  event,
  heading,
  onChange,
}: {
  event: OrganisationEvent;
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
  const [ended, setEnded] = useState(false);
  const [paused, setPaused] = useState(false);
  const now = useServerNow();
  const loadedAt = useLoadedAt(event);
  const phase = shownPhase(event, loadedAt, now);
  const manages = can(session, 'events.manage');
  const creates = can(session, 'events.create');

  useEffect(() => {
    if (editOutcome(location.state) == null && coverRefusal(location.state) == null) return;

    void navigate(
      { pathname: location.pathname, search: location.search, hash: location.hash },
      { replace: true, state: null },
    );
  }, [location, navigate]);

  return (
    <div className="event-overview">
      <ul className="events-tiles event-tiles" aria-label={t('eventNav.overview')}>
        {OVERVIEW_TILES.map((tile) => (
          <li key={tile} className="events-tile">
            <Placeholder label={t(`eventPage.${tile}`)} labelClass="events-tile-label" />
          </li>
        ))}
      </ul>
      <CalledOffNotice event={event} />
      {ended && <OutcomeLine words={t(PHASE_WORD.finished)} />}
      {paused && <OutcomeLine words={t('eventPause.paused', { name: event.name })} />}
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
      <div className="event-overview-columns">
        <div className="event-overview-main">
          <Details event={event} manages={manages} />
          <ComingUp event={event} now={now} />
        </div>
        <section className="card event-manage" aria-labelledby="event-manage-title">
          <h2 id="event-manage-title">{t('eventPage.manage')}</h2>
          {manages && (
            <div className="event-manage-actions">
              <PauseButton
                event={event}
                phase={phase}
                heading={heading}
                onChange={onChange}
                onPaused={() => setPaused(true)}
              />
              <EndButton
                event={event}
                phase={phase}
                now={now}
                heading={heading}
                onChange={onChange}
                onEnded={() => setEnded(true)}
              />
            </div>
          )}
          {creates && phase !== 'finished' && (
            <div className="event-manage-actions">
              <DuplicateEvent event={event} />
            </div>
          )}
          <MuteEvent eventId={event.id} />
          {creates && <DeleteEvent event={event} />}
        </section>
      </div>
    </div>
  );
}

/** Each row opens Edit details at its own field for somebody who manages events, and nothing for anybody else. */
function Details({ event, manages }: { event: OrganisationEvent; manages: boolean }) {
  const { t } = useTranslation();
  const edit = `/app/events/${encodeURIComponent(event.id)}/edit`;
  const venue = event.venue;
  const address = venue?.address?.formatted ?? null;

  return (
    <section className="card event-details" aria-labelledby="event-details-title">
      <div className="event-details-head">
        <h2 id="event-details-title">{t('eventPage.details')}</h2>
        {manages && (
          <Link className="link-button" to={edit}>
            {t('eventEdit.open')}
          </Link>
        )}
      </div>
      <ul className="event-details-rows">
        <DetailRow label={t('eventPage.dates')} to={manages ? `${edit}#starts` : null}>
          <p>
            {t('eventPage.when', {
              range: formatEventRange(event.startsAt, event.endsAt, event.timeZone, dateLocale()),
              timeZone: event.timeZone,
            })}
          </p>
        </DetailRow>
        <DetailRow label={t('eventPage.venue')} to={manages ? `${edit}#venue` : null}>
          {venue == null ? (
            <>
              <p>{t('eventPage.venueToBeConfirmed')}</p>
              {manages && <p className="event-details-hint">{t('eventPage.addVenue')}</p>}
            </>
          ) : (
            <>
              {venue.name != null && <p className="event-details-strong">{venue.name}</p>}
              {address != null && <p>{address}</p>}
            </>
          )}
        </DetailRow>
        <DetailRow label={t('eventHosts.heading')} to={manages ? `${edit}#hosts` : null}>
          {event.hosts.length === 0 ? (
            <p>{t('eventHosts.none')}</p>
          ) : (
            <p>{event.hosts.join(', ')}</p>
          )}
          {manages && <p className="event-details-hint">{t('eventHosts.add')}</p>}
        </DetailRow>
      </ul>
    </section>
  );
}

function DetailRow({
  label,
  to,
  children,
}: {
  label: string;
  to: string | null;
  children: ReactNode;
}) {
  const body = (
    <>
      <span className="event-details-label">{label}</span>
      <span className="event-details-value">{children}</span>
    </>
  );

  return (
    <li>
      {to == null ? (
        <div className="event-details-row">{body}</div>
      ) : (
        <Link className="event-details-row event-details-link" to={to}>
          {body}
          <span className="event-details-chevron" aria-hidden="true">
            ›
          </span>
        </Link>
      )}
    </li>
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
    <section className="card timeline-page" aria-labelledby="all-dates-title">
      <h2 id="all-dates-title">{t('timeline.allDates')}</h2>
      <AllDates event={event} now={now} heading={heading} />
    </section>
  );
}

function GuestsComing({ event }: { event: OrganisationEvent }) {
  const { t } = useTranslation();

  usePageTitle(pageTitle(t, [t('eventPage.guests'), event.name]));

  return (
    <section className="card event-area" aria-labelledby="event-area-title">
      <h2 id="event-area-title">{t('eventPage.guests')}</h2>
      <p>{t('eventPage.guestsComing')}</p>
    </section>
  );
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
