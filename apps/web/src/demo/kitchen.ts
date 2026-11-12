import {
  type Milestone,
  formatEventMoment,
  markedMilestones,
  milestoneDistance,
  nextUp,
  notThisYear,
} from '@soirely/domain';

import { milestonesOf } from './calendar.ts';
import { writtenTime } from './clock.ts';
import { demoWords } from './demoWords.ts';
import { CLOCKS, type SampleEvent, instantOf, localDay, shownOf } from './events.ts';
import { CW, type SampleName, cw, linesFor } from './kitchenChanges.ts';
import type { PartsSample } from './kitchenParts.ts';
import { heldNeeds, resetNeedsYou, seedNeedsYou } from './needsYou.ts';
import type { DemoLink } from './settings.ts';

/** Final numbers due and the kitchen's copies (sc-30812) in Guests A's language, on the wedding: board/guests-a-spec.md §21. */
export const KITCHEN_EVENT = 'evt-wed-4';
export const READER = 'Folake Adeyemi';
const LOCALE = 'en-US';
export const LAST_CLOSE = '2026-11-04';
const API_TODAY = '2026-11-04';

export const KW = {
  title: 'Kitchen sheet',
  menu: 'Menu',
  crumb: 'Breadcrumb',
  events: 'Events',
  download: 'Download PDF',
  print: 'Print',
  give: 'Give final numbers…',
  due: 'Final numbers due',
  optional: 'Optional',
  none: 'None',
  final: 'Final numbers',
  help: 'Any day before {{start}}. It ends at 23:59 that day, in {{zone}}.',
  clear: 'Clear the date',
  errorStart: 'The date cannot be on or after the day the event starts. Choose an earlier date.',
  errorPast: 'The date cannot be in the past. Choose today or a later date.',
  picks: 'Guests can still choose until {{date}}.',
  giveTitle: 'Give the kitchen final numbers',
  giveBody:
    'Download the kitchen sheet as a PDF and pass it on to the kitchen yourself. Soirely keeps this copy as the numbers you gave, and sends it to nobody.',
  cancel: 'Cancel',
  making: 'Making the PDF',
  failed: 'The PDF could not be made, so nothing has been recorded.',
  retry: 'Try again',
  given: 'Given to the kitchen. A copy is kept on this page.',
  copy: 'Given to the kitchen on {{date}} at {{time}} by {{name}}',
  copyDownload: 'Download this copy',
  milestone: 'Give final numbers to the kitchen',
  openSheet: 'Open the kitchen sheet',
  saved: 'Saved',
  coming: '{{count}} coming',
  sheetLine: '{{allergic}} people with allergies · {{courses}} courses · As of {{at}}',
  allergies: 'Allergies',
  diets: 'Diets',
  showAll: 'Show all {{count}} people with allergies',
  namesNeed: 'Names need Guests manage.',
  notChosen: 'Not chosen yet',
  noPdf: 'The demo makes no PDF. In the product this downloads “{{file}}”.',
  changesPage: 'It opens with its changes page, then the whole sheet.',
  printed: 'Print opens the browser’s print. It records nothing.',
  nextUp: 'Next up: {{title}}',
  you: 'You',
  event: 'Event',
  automatic: 'Automatic',
  overdue: 'Overdue',
  passed: 'Passed',
  nextUpTag: 'Next up',
  today: 'today',
  now: 'now',
  inDays_one: 'in {{count}} day',
  inDays_other: 'in {{count}} days',
  daysAgo_one: '{{count}} day ago',
  daysAgo_other: '{{count}} days ago',
  allDates: 'All dates',
  intro: 'Every date on this event, earliest first. Times are in {{zone}}, the event’s time zone.',
  keyEvent: 'The event itself',
  keyYou: 'Something you need to do',
  keyAutomatic: 'Soirely does it for you',
  marks: 'What the marks say',
} as const;

const { filled, many } = demoWords(KW);

export { filled as kw, many as kwMany };

export interface Copy {
  id: number;
  at: string;
  by: string;
  /** sc-30692: the copy's PDF opens with a page of the changes since the one before it. */
  changes?: boolean;
}

export type Dialog = 'rest' | 'making' | 'failed';

export interface Kitchen {
  due: string | null;
  copies: readonly Copy[];
  /** sc-30692: the sheet's sample against its latest copy, and the moment it first differed from it; none while the copy holds every change. */
  sample?: SampleName;
  changedAt?: string | null;
}

export interface KitchenStart {
  kitchen: Kitchen;
  manage: boolean;
  open: boolean;
  typed: string | null;
  tried: boolean;
  apiRefused: boolean;
  dialog: Dialog | null;
  given: boolean;
  told: string | null;
  /** guests.manage, apart from menu.manage on the changes states (sc-30692); sc-30812's states keep them together. */
  names?: boolean;
  clock?: Date;
  /** sc-34244: the Main served in parts or family style, from its own sample room. */
  parts?: PartsSample;
  /** The printout on A4 in place of the page. */
  paper?: boolean;
}

const FIRST: Copy = { id: 3, at: '2026-11-03T09:41:00Z', by: READER };
const COPIES: readonly Copy[] = [
  FIRST,
  { id: 2, at: '2026-11-02T17:00:00Z', by: 'Ana Souza' },
  { id: 1, at: '2026-10-30T12:15:00Z', by: READER },
];

const NOTHING: Kitchen = { due: null, copies: [] };

let kept: Kitchen = NOTHING;

/** What the demo's kitchen holds since it opened; a state link starts it as its board draws it. */
export function keptKitchen(): Kitchen {
  return kept;
}

export function keepKitchen(next: Kitchen): void {
  kept = next;
}

export function resetKitchen(): void {
  kept = NOTHING;
  resetNeedsYou();
}

const BASE: KitchenStart = {
  kitchen: NOTHING,
  manage: true,
  open: false,
  typed: null,
  tried: false,
  apiRefused: false,
  dialog: null,
  given: false,
  told: null,
};

const SET: Kitchen = { due: '2026-11-03', copies: [] };

/** The changes states read against Ana's copy of Mon, Nov 2 at 17:00; the first, of Oct 30, had no changes page. */
const SINCE: readonly Copy[] = [
  { id: 2, at: '2026-11-02T17:00:00Z', by: 'Ana Souza', changes: true },
  { id: 1, at: '2026-10-30T12:15:00Z', by: READER },
];
const CHANGED_AT = '2026-11-02T20:30:00Z';

function changed(sample: SampleName, due: string | null = SET.due): Kitchen {
  return { due, copies: SINCE, sample, changedAt: CHANGED_AT };
}

const STATES = {
  empty: { name: 'Final numbers due not set', starts: {} },
  set: { name: 'Set, before the last picks close', starts: { kitchen: SET } },
  edit: { name: 'The date open in place', starts: { kitchen: SET, open: true } },
  changed: {
    name: 'Changed to the day picks close',
    starts: { kitchen: { due: LAST_CLOSE, copies: [] }, told: KW.saved },
  },
  cleared: { name: 'Cleared', starts: { told: KW.saved } },
  passed: {
    name: 'A date that has passed, still editable',
    starts: { kitchen: { due: '2026-11-02', copies: [] } },
  },
  errorStart: {
    name: 'Refused before sending: on or after the start',
    starts: { kitchen: SET, open: true, typed: '2026-11-05', tried: true },
  },
  errorPast: {
    name: 'Refused before sending: a new date in the past',
    starts: { kitchen: SET, open: true, typed: '2026-11-02', tried: true },
  },
  refused: {
    name: 'Refused by the API (422)',
    starts: { open: true, typed: '2026-11-03', apiRefused: true },
  },
  viewer: {
    name: 'menu.read only',
    starts: { kitchen: { due: SET.due, copies: [FIRST] }, manage: false },
  },
  give: { name: 'Give final numbers…, with a date', starts: { kitchen: SET, dialog: 'rest' } },
  giveNoDate: { name: 'Give final numbers…, no date', starts: { dialog: 'rest' } },
  making: { name: 'Making the PDF', starts: { kitchen: SET, dialog: 'making' } },
  failed: { name: 'The PDF could not be made', starts: { kitchen: SET, dialog: 'failed' } },
  given: {
    name: 'Given to the kitchen',
    starts: { kitchen: { due: SET.due, copies: [FIRST] }, given: true },
  },
  copies: {
    name: 'Several copies, newest first',
    starts: { kitchen: { due: SET.due, copies: COPIES } },
  },
  changes_named: {
    name: 'Changes since, with guests.manage: names, in the sheet’s order',
    starts: { kitchen: changed('named') },
  },
  changes_counts: {
    name: 'Changes since, without guests.manage: a count per code',
    starts: { kitchen: changed('named'), names: false },
  },
  changes_menu: {
    name: 'A new, a removed and a renamed dish beside a count',
    starts: { kitchen: changed('menu') },
  },
  changes_variant_side: {
    name: 'A variant and a side, named after their dish',
    starts: { kitchen: changed('variantSide') },
  },
  changes_person: {
    name: 'One guest stops coming, one starts',
    starts: { kitchen: changed('person') },
  },
  changes_swap: {
    name: 'Without guests.manage: one guest’s Peanuts removed, another’s recorded, never netted',
    starts: { kitchen: changed('swap'), names: false },
  },
  changes_erased: {
    name: 'A guest erased since the copy: counts only',
    starts: { kitchen: changed('erased') },
  },
  changes_long: {
    name: 'A 120-character dish and a 60-character variant, renamed: whole, wrapping',
    starts: { kitchen: changed('long') },
  },
  no_changes: {
    name: 'No changes since the copy',
    starts: { kitchen: { ...changed('named'), changedAt: null } },
  },
  no_copy: { name: 'No copy recorded: no list', starts: { kitchen: SET } },
  view_only: {
    name: 'Without menu.manage: the list, and no Give the changes…',
    starts: { kitchen: changed('named'), manage: false, names: true },
  },
  started: {
    name: 'After the event’s start: the list, nothing asks',
    starts: { kitchen: changed('named'), clock: CLOCKS.now },
  },
  changes_give: {
    name: 'Give the changes…: sc-30812’s dialog',
    starts: { kitchen: changed('named'), dialog: 'rest' },
  },
  changes_making: {
    name: 'Making the PDF',
    starts: { kitchen: changed('named'), dialog: 'making' },
  },
  changes_failed: {
    name: 'The PDF could not be made: Try again',
    starts: { kitchen: changed('named'), dialog: 'failed' },
  },
  changes_given: {
    name: 'Given: the status, then no changes since the new copy',
    starts: {
      kitchen: {
        ...changed('named'),
        copies: [{ id: 3, at: CLOCKS.rest.toISOString(), by: READER, changes: true }, ...SINCE],
        changedAt: null,
      },
      given: true,
    },
  },
  changes_copies: {
    name: 'Download this copy: each as recorded, its changes page included',
    starts: { kitchen: changed('named') },
  },
  inParts: {
    name: 'In parts: each dish’s parts, Served with this course, Plated at the pass',
    starts: { parts: 'inParts' },
  },
  familyStyle: {
    name: 'Family style: By table, the Top table plated at, No table last',
    starts: { parts: 'familyStyle' },
  },
  allPlated: {
    name: 'Family style, every guest plated at the pass: no By table',
    starts: { parts: 'allPlated' },
  },
  skipped: {
    name: 'Two guests skipped the Main: counted nowhere, the numbers drop',
    starts: { parts: 'skipped' },
  },
  platedBuffet: {
    name: 'Every course Plated or Buffet: the sheet as sc-3911',
    starts: { parts: 'plated' },
  },
  countsOnly: {
    name: 'Without guests.manage: the parts lines identical',
    starts: { parts: 'familyStyle', names: false },
  },
  print: {
    name: 'The printout on A4, Family style',
    starts: { parts: 'familyStyle', paper: true },
  },
  printInParts: {
    name: 'The printout on A4, In parts',
    starts: { parts: 'inParts', paper: true },
  },
  partsMaking: {
    name: 'Making the PDF, with the parts',
    starts: { parts: 'familyStyle', kitchen: SET, dialog: 'making' },
  },
  partsFailed: {
    name: 'The PDF could not be made, with the parts',
    starts: { parts: 'familyStyle', kitchen: SET, dialog: 'failed' },
  },
} satisfies Record<string, { name: string; starts: Partial<KitchenStart> }>;

export type KitchenStateName = keyof typeof STATES;

export function isKitchenState(value: string | null): value is KitchenStateName {
  return value != null && Object.hasOwn(STATES, value);
}

export function startOf(value: string | null): KitchenStart {
  if (value == null) return { ...BASE, kitchen: kept };
  if (!isKitchenState(value)) {
    kept = NOTHING;

    return BASE;
  }

  const start = { ...BASE, ...(STATES[value].starts as Partial<KitchenStart>) };
  kept = start.kitchen;

  return start;
}

/** The Overview's and All dates' own links, and the Overview's Needs you (sc-32801): the milestone as due, overdue, or gone with a copy. */
const DATES_STATES = {
  finalNumbers: SET,
  finalNumbersOverdue: { due: '2026-11-02', copies: [] },
  finalNumbersGiven: { due: SET.due, copies: [FIRST] },
  needsYou: { due: '2026-11-01', copies: [] },
  needsYouOne: { due: '2026-11-04', copies: [] },
  needsYouOverdue: { due: '2026-11-01', copies: [] },
  needsYouGiven: { due: SET.due, copies: [FIRST] },
  needsYouReadOnly: { due: '2026-11-04', copies: [] },
  changes_due: changed('named'),
  changes_overdue: { ...changed('named', '2026-11-02'), changedAt: '2026-11-02T18:30:00Z' },
  changes_late: { ...changed('named', '2026-11-02'), changedAt: '2026-11-03T08:00:00Z' },
  changes_no_date: changed('named', null),
  changes_in_copy: { ...changed('named'), changedAt: null },
} satisfies Record<string, Kitchen>;

export type KitchenDatesState = keyof typeof DATES_STATES;

/** Any other state link draws its own board, so the kitchen starts empty; with no state the demo keeps what it holds. */
export function seedFromEvent(value: string | null): boolean {
  seedNeedsYou(value);
  if (value == null) return false;
  if (!Object.hasOwn(DATES_STATES, value)) {
    kept = NOTHING;

    return false;
  }

  kept = DATES_STATES[value as KitchenDatesState];

  return true;
}

export function kitchenAt(eventId: string, state?: KitchenStateName): string {
  return `/demo/events/${eventId}/kitchen${state == null ? '' : `?state=${state}`}`;
}

export type DueError = 'start' | 'past';

/** Before submit: on or after the start's day, or a newly entered day before today, both in the event's zone; today is allowed, an unchanged passed date too. */
export function dueError(
  typed: string,
  was: string | null,
  event: SampleEvent,
  now: Date,
): DueError | null {
  if (typed === '') return null;
  if (typed >= localDay(event.startsAt, event.timeZone)) return 'start';
  if (typed < localDay(now, event.timeZone) && typed !== was) return 'past';

  return null;
}

/** The 422's state: the API's day has already turned to the 4th (a host's clock can be wrong), so it refuses the 3rd the client let through. */
export function apiRefuses(typed: string): boolean {
  return typed !== '' && typed < API_TODAY;
}

export function errorWords(error: DueError): string {
  return error === 'start' ? KW.errorStart : KW.errorPast;
}

export function picksLine(due: string | null): string | null {
  return due != null && due < LAST_CLOSE ? filled(KW.picks, { date: shortDay(LAST_CLOSE) }) : null;
}

function noonOf(day: string): Date {
  return new Date(`${day}T12:00:00Z`);
}

export function shortDay(day: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(noonOf(day));
}

export function copyLine(copy: Copy, timeZone: string): string {
  const date = new Intl.DateTimeFormat(LOCALE, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone,
  }).format(new Date(copy.at));

  return filled(KW.copy, { date, time: writtenTime(copy.at, LOCALE, timeZone), name: copy.by });
}

export function fileName(event: SampleEvent, copy: Pick<Copy, 'at'>): string {
  return `${event.name} kitchen sheet ${localDay(copy.at, event.timeZone)}.pdf`;
}

export function newestFirst(copies: readonly Copy[]): Copy[] {
  return [...copies].sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || b.id - a.id);
}

export function madeCopy(copies: readonly Copy[], at: string, by: string, changes = false): Copy {
  return {
    id: Math.max(0, ...copies.map((copy) => copy.id)) + 1,
    at,
    by,
    ...(changes ? { changes } : {}),
  };
}

/** The latest copy's moment, as the copies list writes it: the reader's locale, the event's zone, 24-hour. */
export function sinceSlots(
  copy: Pick<Copy, 'at'>,
  timeZone: string,
): { date: string; time: string } {
  return {
    date: new Intl.DateTimeFormat(LOCALE, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      timeZone,
    }).format(new Date(copy.at)),
    time: writtenTime(copy.at, LOCALE, timeZone),
  };
}

export function latestCopy(kitchen: Kitchen): Copy | null {
  return newestFirst(kitchen.copies)[0] ?? null;
}

/** The sheet against the latest copy: the sample's lines while the copy does not hold them. */
export function changeLines(kitchen: Kitchen, names: boolean) {
  if (kitchen.copies.length === 0 || kitchen.sample == null) return [];

  return linesFor(kitchen.sample, kitchen.changedAt == null, names);
}

/** The timeline's You milestone: a date set and no copy recorded, gone at the start and on an Ended event. */
export function kitchenMilestone(
  event: SampleEvent,
  kitchen: Kitchen,
  now: Date,
): Milestone | null {
  if (event.id !== KITCHEN_EVENT) return null;
  if (ended(event, now) || now.getTime() >= Date.parse(event.startsAt)) return null;
  if (kitchen.copies.length > 0) return changesMilestone(event, kitchen);
  if (kitchen.due == null) return null;

  const at = instantOf(kitchen.due, '23:59', event.timeZone);

  return at == null
    ? null
    : {
        at,
        title: KW.milestone,
        note: null,
        owner: 'you',
        area: 'menu',
        action: { label: KW.openSheet, link: kitchenAt(event.id) },
      };
}

/** sc-30692: due at 23:59 on the date if the change came back by then, else at the start, which is never Overdue. */
export function changesDueAt(event: SampleEvent, due: string | null, changedAt: string): string {
  const deadline = due == null ? null : instantOf(due, '23:59', event.timeZone);

  return deadline != null && Date.parse(changedAt) <= Date.parse(deadline)
    ? deadline
    : event.startsAt;
}

function changesMilestone(event: SampleEvent, kitchen: Kitchen): Milestone | null {
  if (kitchen.changedAt == null || changeLines(kitchen, true).length === 0) return null;

  return {
    at: changesDueAt(event, kitchen.due, kitchen.changedAt),
    title: CW.milestone,
    note: null,
    owner: 'you',
    area: 'menu',
    action: { label: KW.openSheet, link: kitchenAt(event.id) },
  };
}

export function timelineOf(event: SampleEvent, now: Date): Milestone[] {
  const kitchen = kitchenMilestone(event, kept, now);
  const before = !ended(event, now) && now.getTime() < Date.parse(event.startsAt);
  const owed = event.id === KITCHEN_EVENT && before ? heldNeeds() : [];

  return [...milestonesOf(event), ...(kitchen == null ? [] : [kitchen]), ...owed];
}

export function ended(event: SampleEvent, now: Date): boolean {
  const shown = shownOf(event, now);

  return shown === 'calledOff' || shown === 'finished';
}

export function datesOf(event: SampleEvent, now: Date) {
  return markedMilestones(timelineOf(event, now), now, ended(event, now));
}

export function distanceOf(at: string, timeZone: string, now: Date): string {
  const distance = milestoneDistance(at, timeZone, now);

  switch (distance.kind) {
    case 'now':
      return KW.now;
    case 'today':
      return KW.today;
    case 'inDays':
      return many('inDays', distance.count);
    default:
      return many('daysAgo', distance.count);
  }
}

export function momentOf(at: string, timeZone: string, now: Date): string {
  return formatEventMoment(at, timeZone, LOCALE, notThisYear(timeZone, now, at));
}

export interface CardMilestone {
  title: string;
  line: string;
  overdue: boolean;
  label: string | null;
  link: string | null;
}

/** The Overview card's Next up when it is the reader's own milestone, with its action as the step (Events A has no Coming up). */
export function cardMilestone(event: SampleEvent, now: Date): CardMilestone | null {
  const next = nextUp(timelineOf(event, now), now, ended(event, now));

  if (next?.owner !== 'you') return null;

  return {
    title: filled(KW.nextUp, { title: next.title }),
    line: `${momentOf(next.at, event.timeZone, now)} · ${distanceOf(next.at, event.timeZone, now)}`,
    overdue: Date.parse(next.at) < now.getTime(),
    label: next.action?.label ?? null,
    link: next.action?.link ?? null,
  };
}

export function clockOfKitchen(): Date {
  return CLOCKS.rest;
}

export interface Allergic {
  name: string;
  allergen: string;
  dishes: string;
}

export const ALLERGIC: readonly Allergic[] = [
  {
    name: 'Amaka Eze',
    allergen: 'Peanuts',
    dishes: 'Pepper soup · Jollof rice with chicken · Fruit plate',
  },
  {
    name: 'Kwame Mensah',
    allergen: 'Shellfish',
    dishes: 'Burrata with peaches · Mushroom risotto · Chocolate tart',
  },
  {
    name: 'Sophie Laurent',
    allergen: 'Gluten',
    dishes: 'Pepper soup · Grilled sea bass · Fruit plate',
  },
  {
    name: 'Yusuf Ibrahim',
    allergen: 'Sesame',
    dishes: 'Burrata with peaches · Jollof rice with chicken · Fruit plate',
  },
  {
    name: 'Inês Duarte',
    allergen: 'Peanuts',
    dishes: 'Pepper soup · Grilled sea bass · Chocolate tart',
  },
  {
    name: 'Nadia Haddad',
    allergen: 'Peanuts',
    dishes: 'Burrata with peaches · Mushroom risotto · Fruit plate',
  },
  {
    name: 'Tomás Ferreira',
    allergen: 'Shellfish',
    dishes: 'Pepper soup · Jollof rice with chicken · Chocolate tart',
  },
];

export const SHOWN_FIRST = 4;
export const COMING = 96;

export const DIETS: readonly [string, number][] = [
  ['Halal', 18],
  ['Vegetarian', 12],
  ['Vegan', 4],
];

export const COURSES: readonly { name: string; dishes: readonly [string, number][] }[] = [
  {
    name: 'Starter',
    dishes: [
      ['Pepper soup', 52],
      ['Burrata with peaches', 41],
      [KW.notChosen, 3],
    ],
  },
  {
    name: 'Main',
    dishes: [
      ['Jollof rice with chicken', 48],
      ['Grilled sea bass', 30],
      ['Mushroom risotto', 15],
      [KW.notChosen, 3],
    ],
  },
  {
    name: 'Dessert',
    dishes: [
      ['Chocolate tart', 53],
      ['Fruit plate', 40],
      [KW.notChosen, 3],
    ],
  },
];

export function allergenCounts(): [string, number][] {
  const counts = new Map<string, number>();

  for (const one of ALLERGIC) counts.set(one.allergen, (counts.get(one.allergen) ?? 0) + 1);

  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export function sheetLine(event: SampleEvent, now: Date, allergic = ALLERGIC.length): string {
  return filled(KW.sheetLine, {
    allergic,
    courses: COURSES.length,
    at: momentOf(now.toISOString(), event.timeZone, now),
  });
}

function link(state: KitchenStateName): DemoLink {
  return { to: kitchenAt(KITCHEN_EVENT, state), name: STATES[state].name };
}

const DATE_LINKS: readonly DemoLink[] = [
  {
    to: `/demo/events/${KITCHEN_EVENT}?state=finalNumbers`,
    name: 'Overview: the milestone as Next up',
  },
  {
    to: `/demo/events/${KITCHEN_EVENT}?state=finalNumbersOverdue`,
    name: 'Overview: the milestone overdue',
  },
  {
    to: `/demo/events/${KITCHEN_EVENT}?state=finalNumbersGiven`,
    name: 'Overview: given, the milestone gone',
  },
  {
    to: `/demo/events/${KITCHEN_EVENT}/dates?state=finalNumbers`,
    name: 'All dates with the milestone',
  },
  {
    to: `/demo/events/${KITCHEN_EVENT}/dates?state=finalNumbersOverdue`,
    name: 'All dates: overdue',
  },
  {
    to: `/demo/events/${KITCHEN_EVENT}/dates?state=finalNumbersGiven`,
    name: 'All dates: no milestone',
  },
];

export const KITCHEN_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'Final numbers due',
    states: (['empty', 'set', 'edit', 'changed', 'cleared'] as const).map(link),
  },
  {
    name: 'A passed date, the refusals and view only',
    states: (['passed', 'errorStart', 'errorPast', 'refused', 'viewer'] as const).map(link),
  },
  {
    name: 'Give final numbers…, and the copies',
    states: (['give', 'giveNoDate', 'making', 'failed', 'given', 'copies'] as const).map(link),
  },
  { name: 'The milestone on the Overview and All dates', states: DATE_LINKS },
];

function dateLink(state: KitchenDatesState, name: string, dates = false): DemoLink {
  return { to: `/demo/events/${KITCHEN_EVENT}${dates ? '/dates' : ''}?state=${state}`, name };
}

/** sc-34244's states: the parts on the Main, on the page and on A4. */
export const PARTS_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'The parts on a course, at a desk',
    states: (
      ['inParts', 'familyStyle', 'allPlated', 'skipped', 'platedBuffet', 'countsOnly'] as const
    ).map(link),
  },
  {
    name: 'The printout and the PDF',
    states: (['print', 'printInParts', 'partsMaking', 'partsFailed'] as const).map(link),
  },
];

/** sc-30692's states, beside sc-30812's on the demo's home. */
export const CHANGES_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'Changes since: the list and its readers',
    states: (
      [
        'changes_named',
        'changes_counts',
        'changes_menu',
        'changes_variant_side',
        'changes_person',
        'changes_swap',
        'changes_erased',
        'changes_long',
      ] as const
    ).map(link),
  },
  {
    name: 'No changes, no copy, view only and started',
    states: (['no_changes', 'no_copy', 'view_only', 'started'] as const).map(link),
  },
  {
    name: 'Give the changes…, and the copies',
    states: (
      [
        'changes_give',
        'changes_making',
        'changes_failed',
        'changes_given',
        'changes_copies',
      ] as const
    ).map(link),
  },
  {
    name: 'Give the changes to the kitchen, on the Overview and All dates',
    states: [
      dateLink('changes_due', 'Overview: due at the date'),
      dateLink('changes_overdue', 'Overview: overdue once the date passes'),
      dateLink('changes_late', 'Overview: came back after the date, due at the start'),
      dateLink('changes_in_copy', 'Overview: in a copy, the milestone gone'),
      dateLink('changes_due', 'All dates: due at the date', true),
      dateLink('changes_overdue', 'All dates: Overdue, with the word', true),
      dateLink('changes_late', 'All dates: came back after the date, due at the start', true),
      dateLink('changes_no_date', 'All dates: no date set, due at the start', true),
    ],
  },
];

export { CW, cw };
