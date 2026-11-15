import type { OrganisationEvent } from '@soirely/api-client';
import { isPlaceholderEventArea, shownPhase } from '@soirely/domain';
import { type MouseEvent, useEffect, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useMatch, useNavigate } from 'react-router';

import { EventSideCard } from '../../../components/EventSideCard.tsx';
import { Glyph } from '../../../components/Glyph.tsx';
import { SIDE_AREAS, SIDE_AREA_GLYPHS, type SideArea } from '../../../components/eventSideAreas.ts';
import { cardTags, listEventOf, shownEvent } from '../../../eventsList.ts';
import { useLoadedAt, useServerNow } from '../../../serverNow.ts';

export interface InsideEvent {
  eventId: string;
  /** People (sc-29915) is the web's own entry after the areas, which both clients share. */
  area: SideArea;
  /** The event's page itself, on Overview: an area chosen from here is the one entry Back returns past. */
  onPage: boolean;
}

export function eventAreaPath(eventId: string, area: SideArea): string {
  const page = `/app/events/${encodeURIComponent(eventId)}`;

  return area === 'overview' ? page : `${page}/${area}`;
}

let shown: { eventId: string; event: OrganisationEvent } | null = null;
const heard = new Set<() => void>();

function told(): void {
  heard.forEach((listener) => listener());
}

/** The event, once its page has loaded it, for the band's crumb and the head of the event's sidebar. */
export function useShowEvent(eventId: string, event: OrganisationEvent | undefined): void {
  useEffect(() => {
    if (event == null) return;
    const mine = { eventId, event };
    shown = mine;
    told();

    return () => {
      if (shown !== mine) return;
      shown = null;
      told();
    };
  }, [eventId, event]);
}

export function useShownEvent(eventId: string | undefined): OrganisationEvent | undefined {
  const now = useSyncExternalStore(
    (listener) => {
      heard.add(listener);
      return () => heard.delete(listener);
    },
    () => shown,
  );

  return now != null && now.eventId === eventId ? now.event : undefined;
}

export function useShownEventName(eventId: string | undefined): string | undefined {
  return useShownEvent(eventId)?.name;
}

let gone: string | null = null;

/** An event its page found deleted or never there: the shell shows the organisation's sidebar instead of the event's (sc-1468). */
export function useGoneEvent(eventId: string, isGone: boolean): void {
  useEffect(() => {
    if (!isGone) return;
    gone = eventId;
    told();

    return () => {
      if (gone !== eventId) return;
      gone = null;
      told();
    };
  }, [eventId, isGone]);
}

function useGone(): string | null {
  return useSyncExternalStore(
    (listener) => {
      heard.add(listener);
      return () => heard.delete(listener);
    },
    () => gone,
  );
}

/** Inside an event: its page, an area, All dates, its Guests page and Edit details (sc-22103); not one found gone. */
export function useInsideEvent(): InsideEvent | null {
  const inside = useRoutedEvent();
  const goneId = useGone();

  return inside != null && inside.eventId === goneId ? null : inside;
}

function useRoutedEvent(): InsideEvent | null {
  const page = useMatch('/app/events/:eventId');
  const part = useMatch('/app/events/:eventId/:part');

  if (page?.params.eventId != null && page.params.eventId !== 'new') {
    return { eventId: page.params.eventId, area: 'overview', onPage: true };
  }

  const eventId = part?.params.eventId;
  const name = part?.params.part ?? '';

  if (eventId == null) return null;
  if (name === 'edit' || name === 'dates') return { eventId, area: 'overview', onPage: false };
  if (name === 'guests' || name === 'people' || isPlaceholderEventArea(name)) {
    return { eventId, area: name, onPage: false };
  }

  return null;
}

/** The event's own sidebar, as Events-A-Desk draws it: ‹ Events, the event's card, and its areas. Choosing an area replaces the one showing, so Back from any area returns to the page on Overview. */
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
  const event = useShownEvent(inside.eventId);

  const backToPage = (click: MouseEvent<HTMLAnchorElement>) => {
    onFollow?.();
    if (!cameFromPage) return;

    click.preventDefault();
    void navigate(-1);
  };

  return (
    <nav className="ev-side-nav" aria-label={t('eventNav.label')}>
      <div className="ev-side-event">
        <Link className="today-place ev-side-back" to="/app/events" onClick={onFollow}>
          <Glyph name="back" size={17} weight={2.4} />
          {t('nav.events')}
        </Link>
        {event != null && <SideCard event={event} />}
      </div>
      <ul className="today-places">
        {SIDE_AREAS.map((area) => {
          const current = area === inside.area;

          return (
            <li key={area}>
              <Link
                to={eventAreaPath(inside.eventId, area)}
                className={current ? 'today-place is-on' : 'today-place'}
                aria-current={current ? 'page' : undefined}
                replace={current || (!inside.onPage && !(area === 'overview' && cameFromPage))}
                state={inside.onPage || cameFromPage ? { fromEventPage: true } : undefined}
                onClick={area === 'overview' && !inside.onPage ? backToPage : onFollow}
              >
                <Glyph name={SIDE_AREA_GLYPHS[area]} />
                {t(`eventNav.${area}`)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Its phase and how soon, in the words of its card on Events. */
function SideCard({ event }: { event: OrganisationEvent }) {
  const { t } = useTranslation();
  const now = useServerNow();
  const loadedAt = useLoadedAt(event);
  const card = shownEvent(
    listEventOf({ ...event, milestones: [] }),
    shownPhase(event, loadedAt, now),
  );

  return (
    <EventSideCard
      event={card}
      when={cardTags(card, now, t)
        .map((tag) => tag.word)
        .join(' · ')}
    />
  );
}

function fromPage(state: unknown): boolean {
  return typeof state === 'object' && state != null && 'fromEventPage' in state;
}
