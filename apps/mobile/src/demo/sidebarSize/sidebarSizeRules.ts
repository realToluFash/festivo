import { besideGlyph, fitWidest } from '../../layout/textSize.ts';
import { tokens } from '../../theme/tokens.ts';

export type SidebarSize = 'device' | 'default' | 'ninth' | 'tenth' | 'eleventh' | 'twelfth';
export type SidebarLanguage = 'en' | 'fr';
export type SidebarAt = 'today' | 'events' | 'calendar' | 'members' | 'event';

export const SIDEBAR_SIZES: readonly { key: SidebarSize; label: string }[] = [
  { key: 'device', label: 'This iPad' },
  { key: 'default', label: 'Default' },
  { key: 'ninth', label: 'Ninth step (AX2)' },
  { key: 'tenth', label: 'Tenth step (AX3)' },
  { key: 'eleventh', label: 'Eleventh step (AX4)' },
  { key: 'twelfth', label: 'Twelfth step (AX5)' },
];

export const SIDEBAR_LANGUAGES: readonly { key: SidebarLanguage; label: string }[] = [
  { key: 'en', label: 'English' },
  { key: 'fr', label: 'French' },
];

export const SIDEBAR_PLACES: readonly { key: SidebarAt; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'events', label: 'Events' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'members', label: 'Settings › Members' },
  { key: 'event', label: 'An event' },
];

// React Native's fontScale on iOS at each step, so the board draws what the app draws.
const SCALES: Readonly<Record<Exclude<SidebarSize, 'device'>, number>> = {
  default: 1,
  ninth: 2.143,
  tenth: 2.643,
  eleventh: 3.143,
  twelfth: 3.571,
};

export function sidebarScale(size: SidebarSize, deviceScale: number): number {
  return size === 'device' ? deviceScale : SCALES[size];
}

const LARGEST_SCALE = 2.4;

export function atLargest(scale: number): boolean {
  return scale >= LARGEST_SCALE;
}

export const SIDEBAR_WIDTH = 252;
const INNER = SIDEBAR_WIDTH - 2 * tokens.spacePillEnd;

export const PLACE_GLYPH = 18;
export const SEARCH_GLYPH = 16;
export const BACK_GLYPH = 17;
export const ORG_MARK = 28;
export const OPENER_GLYPH = 14;
export const CARD_THUMB = 40;
export const PERSON_GLYPH = 15;
const DOT = tokens.spaceMd + 2 * tokens.spaceXxs;

export interface SideRoom {
  size: number;
  glyph: number;
  inside: number;
  /** Space after every letter, which stays the same when the size steps down. */
  tracking?: number;
}

export const HEADING_TRACKING = 11 * 0.08;

export const ROOMS = {
  place: { size: 14.5, glyph: PLACE_GLYPH, inside: INNER - 3 * tokens.spaceLg },
  search: { size: 14, glyph: SEARCH_GLYPH, inside: INNER - 2 * tokens.spaceLg - tokens.spaceMd },
  back: { size: 14, glyph: BACK_GLYPH, inside: INNER - 2 * tokens.spaceMd - tokens.spaceXs },
  heading: { size: 12, glyph: 0, inside: INNER - 2 * tokens.spaceLg, tracking: HEADING_TRACKING },
  event: { size: 14, glyph: 0, inside: INNER - 3 * tokens.spaceLg - DOT },
  org: {
    size: 15,
    glyph: 0,
    inside: INNER - tokens.spaceSm - 3 * tokens.spaceMd - ORG_MARK - OPENER_GLYPH,
  },
  cardName: { size: 14, glyph: 0, inside: INNER - 3 * tokens.spaceMd - CARD_THUMB },
  cardTags: { size: 12.5, glyph: 0, inside: INNER - 3 * tokens.spaceMd - CARD_THUMB },
  person: {
    size: 14,
    glyph: 0,
    inside: INNER - 2 * tokens.spaceSm - 2 * tokens.spaceMd - tokens.space5xl - PERSON_GLYPH,
  },
  role: {
    size: 12,
    glyph: 0,
    inside: INNER - 2 * tokens.spaceSm - 2 * tokens.spaceMd - tokens.space5xl - PERSON_GLYPH,
  },
} as const satisfies Record<string, SideRoom>;

export interface Measured {
  /** Drawn at the start size, without its tracking. */
  width: number;
  letters: number;
}

export interface Widths {
  words: readonly Measured[];
  whole: Measured;
}

export function lettersIn(text: string): number {
  return Array.from(text).length;
}

/** A label, a name kept to one line, or a name over two lines. */
export type SideFit = 'label' | 'line' | 'lines';

// Below the largest sizes only a label whose widest word would break beside main's glyph steps down; a name draws as on main (sc-68441).
export function sideTextSize(
  room: SideRoom,
  scale: number,
  widths: Widths | null,
  fit: SideFit = 'label',
): number {
  const start = room.size * scale;
  const largest = atLargest(scale);
  const texts = fit === 'line' ? (widths == null ? [] : [widths.whole]) : (widths?.words ?? []);
  if (texts.length === 0 || (!largest && fit !== 'label')) return start;

  return Math.min(
    ...texts.map(({ width, letters }) => {
      const inside = room.inside - letters * (room.tracking ?? 0);

      return largest
        ? besideGlyph(room.size, start, width, room.glyph / room.size, inside)
        : fitWidest(room.size, start, width, inside - room.glyph);
    }),
  );
}

export function glyphSide(room: SideRoom, scale: number, drawn: number): number {
  return atLargest(scale) ? (room.glyph / room.size) * drawn : room.glyph;
}

/** 8 above and below a row's words from the tenth step, so a row taller than 44 never touches them; through the ninth, main's fixed 44. */
export function rowPad(scale: number): number {
  return atLargest(scale) ? tokens.spaceSm : 0;
}

export function sidebarSizeOf(name: string | undefined): SidebarSize {
  return SIDEBAR_SIZES.find((size) => size.key === name)?.key ?? 'device';
}

export function sidebarLanguageOf(name: string | undefined): SidebarLanguage {
  return SIDEBAR_LANGUAGES.find((language) => language.key === name)?.key ?? 'en';
}

export function sidebarAtOf(name: string | undefined): SidebarAt {
  return SIDEBAR_PLACES.find((place) => place.key === name)?.key ?? 'members';
}
