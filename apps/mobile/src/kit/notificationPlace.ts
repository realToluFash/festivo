import type { Href } from 'expo-router';

import { SECTION_HREF } from './appNav.ts';

/** The server writes the web's path; the app opens its own screen for it, or stays in the bell when it has none. */
export function appPlace(place: string | null): Href | null {
  if (place == null) return null;

  const event = /^\/app\/events\/([^/?#]+)$/.exec(place);
  if (event?.[1] != null) return `/events/${event[1]}`;
  if (place === '/app/events') return '/events';
  if (place === '/app/account/notifications') return SECTION_HREF.notifications;

  return null;
}
