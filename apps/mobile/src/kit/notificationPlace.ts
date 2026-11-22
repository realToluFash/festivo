import type { Href } from 'expo-router';

import { SECTION_HREF } from './appNav.ts';

/** The server writes the web's path; the app opens its own screen for it, or stays in the bell when it has none. */
export function appPlace(place: string | null): Href | null {
  if (place == null) return null;

  const event = /^\/app\/events\/([^/?#]+)$/.exec(place);
  if (event?.[1] != null) return `/events/${event[1]}`;
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
