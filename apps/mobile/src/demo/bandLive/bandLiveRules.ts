/** `Event::NAME_MAXIMUM`: the longest name an event takes. */
export const EVENT_NAME_MAXIMUM = 120;

export type LiveEvent = 'diner' | 'long' | 'word' | 'wide' | 'none';

export const LIVE_EVENTS: readonly { key: LiveEvent; label: string }[] = [
  { key: 'diner', label: 'Dîner en direct' },
  { key: 'long', label: 'A long name' },
  { key: 'word', label: 'One long word' },
  { key: 'wide', label: '120 W, no space' },
  { key: 'none', label: 'No event live' },
];

const NAMES: Readonly<Record<Exclude<LiveEvent, 'none'>, string>> = {
  diner: 'Dîner en direct',
  long: 'Atelier Céleste Réceptions et Mariages',
  word: 'Internationalisationsorganisationsgesellschaft',
  wide: 'W'.repeat(EVENT_NAME_MAXIMUM),
};

export function liveEventName(event: Exclude<LiveEvent, 'none'>): string {
  return NAMES[event];
}

export function liveEventOf(given: string | undefined): LiveEvent {
  return LIVE_EVENTS.find((each) => each.key === given)?.key ?? 'diner';
}
