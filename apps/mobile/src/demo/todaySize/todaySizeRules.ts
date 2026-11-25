import type { LayoutKind } from '../../layout/classify.ts';
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

export type TodayWeek = 'quiet' | 'days';

export const TODAY_WEEKS: readonly { key: TodayWeek; label: string }[] = [
  { key: 'quiet', label: 'Nothing on' },
  { key: 'days', label: 'Days with events' },
];

export const DAY_NAME = 14;
export const DAY_DATE = 13.5;

export interface WeekDay {
  date: string;
  rows: readonly { time: string; title: string; key: SizeEvent['key']; note: string }[];
}

/** This week from Wednesday 25 November: today, tomorrow and the party's Sunday, each with an item on it as main's agenda draws one; the last has no note. */
export const WEEK_DAYS: readonly WeekDay[] = [
  {
    date: SIZE_TODAY,
    rows: [{ time: '19:00', title: 'Replies close', key: 'ireti', note: 'Automatic' }],
  },
  {
    date: '2026-11-26',
    rows: [{ time: '10:30', title: 'Meal choices close', key: 'wed', note: 'Automatic' }],
  },
  {
    date: '2026-11-29',
    rows: [{ time: '20:00', title: 'The party starts', key: 'party', note: '' }],
  },
];

/** A day's name and its dotted date share a line only when both fit it whole; otherwise the date takes the line under, without its dot (sc-92250). */
export function dayLineShares(
  name: number,
  dottedDate: number,
  gap: number,
  room: number,
): boolean {
  return name + gap + dottedDate <= room;
}
