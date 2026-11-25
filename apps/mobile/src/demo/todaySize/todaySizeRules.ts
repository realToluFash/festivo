import { PILL_BESIDE_TABS, pillBesideTabs } from '../../kit/frameBand.ts';
import {
  capsuleLabelSize,
  capsuleRoom,
  capsuleWidth,
  pillGivesWay,
} from '../../layout/capsuleFit.ts';
import type { LayoutKind } from '../../layout/classify.ts';
import { PILL_CHROME, WAITING_RING, pillShowsWords } from '../../layout/pillFit.ts';
import { atAccessibilitySizes, fitWidest, labelStart, piecesIn } from '../../layout/textSize.ts';
import { tokens } from '../../theme/tokens.ts';

export type TodayName = 'qa' | 'long';
export type TodayGreeting = 'morning' | 'evening' | 'welcome';

export const TODAY_NAMES: readonly { key: TodayName; label: string }[] = [
  { key: 'qa', label: 'QA' },
  { key: 'long', label: 'Maximiliano-Bartholomew' },
];

export const TODAY_GREETINGS: readonly { key: TodayGreeting; label: string }[] = [
  { key: 'morning', label: 'Morning' },
  { key: 'evening', label: 'Evening' },
  { key: 'welcome', label: 'First run' },
];

export const HEAD = 22;
export const HEAD_LINK = 14.5;
export const NEXT_UP = 12;

/** Main's sizes on the cover: the phone's foot, the iPad's foot upright, the banner on its side. */
export function greetingSize(kind: LayoutKind): number {
  return kind === 'phone' ? 32 : kind === 'tabletPortrait' ? 46 : 38;
}

export function subSize(kind: LayoutKind): number {
  return kind === 'phone' ? 16 : kind === 'tabletPortrait' ? 19 : 17;
}

export function greetingMost(kind: LayoutKind): number | undefined {
  return kind === 'tabletPortrait' ? 620 : kind === 'tabletLandscape' ? 520 : undefined;
}

export function wordsStart(size: number, scale: number, cap: number): number {
  return atAccessibilitySizes(scale) ? labelStart(size, scale, cap) : size * scale;
}

/** Below AX1 main's size; from AX1 the largest at which the widest piece fits `room`, never under `size` (sc-69816). */
export function wordsSize(
  size: number,
  scale: number,
  cap: number,
  widest: number,
  room: number,
): number {
  const start = wordsStart(size, scale, cap);

  return atAccessibilitySizes(scale) ? fitWidest(size, start, widest, room) : start;
}

/** A comma stays on its word, so no line starts with one (UAX #14, LB13); a name splits only after its own hyphen. */
export function piecesOfLine(text: string): string[] {
  return piecesIn([text]);
}

export function linkUnder(scale: number): boolean {
  return atAccessibilitySizes(scale);
}

export function greetingName(name: TodayName): string {
  return TODAY_NAMES.find((one) => one.key === name)?.label ?? 'QA';
}

export type TodayEventName = 'sample' | 'oneWord';

export const TODAY_EVENT_NAMES: readonly { key: TodayEventName; label: string }[] = [
  { key: 'sample', label: 'As they are' },
  { key: 'oneWord', label: 'One long word' },
];

export const ONE_WORD = 'Internationalisationsorganisationsgesellschaft';

export const EVENT_NAME = 15;
export const EVENT_DATES = 13;
export const EVENT_CHIP = 12;
export const EVENT_CHIP_ON_COVER = 12.5;
export const EVENT_READY = 12.5;

export const TODAY_GUTTER = tokens.spaceXxl;

export function thumbAbove(scale: number): boolean {
  return atAccessibilitySizes(scale);
}

export function chipsUnderDates(scale: number): boolean {
  return atAccessibilitySizes(scale);
}

export function weekWidth(window: number): number {
  return Math.min(440, Math.round((window - 3 * 28) * 0.58));
}

/** A row's other labels start no larger than its name draws, so the name is never smaller than its dates. */
export function underName(cap: number, name: number | null): number {
  return Math.min(cap, name ?? Infinity);
}

export interface SizeEvent {
  key: 'party' | 'ireti' | 'wed' | 'draft';
  name: string;
  first: string;
  last: string;
  draft: boolean;
  coming: number | null;
  invited: number;
  replied: number;
}

/** Today is Wednesday 25 November 2026: the party is on Sunday the 29th, so its date reads dimanche 29 nov. */
export const SIZE_TODAY = '2026-11-25';

export const SIZE_EVENTS: readonly SizeEvent[] = [
  {
    key: 'party',
    name: 'Ire Events end-of-year party',
    first: '2026-11-29',
    last: '2026-11-29',
    draft: false,
    coming: 42,
    invited: 80,
    replied: 54,
  },
  {
    key: 'ireti',
    name: 'Ireti at 40',
    first: '2026-12-12',
    last: '2026-12-13',
    draft: false,
    coming: 18,
    invited: 30,
    replied: 21,
  },
  {
    key: 'wed',
    name: 'Adaeze & Tunde’s wedding',
    first: '2027-02-05',
    last: '2027-02-07',
    draft: false,
    coming: null,
    invited: 0,
    replied: 0,
  },
  {
    key: 'draft',
    name: 'Bisi & Kola’s engagement',
    first: '2027-01-09',
    last: '2027-01-09',
    draft: true,
    coming: null,
    invited: 0,
    replied: 0,
  },
];

export function daysUntil(today: string, date: string): number {
  return Math.round((Date.parse(`${date}T00:00Z`) - Date.parse(`${today}T00:00Z`)) / 86_400_000);
}

export function sizeEvents(name: TodayEventName): SizeEvent[] {
  return SIZE_EVENTS.map((event, index) =>
    index === 0 && name === 'oneWord' ? { ...event, name: ONE_WORD } : event,
  );
}

export type TodayOrg = 'qa' | 'lumen' | 'ire' | 'several' | 'oneWord';
export type TodayInvite = 'none' | 'one';

export const TODAY_ORGS: readonly { key: TodayOrg; label: string }[] = [
  { key: 'qa', label: 'QA Organisation' },
  { key: 'lumen', label: 'Lumen Studio' },
  { key: 'ire', label: 'Ìrè Events' },
  { key: 'several', label: 'Atelier Céleste Réceptions et Mariages' },
  { key: 'oneWord', label: ONE_WORD },
];

export const TODAY_INVITES: readonly { key: TodayInvite; label: string }[] = [
  { key: 'none', label: 'None waiting' },
  { key: 'one', label: 'One waiting' },
];

export function orgName(org: TodayOrg): string {
  return TODAY_ORGS.find((one) => one.key === org)?.label ?? 'QA Organisation';
}

/** Main's pill on the phone's cover: the name at 15, the invitation line at 12.5, the tile 28, the caret 14. */
export const PILL_NAME = 15;
export const PILL_WAITING = 12.5;
const PILL_TILE = 28;
const PILL_CARET = 14;
const PILL_RING = 11;
// Search and the bell, 40 each with 8 between, and the row's gap either side of its spacer.
const PILL_ENDS = 40 + tokens.spaceSm + 40 + 2 * tokens.spaceSm;
const PILL_INSIDE =
  tokens.spaceSm + PILL_TILE + tokens.spaceSm + tokens.spaceSm + PILL_CARET + tokens.spacePillEnd;

/** The name's line in the pill, from the cover row's width between its sides: 186 on an iPhone 17 Pro (370). */
export function pillNameRoom(row: number): number {
  return Math.max(row - PILL_ENDS - PILL_INSIDE, 0);
}

/** The invitation line's room: the name's, less its ring and the gap after it. */
export function pillWaitingRoom(row: number): number {
  return Math.max(pillNameRoom(row) - PILL_RING - tokens.spaceXs, 0);
}

/** From AX1 the pill is its tile alone only where its widest word, at the name's default size, is wider than its line (sc-38149's tile). */
export function pillTileAlone(
  scale: number,
  widestAtDefault: number | null,
  room: number,
): boolean {
  return (
    atAccessibilitySizes(scale) && widestAtDefault != null && room > 0 && widestAtDefault > room
  );
}

/** Search and the bell at the upright iPad's right, 40 each with 8 between (`SearchAndBell`). */
export const UPRIGHT_END = 40 + tokens.spaceSm + 40;

export interface UprightTop {
  /** The one size the tabs' labels draw at. */
  labelSize: number;
  capsule: number;
  /** The widest the pill may be, 12 short of the centred capsule (sc-30410, sc-92188). */
  pill: number;
  /** The tabs are under their own size, so the pill gives way to its tile (sc-40401). */
  givesWay: boolean;
  nameRoom: number;
  waitingRoom: number;
}

/** The upright iPad's top row at a stand-in scale, as main fits it: the tabs take their room first, from their labels `labels` wide at their own size in a row `row` wide inside its side margins. */
export function uprightTop(scale: number, labels: readonly number[], row: number): UprightTop {
  const total = labels.reduce((sum, width) => sum + width, 0);
  const labelSize = capsuleLabelSize(scale, labels.length, total, capsuleRoom(row, UPRIGHT_END));
  const capsule = capsuleWidth(scale, labels, labelSize);
  const pill = pillBesideTabs(row, capsule)?.maxWidth ?? 0;
  const nameRoom = Math.max(pill - PILL_CHROME, 0);

  return {
    labelSize,
    capsule,
    pill,
    givesWay: pillGivesWay(scale, labelSize),
    nameRoom,
    waitingRoom: Math.max(nameRoom - WAITING_RING, 0),
  };
}

/** Before the name's own words are weighed, the upright pill is its tile where the tabs left their own size, or left it under 120 (sc-30410); below AX1 also where its first word and "…" or its invitation line would not fit one line, as on main (sc-38149). */
export function uprightTile(
  scale: number,
  top: UprightTop,
  widths: { nameStart: number; waitingLine: number | null },
): boolean {
  if (top.givesWay || top.pill < PILL_BESIDE_TABS.fewest) return true;

  return !atAccessibilitySizes(scale) && !pillShowsWords(top.pill, widths, false);
}
