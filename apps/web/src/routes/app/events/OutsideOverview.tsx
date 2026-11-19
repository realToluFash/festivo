import type { OrganisationEvent, OutsideEvent } from '@soirely/api-client';
import { formatEventRange } from '@soirely/domain';
import { type RefObject, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { api } from '../../../api.ts';
import { Glyph } from '../../../components/Glyph.tsx';
import { Chevron, RowWords } from '../../../components/SettingsParts.tsx';
import { dateLocale } from '../../../i18n/index.ts';
import { eventAreaPath } from './EventNav.tsx';
import '../../../components/SettingsParts.css';
import '../../../components/EventsList.css';
import '../../../components/desk.css';
import '../../app/outside.css';

const PIECES = [1, 2, 3, 4, 5, 6];

/** Overview for Can view and Can check guests in held from outside an organisation, as the `no-org` demo draws it: the event's card with the level line, then Guests and People (sc-71). */
export function OutsideOverview({
  event,
  held,
  heading,
}: {
  event: OrganisationEvent;
  held: OutsideEvent;
  heading: RefObject<HTMLHeadingElement | null>;
}) {
  const { t } = useTranslation();
  const onEvent = usePeopleCount(event.id);
  const place = event.venue?.name ?? event.venue?.address?.formatted ?? null;
  const until = new Intl.DateTimeFormat(dateLocale(), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: event.timeZone,
  }).format(new Date(event.endsAt));
  const level = [
    t(`eventPeople.role.${held.role}`),
    held.jobLabel,
    t('outsideEvent.until', { when: until }),
  ].filter((part) => part != null && part !== '');

  return (
    <div className="desk-column">
      <section className="ev-card today-cover is-wed" aria-labelledby="outside-event-name">
        {PIECES.map((piece) => (
          <span key={piece} className={`desk-piece p${piece}`} aria-hidden="true" />
        ))}
        <div className="ev-card-inner">
          <p className="desk-on-card">
            {formatEventRange(event.startsAt, event.endsAt, event.timeZone, dateLocale())}
          </p>
          <h1 id="outside-event-name" ref={heading} className="ev-card-name" tabIndex={-1}>
            {event.name}
          </h1>
          <p className="desk-on-card">{place ?? t('eventPage.venueToBeConfirmed')}</p>
          <p className="desk-on-card">{level.join(' · ')}</p>
        </div>
      </section>
      <ul className="desk-rows has-lead">
        <li>
          <Link className="desk-row" to={eventAreaPath(event.id, 'guests')}>
            <span className="outside-lead" aria-hidden="true">
              <Glyph name="users" size={20} />
            </span>
            <RowWords title={t('eventNav.guests')} lines={[t('outsideEvent.guestsLine')]} />
            <Chevron />
          </Link>
        </li>
        <li>
          <Link className="desk-row" to={eventAreaPath(event.id, 'people')}>
            <span className="outside-lead" aria-hidden="true">
              <Glyph name="people" size={20} />
            </span>
            <RowWords
              title={t('eventNav.people')}
              lines={onEvent == null ? [] : [t('outsideEvent.onEvent', { count: onEvent })]}
            />
            <Chevron />
          </Link>
        </li>
      </ul>
    </div>
  );
}

function usePeopleCount(eventId: string): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let current = true;

    api.eventPeople(eventId).then(
      ({ people }) => current && setCount(people.length),
      () => undefined,
    );

    return () => {
      current = false;
    };
  }, [eventId]);

  return count;
}
