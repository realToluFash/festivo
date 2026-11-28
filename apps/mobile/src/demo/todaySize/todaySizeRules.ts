import { PILL_BESIDE_TABS } from '../../kit/frameBand.ts';
import {
  capsuleLabelSize,
  capsuleRoom,
  capsuleWidth,
  openerRoom,
  pillGivesWay,
} from '../../layout/capsuleFit.ts';
import type { LayoutKind } from '../../layout/classify.ts';
import { PILL_CHROME, WAITING_RING, pillShowsWords } from '../../layout/pillFit.ts';
import {
  atAccessibilitySizes,
  fitWidest,
  labelStart,
  piecesIn,
  wholeLineHeight,
} from '../../layout/textSize.ts';
import { tokens } from '../../theme/tokens.ts';

export {
  FIGURE_LABEL,
  FIGURE_LABEL_LINE,
  FIGURE_NUMBERS,
  FIGURE_NUMBERS_LINE,
  FIGURE_RING,
  figureRing,
  figureRoom,
} from '../../layout/arrivedFigure.ts';

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

export type TodayWeek = 'quiet' | 'days' | 'starts';

export const TODAY_WEEKS: readonly { key: TodayWeek; label: string }[] = [
  { key: 'quiet', label: 'Nothing on' },
  { key: 'days', label: 'Days with events' },
  { key: 'starts', label: 'Two events starting' },
];

export const DAY_NAME = 14;
export const DAY_DATE = 13.5;

/** A row's event: one of the sample events, or the Garden party QA starts this week (sc-94683). */
export type WeekRowEvent = SizeEvent['key'] | 'garden';

export const GARDEN_PARTY = { name: 'Garden party', mesh: 'teal' } as const;

export interface WeekDay {
  date: string;
  /** A row with no title is its event's start, titled by the product's own `todayScreen.starts`. */
  rows: readonly { time: string; title?: string; key: WeekRowEvent; note: string }[];
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

/** This week with two events starting, the Garden party on Friday and the party on Sunday, each row titled Début : {name} in French as main titles a start (sc-94683). */
export const STARTS_DAYS: readonly WeekDay[] = [
  {
    date: SIZE_TODAY,
    rows: [{ time: '19:00', title: 'Replies close', key: 'ireti', note: 'Automatic' }],
  },
  { date: '2026-11-27', rows: [{ time: '12:00', key: 'garden', note: '' }] },
  { date: '2026-11-29', rows: [{ time: '20:00', key: 'party', note: '' }] },
];

export { titleOnOneLine } from '../../layout/textSize.ts';

/** Main's strip label, `TYPE.label` in semibold capitals, tracked by a fixed 6% of it at every size. */
export const STRIP_LABEL = 11;
export const STRIP_TRACKING = STRIP_LABEL * 0.06;

/** sc-94682: a strip label keeps this step's size while it fits its day's column; otherwise the largest whole size at which it fits, never under its default size, and below it as main draws it. */
export function stripLabelSize(
  start: number,
  width: number,
  letters: number,
  column: number,
): number {
  if (width <= column || start <= STRIP_LABEL) return start;
  const tracking = letters * STRIP_TRACKING;

  return Math.max(STRIP_LABEL, Math.floor((start * (column - tracking)) / (width - tracking)));
}

/** sc-94682: a day's label keeps the room of this step's line whatever size it is drawn at, so today's circle stays in line with the other six. */
export function stripLabelRoom(start: number): number {
  return wholeLineHeight(start, start);
}

/** The strip's seven days from today, a dot for each event with a row that day. */
export function stripDays(week: TodayWeek): { date: string; dots: WeekRowEvent[] }[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.parse(`${SIZE_TODAY}T00:00Z`) + index * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const days = week === 'starts' ? STARTS_DAYS : week === 'days' ? WEEK_DAYS : [];
    const rows = days.find((day) => day.date === date)?.rows ?? [];

    return { date, dots: [...new Set(rows.map((row) => row.key))] };
  });
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
export const PILL_WAITING_LINE = 1.3;

/** The invitation line's first line at `drawn`, the height the ring is centred on where the line wraps (sc-92912). */
export function waitingFirstLine(drawn: number): number {
  return Math.ceil(drawn * PILL_WAITING_LINE);
}
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

/** The name's line the app's tile rule (`useWholeTile`) is given: from AX1 the pill's `room`, below it none, where the pill keeps its tile by main's rules (sc-38149, sc-92314). */
export function tileRoom(scale: number, room: number): number | undefined {
  return atAccessibilitySizes(scale) ? room : undefined;
}

/** Search and the bell at the upright iPad's right, 40 each with 8 between (`SearchAndBell`). */
export const UPRIGHT_END = 40 + tokens.spaceSm + 40;

export interface UprightTop {
  /** The one size the tabs' labels draw at. */
  labelSize: number;
  capsule: number;
  /** The widest the pill may be, 8 short of the centred capsule, as the app's `openerRoom` leaves it (sc-30410, sc-92188). */
  pill: number;
  /** The tabs are under their own size, so the pill gives way to its tile (sc-40401). */
  givesWay: boolean;
  nameRoom: number;
  waitingRoom: number;
}

/** The upright iPad's top row at a stand-in scale, as main fits it: the tabs take their room first, from their labels `labels` wide at their own size in a row `row` wide inside its side margins, `end` wide at its right. */
export function uprightTop(
  scale: number,
  labels: readonly number[],
  row: number,
  end = UPRIGHT_END,
): UprightTop {
  const total = labels.reduce((sum, width) => sum + width, 0);
  const labelSize = capsuleLabelSize(scale, labels.length, total, capsuleRoom(row, end));
  const capsule = capsuleWidth(scale, labels, labelSize);
  const pill = openerRoom(row + 2 * tokens.space3xl, capsule) ?? 0;
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

export type TodayLive = 'none' | 'dinner' | 'several' | 'oneWord';

export const TODAY_LIVES: readonly { key: TodayLive; label: string }[] = [
  { key: 'none', label: 'Nothing live' },
  { key: 'dinner', label: 'Dîner en direct' },
  { key: 'several', label: 'Atelier Céleste Réceptions et Mariages' },
  { key: 'oneWord', label: 'One long word' },
];

export function liveName(live: TodayLive): string | null {
  if (live === 'none') return null;

  return live === 'oneWord'
    ? ONE_WORD
    : (TODAY_LIVES.find((one) => one.key === live)?.label ?? null);
}

/** Main's live cover on its side (NowBlock, wide): the name at 48, the end line and Open the event at 16, the chips at 13. */
export const LIVE_NAME = 48;
/** The name on the phone's cover, as main's narrow NowBlock draws it. */
export const LIVE_NAME_PHONE = 36;
export const LIVE_ENDS = 16;
export const LIVE_CHIP = 13;
export const LIVE_OPEN = 16;
/** The one-day event is live until 23:30 today, with no venue, so its chip reads Day 1 of 1 alone. */
export const LIVE_ENDS_AT = '23:30';

export type TodayVenue = 'none' | 'chantilly';

/** The live event's venue: none, so the day's chip reads Day 1 of 1 alone, or a long one that takes the chip several lines from AX1 (sc-93211). */
export const TODAY_VENUES: readonly { key: TodayVenue; label: string }[] = [
  { key: 'none', label: 'No venue' },
  { key: 'chantilly', label: 'Salle des fêtes du Château de Chantilly' },
];

export function venueName(venue: TodayVenue): string | null {
  return venue === 'none' ? null : (TODAY_VENUES.find((one) => one.key === venue)?.label ?? null);
}

/** sc-93211: upright from AX1 a chip's words draw at main's size at the stand-in size and never step down; the chip grows to hold them. */
export function uprightChipSize(scale: number): number {
  return LIVE_CHIP * scale;
}

/** From AX1 Open the event takes the line under the end line, so the name keeps the cover's width (sc-92312). */
export function openUnder(scale: number): boolean {
  return atAccessibilitySizes(scale);
}

/** Main's switcher rows from AX1 (`ROWS`): the question at 18, the name at 15, the role line and Current at 13, the tile 56. */
export const SWITCHER_ASKS = 18;
export const SWITCHER_NAME = 15;
export const SWITCHER_LINE = 13;
export const SWITCHER_TILE = 56;

/** The switcher's rows in the demo: the organisation you are in first, then every other the demo knows, so each stays reachable from any of them. */
export function switcherOrgs(current: TodayOrg): TodayOrg[] {
  return [current, ...TODAY_ORGS.map((one) => one.key).filter((key) => key !== current)];
}

const NO_BREAK = String.fromCharCode(0xa0);

/** The pieces a dot-kept line wraps between: a lone · stays on the word before it. */
export function piecesKeepingDot(line: string): string[] {
  const pieces: string[] = [];
  for (const word of line
    .split(' ')
    .flatMap((part) => part.split(NO_BREAK))
    .filter((one) => one !== '')) {
    const last = pieces.length - 1;
    if (word === '·' && last >= 0) pieces[last] = `${pieces[last]}${NO_BREAK}·`;
    else pieces.push(...piecesOfLine(word));
  }

  return [...new Set(pieces)];
}

export type TodayArrived = 'none' | 'one' | 'many' | 'live';

/** Guests arrived at the live event: nobody, 1 of 12, 141 of 152, or the first arriving and undone again while Today is open (sc-94022). */
export const TODAY_ARRIVEDS: readonly { key: TodayArrived; label: string }[] = [
  { key: 'none', label: 'Nobody arrived' },
  { key: 'one', label: '1 of 12' },
  { key: 'many', label: '141 of 152' },
  { key: 'live', label: 'The first arriving' },
];

export interface ArrivedCount {
  arrived: number;
  expected: number;
}

const ARRIVED_COUNTS: Record<Exclude<TodayArrived, 'live'>, ArrivedCount | null> = {
  none: null,
  one: { arrived: 1, expected: 12 },
  many: { arrived: 141, expected: 152 },
};

/** While arrivals come in, the first guest arrives and is undone again, each step this long apart: inside the 10 seconds the AC allows. */
export const ARRIVING_EVERY = 4000;

/** The count at `step` of the live state: nobody, then 1 of 12, then nobody again. */
export function arrivedCount(arrived: TodayArrived, step: number): ArrivedCount | null {
  if (arrived === 'live') return step % 2 === 0 ? null : ARRIVED_COUNTS.one;

  return ARRIVED_COUNTS[arrived];
}
