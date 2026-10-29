import { SECTION_HREF } from './appNav.ts';

/** The server writes the web's path; the app opens its own screen for it, or stays in the bell when it has none. */
export function appPlace(place: string | null): string | null {
  if (place == null) return null;

  const event = /^\/app\/events\/([^/?#]+)$/.exec(place);
  if (event?.[1] != null) return `/events/${event[1]}`;
  if (place === '/app/events') return '/events';
  if (place === '/app/account/notifications') return SECTION_HREF.notifications;

  return null;
}

/** "at 14:05" today, the locale's date before today. */
export function whenShown(
  createdAt: string,
  now: Date,
  locale: string,
): { today: true; time: string } | { today: false; date: string } {
  const at = new Date(createdAt);

  if (at.toDateString() === now.toDateString()) {
    return {
      today: true,
      time: new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(at),
    };
  }

  return {
    today: false,
    date: new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    }).format(at),
  };
}

/** 1 to 99, then the locale's "99+", and none at 0. */
export function badgeOf(unread: number, overNinetyNine: string): string | null {
  if (unread <= 0) return null;

  return unread > 99 ? overNinetyNine : String(unread);
}
