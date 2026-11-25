import { LABEL_LINE, atAccessibilitySizes, fitWidest } from '../../layout/textSize.ts';
import { tokens } from '../../theme/tokens.ts';

/** The live line's size at the default size, as main's band draws it. */
export const LIVE_LINE = 13.5;
/** Where main draws the tab capsule below the top of the band's row (`capsuleAt`). */
export const CAPSULE_TOP = 7;
export const LIVE_GAP = tokens.spaceMd;
export const LIVE_FOOT = tokens.spaceLg;
export const LIVE_SIDES = tokens.spaceXl;
export const LIVE_DOT = tokens.spaceSm;
export const LIVE_DOT_GAP = tokens.spaceXs;
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

/** The width the line's words have: the band less its sides, the dot and the dot's gap. */
export function liveRoom(bandWidth: number): number {
  return Math.max(0, bandWidth - 2 * LIVE_SIDES - LIVE_DOT - LIVE_DOT_GAP);
}

export function liveLineHeight(size: number): number {
  return Math.ceil(size * LABEL_LINE);
}

/** The live line's size: main's at the standard sizes; from AX1, where it wraps between words, stepped down only as far as its widest word needs, never under 13.5 (sc-92315). */
export function liveLine(scale: number, widestAtStart: number, room: number): number {
  const start = LIVE_LINE * scale;

  if (!atAccessibilitySizes(scale)) return start;

  return fitWidest(LIVE_LINE, start, widestAtStart, room);
}
