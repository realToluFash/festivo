import type { CoverLayout } from '../../components/TodayCover.tsx';

/** What an event's Overview was pushed over (sc-83008). Navigation state, never the API's: the app knows it from where the person tapped. */
export const OPENERS = [
  'events',
  'happeningNow',
  'today',
  'todayNew',
  'calendar',
  'calendarNew',
  'search',
  'notifications',
  'audit',
  'eventBell',
  'eventBellGone',
  'outside',
  'notificationStart',
  'signIn',
] as const;
export type Opener = (typeof OPENERS)[number];

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

/** The event the bell was opened over on an iPad (sc-84453), at the area it showed with its filter set; the board's second one was deleted while the new event was open. */
export const EVENT_BEHIND = '/demo/events/evt-party-2?area=guests&filter=coming';
const EVENT_BEHIND_GONE = '/demo/events/evt-party-2?area=guests&state=eventDeleted';

export const BACK_HREF: Record<BackScreen, string> = {
  events: '/demo/events',
  today: '/demo/today',
  calendar: '/demo/calendar',
  search: '/demo/search',
  notifications: '/demo/bell',
  auditLog: '/demo/settings/data-and-control/audit-log',
  entry: '/demo/settings/data-and-control/audit-log',
  event: EVENT_BEHIND,
};

export interface Opened {
  opener: Opener | null;
  pushed: boolean;
  term: string | null;
  spanish: boolean;
  refreshing: boolean;
  /** The board's bell over the event already open, open as the page loads (sc-84453). */
  bell?: boolean;
}

export function openerOf(value: string | undefined): Opener | null {
  return OPENERS.find((opener) => opener === value) ?? null;
}

/** The screen behind the event. New event gives its place to the event it made, so ‹ names what New event was opened from. The audit log shows an entry beside itself on an iPad and as its own screen on a phone, one level below the log (sc-611). On an iPad the bell is a popover that closes as the event opens (sc-83081), so ‹ names the screen it was over, Today here. Nothing in the app behind it, the unmatched value, is Events, as today. */
export function backScreenOf(opener: Opener | null, layout: CoverLayout): BackScreen {
  switch (opener) {
    case 'today':
    case 'todayNew':
      return 'today';
    case 'calendar':
    case 'calendarNew':
      return 'calendar';
    case 'search':
      return 'search';
    case 'notifications':
      return layout === 'phone' ? 'notifications' : 'today';
    case 'audit':
      return layout === 'phone' ? 'entry' : 'auditLog';
    case 'eventBell':
    case 'eventBellGone':
      return layout === 'phone' ? 'notifications' : 'event';
    default:
      return 'events';
  }
}

/** Whether something in the app is behind the event, so the platform's own back and ‹ both return to it. */
export function opensOver(opener: Opener | null): boolean {
  return (
    opener != null && opener !== 'outside' && opener !== 'notificationStart' && opener !== 'signIn'
  );
}

/** The query a screen of the demo adds when it pushes an event over itself, so ‹ can go back to it rather than to the screen it names. */
export function openedOver(opener: Opener): Record<string, string> {
  return { from: opener, pushed: '1' };
}

export function withFrom(href: string, opener: Opener): string {
  return `${fromOnly(href, opener)}&pushed=1`;
}

function fromOnly(href: string, opener: Opener): string {
  return `${href}${href.includes('?') ? '&' : '?'}from=${opener}`;
}

/** On an iPad an event opened from the bell over another event's page goes back to that event (sc-84453); a phone's bell is its own screen, so it is not offered there. */
export function openersFor(layout: CoverLayout): readonly Opener[] {
  return layout === 'phone'
    ? OPENERS.filter((opener) => opener !== 'eventBell' && opener !== 'eventBellGone')
    : OPENERS;
}

/** Where ‹ takes the event: Events as today, back when the screen it names is really under the event, else straight to that screen, Search with what was typed (an iPad closes its palette before the event opens). */
export function wayBack(
  screen: BackScreen,
  over: Opener,
  opened: Opened | undefined,
): 'events' | 'back' | string {
  if (screen === 'events') return 'events';
  if (screen === 'event' && over === 'eventBellGone') return EVENT_BEHIND_GONE;
  const asOpened = opened != null && over === opened.opener;
  // The demo's bell is its own screen even on an iPad, where the product's popover leaves nothing under the event.
  const under = over !== 'notifications' || screen === 'notifications';
  if (asOpened && opened.pushed && opensOver(over) && under) return 'back';
  const term = asOpened ? opened.term : null;

  return screen === 'search' && term != null && term !== ''
    ? `${BACK_HREF.search}?q=${encodeURIComponent(term)}`
    : BACK_HREF[screen];
}

/** Where a notification about the sample event opens it: Changed guests at its Guests, the rest at its Overview. */
export function bellOpens(key: string): 'guests' | 'overview' {
  return key === 'replies' ? 'guests' : 'overview';
}

export function bellHref(key: string): string {
  const event = '/demo/events/evt-wed-4';

  return withFrom(bellOpens(key) === 'guests' ? `${event}?area=guests` : event, 'eventBell');
}

/** The picker's words for each opener; on a phone an audit log event opens from the entry's own screen. */
export function openerWords(opener: Opener, layout: CoverLayout): string {
  switch (opener) {
    case 'events':
      return 'Events list';
    case 'happeningNow':
      return 'Happening now';
    case 'today':
      return 'Today';
    case 'todayNew':
      return 'New event from Today';
    case 'calendar':
      return 'Calendar';
    case 'calendarNew':
      return 'New event from the Calendar';
    case 'search':
      return 'Search';
    case 'notifications':
      return layout === 'phone' ? 'Notifications' : 'The bell over Today';
    case 'audit':
      return layout === 'phone' ? 'An audit log entry' : 'Audit log';
    case 'eventBell':
      return "Another event's page, from the bell";
    case 'eventBellGone':
      return 'That event, deleted while this one is open';
    case 'outside':
      return 'A link from outside';
    case 'notificationStart':
      return 'A notification that started the app';
    case 'signIn':
      return 'After signing in';
  }
}

const BOARD_EVENT = '/demo/events/evt-wed-4';

export const BEHIND_BOARDS: readonly { title: string; what: string; href: string }[] = [
  ...OPENERS.map((opener) => ({
    title: `‹ over ${openerWords(opener, 'portrait')}`,
    what:
      opener === 'audit'
        ? 'Audit log on an iPad, Entry on a phone'
        : opener === 'notifications'
          ? 'Notifications on a phone; on an iPad the popover closes, ‹ Today'
          : opener === 'eventBell'
            ? 'iPad upright: ‹ Event, back to the event behind, its Guests filtered to Coming'
            : opener === 'eventBellGone'
              ? 'iPad upright: ‹ Event still, and that page reads This event is not available'
              : opensOver(opener)
                ? 'Names it and goes back to it'
                : 'Nothing behind it: Events, as today',
    href: fromOnly(BOARD_EVENT, opener),
  })),
  {
    title: '‹ Notificaciones · Actualizando…',
    what: 'The iPhone SE in Spanish: whole beside it, its own line at larger sizes',
    href: `${fromOnly(BOARD_EVENT, 'notifications')}&lang=es&refreshing=1`,
  },
  {
    title: '‹ Today · Refreshing…',
    what: 'Any opener: Refreshing… beside ‹, from the picker',
    href: `${fromOnly(BOARD_EVENT, 'today')}&refreshing=1`,
  },
  {
    title: 'The bell over the event already open',
    what: 'iPad: no second page; Changed guests opens its Guests filtered to changed, ‹ as before',
    href: `${fromOnly(BOARD_EVENT, 'today')}&bell=open`,
  },
  {
    title: '‹ Today after a move',
    what: 'Its link moved the account into Casa Lumen, over Today (sc-80863)',
    href: `${BOARD_EVENT}?link=moved&from=today`,
  },
];
