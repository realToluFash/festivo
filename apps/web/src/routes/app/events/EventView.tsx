import { ApiError, type OrganisationEvent } from '@soirely/api-client';
import { formatEventRange } from '@soirely/domain';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useParams } from 'react-router';

import { api } from '../../../api.ts';
import { dateLocale } from '../../../i18n/index.ts';
import { can, useSession } from '../../../session.ts';
import { type EditOutcome } from './EditEvent.tsx';

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
        <div className="notice notice-broken" role="alert">
          <span className="mark mark-broken" aria-hidden="true">
            ✕
          </span>
          <div className="notice-body">
            <p>{t('eventPage.failed')}</p>
            <button
              type="button"
              className="button"
              onClick={() => {
                setLoad({ kind: 'loading' });
                setAttempt((n) => n + 1);
              }}
            >
              {t('events.retry')}
            </button>
          </div>
        </div>
      )}

      {load.kind === 'notFound' && (
        <section className="card">
          <h1>{t('eventPage.notFound')}</h1>
        </section>
      )}

      {load.kind === 'loaded' &&
        (page === 'event' ? <EventPage event={load.event} /> : <GuestsComing />)}
    </div>
  );
}

function EventPage({ event }: { event: OrganisationEvent }) {
  const { t } = useTranslation();
  const session = useSession();
  const outcome = editOutcome(useLocation().state);
  const [announced, setAnnounced] = useState('');

  useEffect(() => {
    if (outcome == null) return;

    // Set after the region is in the page, so a screen reader hears the change rather than missing a region born full.
    const id = window.setTimeout(
      () =>
        setAnnounced(outcome === 'saved' ? t('eventEdit.saved') : t('eventEdit.nothingChanged')),
      0,
    );

    return () => window.clearTimeout(id);
  }, [outcome, t]);

  return (
    <section className="card event-page-card" aria-labelledby="event-title">
      <div className="event-page-head">
        <h1 id="event-title">{event.name}</h1>
        <span className="pill-quiet">{t('events.draft')}</span>
      </div>
      <p>
        {t('eventPage.when', {
          range: formatEventRange(event.startsAt, event.endsAt, event.timeZone, dateLocale()),
          timeZone: event.timeZone,
        })}
      </p>
      <p className={announced === '' ? 'visually-hidden' : 'event-page-outcome'} role="status">
        {announced}
      </p>
      <div className="event-page-actions">
        {can(session, 'events.manage') && (
          <Link className="button" to={`/app/events/${encodeURIComponent(event.id)}/edit`}>
            {t('eventEdit.open')}
          </Link>
        )}
        <Link className="button" to={`/app/events/${encodeURIComponent(event.id)}/guests`}>
          {t('eventPage.guests')}
        </Link>
      </div>
    </section>
  );
}

function editOutcome(state: unknown): EditOutcome | null {
  const edit = typeof state === 'object' && state != null && 'edit' in state ? state.edit : null;

  return edit === 'saved' || edit === 'unchanged' ? edit : null;
}

function GuestsComing() {
  const { t } = useTranslation();

  return (
    <section className="card">
      <h1>{t('eventPage.guests')}</h1>
      <p>{t('eventPage.guestsComing')}</p>
    </section>
  );
}
