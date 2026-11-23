import type { LayoutKind } from '../layout/classify.ts';

/** The screens an event's Overview names its ‹ after (sc-83008), another event's page among them, as the bell on an iPad opens one over it (sc-84453). */
export type BackScreen =
  'events' | 'today' | 'calendar' | 'search' | 'notifications' | 'auditLog' | 'entry' | 'event';

export const BACK_KEY: Record<BackScreen, string> = {
  events: 'eventsScreen.title',
  today: 'todayScreen.tab.today',
  calendar: 'calendar.title',
  search: 'todayScreen.search',
  notifications: 'notifications.heading',
  auditLog: 'auditLog.title',
  entry: 'auditLog.entry',
  event: 'timeline.backToEvent',
};

const SCREEN_OF_ROUTE: Readonly<Record<string, BackScreen>> = {
  index: 'today',
  'events/index': 'events',
  calendar: 'calendar',
  search: 'search',
  notifications: 'notifications',
  'settings/data-and-control/audit-log': 'auditLog',
  'settings/data-and-control/audit-entry': 'entry',
  'events/[id]/index': 'event',
};

/** The route param through which a tablet's Search, which closes its palette before the event opens, passes what was typed. */
export const SEARCHED_FROM = 'searched';

export type EventBack =
  | { screen: BackScreen; way: 'back' }
  | { screen: 'events'; way: 'events' }
  | { screen: 'search'; way: 'search'; term: string };

/** ‹ names the screen behind the event and goes back to it, as the platform's own back does. Nothing behind it, or a screen with no name here, is the unmatched value: Events, opened afresh. */
export function eventBack(
  routes: readonly { name?: string }[],
  index: number,
  searched: string | undefined,
): EventBack {
  if (searched != null && searched !== '')
    return { screen: 'search', way: 'search', term: searched };
  const behind = index > 0 ? routes[index - 1]?.name : undefined;
  const screen =
    behind != null && Object.hasOwn(SCREEN_OF_ROUTE, behind) ? SCREEN_OF_ROUTE[behind] : undefined;

  return screen == null ? { screen: 'events', way: 'events' } : { screen, way: 'back' };
}

/** On a phone and upright, Refreshing… beside Overview's ‹ gives way and takes its own line above the card, so ‹ is never shrunk or cut (sc-83008, as sc-71821 on Guests). */
export function overviewGivesWay(kind: LayoutKind, overviewBack: boolean): boolean {
  return overviewBack && kind !== 'tabletLandscape';
}
