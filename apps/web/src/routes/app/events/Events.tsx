import { type OrganisationEvent } from '@soirely/api-client';
import { formatEventDate } from '@soirely/domain';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { api } from '../../../api.ts';
import { currentLocale } from '../../../i18n/index.ts';
import { can, useSession } from '../../../session.ts';

type Load =
  { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; events: OrganisationEvent[] };

export function Events() {
  const { t } = useTranslation();
  const session = useSession();
  const organisation = session.organisation;

  if (organisation == null) return null;

  const creates = can(session, 'events.create');

  return (
    <div className="events">
      <div className="events-head">
        <h1>{t('events.title')}</h1>
        {creates && (
          <Link className="button button-primary" to="/app/events/new">
            {t('events.newEvent')}
          </Link>
        )}
      </div>
      <EventsOf key={organisation.id} organisationId={organisation.id} creates={creates} />
    </div>
  );
}

function EventsOf({ organisationId, creates }: { organisationId: string; creates: boolean }) {
  const { t } = useTranslation();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;

    api.events(organisationId).then(
      (events) => current && setLoad({ kind: 'loaded', events }),
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
      <div className="notice notice-broken" role="alert">
        <span className="mark mark-broken" aria-hidden="true">
          ✕
        </span>
        <div className="notice-body">
          <p>{t('events.failed')}</p>
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
    );
  }

  if (load.events.length === 0) return <FirstRun creates={creates} />;

  return (
    <ul className="card events-list">
      {load.events.map((event) => (
        <li key={event.id}>
          <Link className="events-row" to={`/app/events/${encodeURIComponent(event.id)}`}>
            <span className="events-row-name">{event.name}</span>
            <span className="pill-quiet">{t('events.draft')}</span>
            <span className="muted events-row-date">
              {formatEventDate(event.startsAt, event.timeZone, currentLocale())}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function FirstRun({ creates }: { creates: boolean }) {
  const { t } = useTranslation();
  const steps = [
    'events.firstRunStepName',
    'events.firstRunStepDefaults',
    'events.firstRunStepOpen',
  ];

  return (
    <section className="card events-first-run" aria-labelledby="events-first-run-title">
      <h2 id="events-first-run-title">{t('events.firstRunTitle')}</h2>
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
