import { type OrganisationEvent } from '@soirely/api-client';
import { eventsInOrder, formatEventDate, serverClock, shownPhase } from '@soirely/domain';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router';

import { api } from '../../../api.ts';
import { dateLocale } from '../../../i18n/index.ts';
import { useServerNow } from '../../../serverNow.ts';
import { can, useSession } from '../../../session.ts';
import { useFocusOnceShown } from '../../../stepFocus.ts';
import { EventCoverImage } from './EventCoverImage.tsx';
import { typeLabel } from './eventTypes.ts';
import { StatusPill } from './MakeLive.tsx';
import { OutcomeLine } from './OutcomeLine.tsx';

type Load =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'loaded'; events: OrganisationEvent[]; at: Date };

export function Events() {
  const { t } = useTranslation();
  const session = useSession();
  const organisation = session.organisation;
  const title = useRef<HTMLHeadingElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [deleted] = useState(() => deletedEvent(location.state));

  useEffect(() => {
    if (deletedEvent(location.state) == null) return;

    void navigate(
      { pathname: location.pathname, search: location.search, hash: location.hash },
      { replace: true, state: null },
    );
  }, [location, navigate]);

  if (organisation == null) return null;

  const creates = can(session, 'events.create');

  return (
    <div className="events">
      <div className="events-head">
        <h1 ref={title} tabIndex={-1}>
          {t('events.title')}
        </h1>
        {creates && (
          <Link className="button button-primary" to="/app/events/new">
            {t('events.newEvent')}
          </Link>
        )}
      </div>
      {deleted != null && <OutcomeLine words={t('eventDelete.deleted', { event: deleted })} />}
      <EventsOf
        key={organisation.id}
        organisationId={organisation.id}
        creates={creates}
        title={title}
      />
    </div>
  );
}

function EventsOf({
  organisationId,
  creates,
  title,
}: {
  organisationId: string;
  creates: boolean;
  title: RefObject<HTMLHeadingElement | null>;
}) {
  const { t } = useTranslation();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const failedLine = useRef<HTMLParagraphElement>(null);
  const firstRunTitle = useRef<HTMLHeadingElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const land = useFocusOnceShown();
  const now = useServerNow();

  useEffect(() => {
    let current = true;

    api.events(organisationId).then(
      (events) => current && setLoad({ kind: 'loaded', events, at: serverClock.now() }),
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
      <div className="notice notice-broken" role={attempt > 0 ? undefined : 'alert'}>
        <span className="mark mark-broken" aria-hidden="true">
          ✕
        </span>
        <div className="notice-body">
          <p ref={failedLine} tabIndex={-1}>
            {t('events.failed')}
          </p>
          <button
            type="button"
            className="button"
            onClick={() => {
              setLoad({ kind: 'loading' });
              setAttempt((n) => n + 1);
              land(
                () =>
                  failedLine.current ??
                  firstRunTitle.current ??
                  (list.current == null ? null : title.current),
              );
            }}
          >
            {t('events.retry')}
          </button>
        </div>
      </div>
    );
  }

  if (load.events.length === 0) return <FirstRun creates={creates} title={firstRunTitle} />;

  return (
    <ul className="card events-list" ref={list}>
      {eventsInOrder(load.events, dateLocale()).map((event) => (
        <li key={event.id}>
          <Link className="events-row" to={`/app/events/${encodeURIComponent(event.id)}`}>
            <EventCoverImage
              photo={event.cover}
              type={event.type}
              sizes="6rem"
              className="events-row-cover"
            />
            <span className="events-row-title">
              <span className="events-row-name">{event.name}</span>
              <span className="muted">{typeLabel(event.type, t)}</span>
            </span>
            <StatusPill phase={shownPhase(event, load.at, now)} />
            <span className="muted events-row-date">
              {formatEventDate(event.startsAt, event.timeZone, dateLocale())}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function FirstRun({
  creates,
  title,
}: {
  creates: boolean;
  title: RefObject<HTMLHeadingElement | null>;
}) {
  const { t } = useTranslation();
  const steps = [
    'events.firstRunStepName',
    'events.firstRunStepDefaults',
    'events.firstRunStepOpen',
  ];

  return (
    <section className="card events-first-run" aria-labelledby="events-first-run-title">
      <h2 id="events-first-run-title" ref={title} tabIndex={-1}>
        {t('events.firstRunTitle')}
      </h2>
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

/** Set by Delete event on its way to the Events list, which says the event was deleted. */
function deletedEvent(state: unknown): string | null {
  const deleted =
    typeof state === 'object' && state != null && 'deletedEvent' in state
      ? state.deletedEvent
      : null;

  return typeof deleted === 'string' ? deleted : null;
}
