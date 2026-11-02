/** An event's areas in [fd]'s order: inside an event they are the navigation menu, on both clients (sc-22103). */
export const EVENT_AREAS = [
  'overview',
  'guests',
  'menu',
  'seating',
  'messages',
  'schedule',
  'staff',
  'budget',
  'reports',
] as const;

export type EventArea = (typeof EVENT_AREAS)[number];

/** The phone's tab bar holds five: these four, then More with the rest, in [fd]'s order (pm, #25011). */
export const PHONE_EVENT_TABS = ['overview', 'guests', 'menu', 'messages'] as const;

export const MORE_EVENT_AREAS = EVENT_AREAS.filter(
  (area) => !(PHONE_EVENT_TABS as readonly EventArea[]).includes(area),
);

/** Built in neither client yet: each shows its panel saying it is coming, until its epic builds it. */
export const PLACEHOLDER_EVENT_AREAS = [
  'menu',
  'seating',
  'messages',
  'schedule',
  'staff',
  'budget',
  'reports',
] as const satisfies readonly EventArea[];

export type PlaceholderEventArea = (typeof PLACEHOLDER_EVENT_AREAS)[number];

export function isPlaceholderEventArea(value: string): value is PlaceholderEventArea {
  return (PLACEHOLDER_EVENT_AREAS as readonly string[]).includes(value);
}
