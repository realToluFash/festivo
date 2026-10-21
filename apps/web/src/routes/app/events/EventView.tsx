import { ApiError, type OrganisationEvent } from '@soirely/api-client';
import { formatEventRange } from '@soirely/domain';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';

import { api } from '../../../api.ts';
import { currentLocale } from '../../../i18n/index.ts';
import { useSession } from '../../../session.ts';

type Load =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'notFound' }
  | { kind: 'loaded'; event: OrganisationEvent };

export function EventView() {
  const session = useSession();
  const { eventId = '' } = useParams();
  const organisationId = session.organisation?.id;

  if (organisationId == null) return null;

  return (
    <EventOf
      key={`${organisationId}:${eventId}`}
      organisationId={organisationId}
      eventId={eventId}
    />
  );
}

function EventOf({ organisationId, eventId }: { organisationId: string; eventId: string }) {
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
      <Link className="link-button event-back" to="/app/events">
        <span aria-hidden="true">‹ </span>
        {t('events.title')}
      </Link>

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

      {load.kind === 'loaded' && (
        <section className="card event-page-card" aria-labelledby="event-title">
          <div className="event-page-head">
            <h1 id="event-title">{load.event.name}</h1>
            <span className="pill-quiet">{t('events.draft')}</span>
          </div>
          <p>
            {t('eventPage.when', {
              range: formatEventRange(
                load.event.startsAt,
                load.event.endsAt,
                load.event.timeZone,
                currentLocale(),
              ),
              timeZone: load.event.timeZone,
            })}
          </p>
          <div>
            <Link className="button" to={`/app/events/${encodeURIComponent(load.event.id)}/guests`}>
              {t('eventPage.guests')}
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

export function EventGuests() {
  const { t } = useTranslation();
  const { eventId = '' } = useParams();

  return (
    <div className="event-page">
      <Link className="link-button event-back" to={`/app/events/${encodeURIComponent(eventId)}`}>
        <span aria-hidden="true">‹ </span>
        {t('eventPage.backToEvent')}
      </Link>
      <section className="card">
        <h1>{t('eventPage.guests')}</h1>
        <p>{t('eventPage.guestsComing')}</p>
      </section>
    </div>
  );
}
