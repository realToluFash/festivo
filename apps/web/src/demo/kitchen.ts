import {
  type Milestone,
  formatEventMoment,
  markedMilestones,
  milestoneDistance,
  nextUp,
} from '@soirely/domain';

import { milestonesOf } from './calendar.ts';
import { writtenTime } from './clock.ts';
import { demoWords } from './demoWords.ts';
import { CLOCKS, type SampleEvent, instantOf, localDay, shownOf } from './events.ts';
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
  at: string;
  by: string;
}

export type Dialog = 'rest' | 'making' | 'failed';

export interface Kitchen {
  due: string | null;
  copies: readonly Copy[];
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
}

const FIRST: Copy = { at: '2026-11-03T09:41:00Z', by: READER };
const COPIES: readonly Copy[] = [
  FIRST,
  { at: '2026-11-02T17:00:00Z', by: 'Ana Souza' },
  { at: '2026-10-30T12:15:00Z', by: READER },
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

/** The Overview's and All dates' own links: the milestone as due, overdue, or gone with a copy. */
const DATES_STATES = {
  finalNumbers: SET,
  finalNumbersOverdue: { due: '2026-11-02', copies: [] },
  finalNumbersGiven: { due: SET.due, copies: [FIRST] },
} satisfies Record<string, Kitchen>;

export type KitchenDatesState = keyof typeof DATES_STATES;

/** Any other state link draws its own board, so the kitchen starts empty; with no state the demo keeps what it holds. */
export function seedFromEvent(value: string | null): boolean {
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

export function fileName(event: SampleEvent, copy: Copy): string {
  return `${event.name} kitchen sheet ${localDay(copy.at, event.timeZone)}.pdf`;
}

export function newestFirst(copies: readonly Copy[]): Copy[] {
  return [...copies].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

/** The timeline's You milestone: a date set and no copy recorded, gone at the start and on an Ended event. */
export function kitchenMilestone(
  event: SampleEvent,
  kitchen: Kitchen,
  now: Date,
): Milestone | null {
  if (event.id !== KITCHEN_EVENT || kitchen.due == null || kitchen.copies.length > 0) return null;

  if (ended(event, now) || now.getTime() >= Date.parse(event.startsAt)) return null;

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

export function timelineOf(event: SampleEvent, now: Date): Milestone[] {
  const kitchen = kitchenMilestone(event, kept, now);

  return [...milestonesOf(event), ...(kitchen == null ? [] : [kitchen])];
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

export function momentOf(at: string, timeZone: string): string {
  return formatEventMoment(at, timeZone, LOCALE);
}

export interface CardMilestone {
  title: string;
  line: string;
  overdue: boolean;
  label: string;
  link: string;
}

/** The Overview card's Next up when it is a milestone with an action: the step it carries (Events A has no Coming up). */
export function cardMilestone(event: SampleEvent, now: Date): CardMilestone | null {
  const next = nextUp(timelineOf(event, now), now, ended(event, now));

  if (next?.action == null) return null;

  return {
    title: filled(KW.nextUp, { title: next.title }),
    line: `${momentOf(next.at, event.timeZone)} · ${distanceOf(next.at, event.timeZone, now)}`,
    overdue: next.owner === 'you' && Date.parse(next.at) < now.getTime(),
    label: next.action.label,
    link: next.action.link,
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

export function sheetLine(event: SampleEvent, now: Date): string {
  return filled(KW.sheetLine, {
    allergic: ALLERGIC.length,
    courses: COURSES.length,
    at: momentOf(now.toISOString(), event.timeZone),
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
