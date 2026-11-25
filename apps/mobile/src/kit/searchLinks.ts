import type { SearchRow } from '@soirely/domain';

import type { SignedIn } from '../signedIn.ts';
import { SEARCHED_FROM } from './eventBack.ts';
import { EVENT_AREA, eventHref } from './eventNav.ts';

/** The route param Guests opens a guest's details from, as a match in Search opens them (sc-39534). */
export const OPENED_GUEST = 'guest';

/** The route param Members takes the focus to a row from (sc-39534). */
export const SEARCHED_MEMBER = 'member';

/** The route param Events opens its search with, as Search's Show all opens it. */
export const EVENTS_SEARCHED = 'q';

export const SEARCH_HREF = '/search';

/** The route param Search opens with a term already typed, as an event's ‹ Search opens it on a tablet (sc-83008). */
export const SEARCH_OPENED_WITH = 'q';

/** Search runs over the organisation in use, so it is absent while the member is suspended from the one the screen names (sc-82858). */
export function searchOffered({
  organisation,
  pausedIn,
}: {
  organisation: SignedIn['organisation'];
  pausedIn?: SignedIn['pausedIn'] | undefined;
}): boolean {
  return organisation != null && pausedIn == null;
}

/** A row's place. `searched` is what was typed when Search closes before the event opens, as on a tablet, so the event's ‹ Search can open it again (sc-83008). */
export function searchRowHref(row: SearchRow, searched?: string): string {
  if (row.kind === 'event')
    return searched == null || searched === ''
      ? eventHref(row.id)
      : `${eventHref(row.id)}?${SEARCHED_FROM}=${encodeURIComponent(searched)}`;
  if (row.kind === 'guest')
    return `${eventHref(row.event)}?${EVENT_AREA}=guests&${OPENED_GUEST}=${encodeURIComponent(row.id)}`;

  return `/settings/members?${SEARCHED_MEMBER}=${encodeURIComponent(row.id)}`;
}

export function eventsSearchHref(term: string): string {
  return `/events?${EVENTS_SEARCHED}=${encodeURIComponent(term)}`;
}
