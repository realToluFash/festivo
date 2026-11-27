import type { Href } from 'expo-router';

import { SECTION_HREF } from './appNav.ts';
import { EVENT_AREA, GUESTS_FILTER } from './eventNav.ts';
import { GUESTS_SINCE } from './guestChanges.ts';

/** The server writes the web's path; the app opens its own screen for it, or stays in the bell when it has none. */
export function appPlace(place: string | null): Href | null {
  if (place == null) return null;

  const event = /^\/app\/events\/([^/?#]+)$/.exec(place);
  if (event?.[1] != null) return `/events/${event[1]}`;
  const myNight = /^\/app\/events\/([^/?#]+)\/my-night$/.exec(place);
  if (myNight?.[1] != null) return `/events/${myNight[1]}/my-night`;
  const track = /^\/app\/events\/([^/?#]+)\/schedule\?track=([^&#]*)$/.exec(place);
  if (track?.[1] != null && track[2] != null)
    return `/events/${track[1]}/night?track=${track[2]}` as Href;
  const changed = /^\/app\/events\/([^/?#]+)\/guests\?filter=changed&since=([^&#]*)$/.exec(place);
  if (changed?.[1] != null && changed[2] != null)
    return `/events/${changed[1]}?area=guests&filter=changed&since=${changed[2]}` as Href;
  if (place === '/app/events') return '/events';
  if (place === '/app/account/notifications') return SECTION_HREF.notifications;

  return null;
}

/** A notification for the event already open opens no second copy of it (sc-84453): the open page takes the area it names, Overview unless it names one. Any other place is pushed. */
export function sameEventParams(
  place: Href,
  pathname: string,
): Record<string, string | undefined> | null {
  if (typeof place !== 'string') return null;
  const [path = '', query = ''] = place.split('?');
  if (!path.startsWith('/events/') || path !== pathname) return null;
  const params = new URLSearchParams(query);

  return {
    [EVENT_AREA]: params.get(EVENT_AREA) ?? undefined,
    [GUESTS_FILTER]: params.get(GUESTS_FILTER) ?? undefined,
    [GUESTS_SINCE]: params.get(GUESTS_SINCE) ?? undefined,
  };
}

/** What a tap in the bell does: only the popover over an event's page sets that page's params instead of pushing a second copy (sc-84453). */
export function bellOpens(
  place: Href,
  pathname: string,
  kind: 'screen' | 'popover' | 'framed',
): { push: Href } | { setParams: Record<string, string | undefined> } {
  const here = kind === 'popover' ? sameEventParams(place, pathname) : null;

  return here == null ? { push: place } : { setParams: here };
}
