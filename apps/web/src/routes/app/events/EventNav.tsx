import { EVENT_AREAS, type EventArea, isPlaceholderEventArea } from '@soirely/domain';
import { type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useMatch, useNavigate } from 'react-router';

export interface InsideEvent {
  eventId: string;
  area: EventArea;
  /** The event's page itself, on Overview: an area chosen from here is the one entry Back returns past. */
  onPage: boolean;
}

export function eventAreaPath(eventId: string, area: EventArea): string {
  const page = `/app/events/${encodeURIComponent(eventId)}`;

  return area === 'overview' ? page : `${page}/${area}`;
}

/** Inside an event: its page, an area, All dates, its Guests page and Edit details (sc-22103). */
export function useInsideEvent(): InsideEvent | null {
  const page = useMatch('/app/events/:eventId');
  const part = useMatch('/app/events/:eventId/:part');

  if (page?.params.eventId != null && page.params.eventId !== 'new') {
    return { eventId: page.params.eventId, area: 'overview', onPage: true };
  }

  const eventId = part?.params.eventId;
  const name = part?.params.part ?? '';

  if (eventId == null) return null;
  if (name === 'edit' || name === 'dates') return { eventId, area: 'overview', onPage: false };
  if (name === 'guests' || isPlaceholderEventArea(name)) {
    return { eventId, area: name, onPage: false };
  }

  return null;
}

/** Choosing an area replaces the one showing, so Back from any area returns to the page on Overview. */
export function EventNav({
  inside,
  onFollow,
}: {
  inside: InsideEvent;
  onFollow: (() => void) | undefined;
}) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const cameFromPage = fromPage(location.state);

  const backToPage = (event: MouseEvent<HTMLAnchorElement>) => {
    onFollow?.();
    if (!cameFromPage) return;

    event.preventDefault();
    void navigate(-1);
  };

  return (
    <nav className="shell-nav" aria-label={t('eventNav.label')}>
      <Link to="/app/events" onClick={onFollow}>
        {t('eventNav.back')}
      </Link>
      {EVENT_AREAS.map((area) => {
        const current = area === inside.area;

        return (
          <Link
            key={area}
            to={eventAreaPath(inside.eventId, area)}
            className={current ? 'active' : undefined}
            aria-current={current ? 'page' : undefined}
            replace={!inside.onPage && !(area === 'overview' && cameFromPage)}
            state={inside.onPage || cameFromPage ? { fromEventPage: true } : undefined}
            onClick={area === 'overview' && !inside.onPage ? backToPage : onFollow}
          >
            {t(`eventNav.${area}`)}
          </Link>
        );
      })}
    </nav>
  );
}

function fromPage(state: unknown): boolean {
  return typeof state === 'object' && state != null && 'fromEventPage' in state;
}
