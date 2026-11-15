import type { SearchRow } from '@soirely/domain';

import { EVENT_AREA, eventHref } from './eventNav.ts';

/** The route param Guests opens a guest's details from, as a match in Search opens them (sc-39534). */
export const OPENED_GUEST = 'guest';

/** The route param Members takes the focus to a row from (sc-39534). */
export const SEARCHED_MEMBER = 'member';

/** The route param Events opens its search with, as Search's Show all opens it. */
export const EVENTS_SEARCHED = 'q';

export const SEARCH_HREF = '/search';

export function searchRowHref(row: SearchRow): string {
  if (row.kind === 'event') return eventHref(row.id);
  if (row.kind === 'guest')
    return `${eventHref(row.event)}?${EVENT_AREA}=guests&${OPENED_GUEST}=${encodeURIComponent(row.id)}`;

  return row.invitation
    ? '/settings/members'
    : `/settings/members?${SEARCHED_MEMBER}=${encodeURIComponent(row.id)}`;
}

export function eventsSearchHref(term: string): string {
  return `/events?${EVENTS_SEARCHED}=${encodeURIComponent(term)}`;
}
