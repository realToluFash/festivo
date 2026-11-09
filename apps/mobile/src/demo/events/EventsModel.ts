import {
  type Milestone,
  type EventType,
  endLabel,
  eventAllows,
  eventPhase,
  eventsHome,
  formatEventRange,
  formatWallDay,
  hostsLine,
  wallDay,
} from '@soirely/domain';
import { t } from 'i18next';

import type { RowTag } from '../../components/SummaryRows.tsx';
import {
  type CardStep,
  type CardTag,
  type ListTab,
  type Shown as ListShown,
  TAB_WORD,
  cardStep as productCardStep,
  cardTags as productCardTags,
  dayCount,
  daysWords as productDaysWords,
  howSoon as productHowSoon,
  rowLine as productRowLine,
  rowTag as productRowTag,
  shownEvent as productShownEvent,
} from '../../kit/eventsList.ts';
import { CLOCKS, READER_ZONE, type SampleEvent, TYPE_WORDS } from './EventsSample.ts';
import { W, say } from './EventsWords.ts';
import { CHANGES_STATES, FINAL_NUMBERS_STATES, kitchenOwed, othersOwed } from './FinalNumbers.ts';

export type {
  CardStep,
  CardTag,
  DayTile,
  ListTab,
  PhaseMark,
  StepAction,
} from '../../kit/eventsList.ts';
export { dayCount, dayTiles, tabWidths } from '../../kit/eventsList.ts';

/** A sample event as the product's Events draws it, with its own fields for the rest of the demo. */
export interface Shown extends Omit<SampleEvent, 'photo'>, ListShown {}

export function shownEvent(event: SampleEvent, now: Date): Shown {
  return {
    ...event,
    ...productShownEvent(
      {
        ...event,
        place: event.venue?.place ?? null,
        photo: event.photo ? 'standIn' : null,
        milestones: datesOf(event, now),
      },
      eventPhase(event, now),
    ),
  };
}

export interface Home {
  upcoming: Shown[];
  drafts: Shown[];
  past: Shown[];
  happeningNow: number;
}

/** Main's eventsHome: Upcoming holds what is happening now first, then live and paused, soonest first; Past is latest first. */
export function homeOf(events: readonly SampleEvent[], now: Date, locale: string): Home {
  const shown = events.map((event) => shownEvent(event, now));
  const home = eventsHome(
    {
      unfinished: shown.filter((event) => event.phase !== 'finished'),
      past: shown.filter((event) => event.phase === 'finished'),
      pastTotal: shown.filter((event) => event.phase === 'finished').length,
      at: now,
    },
    now,
    locale,
  );

  return {
    upcoming: [...home.happeningNow, ...home.upcoming],
    drafts: home.drafts,
    past: home.past,
    happeningNow: home.happeningNow.length,
  };
}

export function summaryLine(home: Home): string | null {
  const live = home.upcoming.length - home.happeningNow;
  const parts = [
    home.happeningNow > 0 ? say.summaryHappening(home.happeningNow) : null,
    live > 0 ? say.summaryUpcoming(live) : null,
    home.drafts.length > 0 ? say.summaryDrafts(home.drafts.length) : null,
  ].filter((part): part is string => part != null);

  return parts.length === 0 ? null : parts.join(' · ');
}

export const PAST_PAGE = 10;

export function daysWords(event: SampleEvent, locale: string, list: boolean): string {
  return productDaysWords(event, locale, list, t);
}

export function placeWords(event: SampleEvent): string {
  return event.venue?.place ?? W.venueToBeConfirmed;
}

export function rowLine(event: Shown, locale: string, list = true): string {
  return productRowLine(event, locale, t, list);
}

export function rowTag(event: Shown, everyPhase: boolean): RowTag | null {
  return productRowTag(event, everyPhase, t);
}

export function howSoon(event: Shown, now: Date): string | null {
  return productHowSoon(event, now, t);
}

export function cardTags(event: Shown, now: Date): CardTag[] {
  return productCardTags(event, now, t);
}

export function milestonesOf(event: Omit<SampleEvent, 'photo'>): Milestone[] {
  const own = { note: null, owner: 'event', area: 'events', action: null } as const;

  return [
    { ...own, at: event.startsAt, title: say.starts(event.name) },
    { ...own, at: event.endsAt, title: say.ends(event.name) },
  ];
}

/** The timeline's You milestone while a date is set and no copy recorded (sc-30812), gone at the start and once Ended. */
export function finalNumbersOf(event: Omit<SampleEvent, 'photo'>, now: Date): Milestone[] {
  const owed = kitchenOwed(event.id);

  if (owed == null || event.status === 'ended' || now.getTime() >= Date.parse(event.startsAt))
    return [];

  return [
    {
      at: owed.due == null ? event.startsAt : instantOf(owed.due, '23:59', event.timeZone),
      title: owed.title,
      note: null,
      owner: 'you',
      area: 'menu',
      action: null,
    },
  ];
}

/** The event's dates as the server returns them, which Next up, the card's step and the Overview's Needs you all read (sc-32801). */
export function datesOf(event: Omit<SampleEvent, 'photo'>, now: Date): Milestone[] {
  const before = event.status !== 'ended' && now.getTime() < Date.parse(event.startsAt);

  return [
    ...milestonesOf(event),
    ...finalNumbersOf(event, now),
    ...(before ? othersOwed(event.id) : []),
  ];
}

export function cardStep(event: Shown, now: Date, locale: string): CardStep {
  return productCardStep(event, now, locale, t);
}

export type ManageKey = 'duplicate' | 'pause' | 'callOff' | 'endNow' | 'delete';

/** Only what event-states.json allows the phase; Resume is the paused card's step, so it is not repeated here. */
export function manageOf(event: Shown, now: Date): ManageKey[] {
  const end = endLabel(event, event.phase, now);

  return [
    'duplicate',
    ...(eventAllows(event.phase, 'pause') ? (['pause'] as const) : []),
    ...(end == null ? [] : [end]),
    ...(eventAllows(event.phase, 'delete') ? (['delete'] as const) : []),
  ];
}

export function scheduleLocked(event: Shown): boolean {
  return !eventAllows(event.phase, 'edit_schedule');
}

export function datesRow(event: Shown, locale: string): { title: string; line: string } {
  const range = formatEventRange(event.startsAt, event.endsAt, event.timeZone, locale);

  if (scheduleLocked(event)) return { title: range, line: `${W.dates} · ${W.scheduleLocked}` };

  const count = dayCount(event);
  const parts = [W.dates, ...(count > 1 ? [say.dayCount(count)] : []), event.timeZone];

  return { title: range, line: parts.join(' · ') };
}

export function hostsRow(
  event: Omit<SampleEvent, 'photo'>,
  locale: string,
): { title: string; line: string } {
  return event.hosts.length === 0
    ? { title: W.noHosts, line: `${W.hostedBy} · ${W.noHostsLine}` }
    : { title: hostsLine(event.hosts, locale), line: W.hostedBy };
}

export function needsName(event: SampleEvent): boolean {
  return event.status !== 'draft';
}

export type When =
  | { kind: 'any' }
  | { kind: 'week' }
  | { kind: 'month' }
  | { kind: 'next3' }
  | { kind: 'between'; from: string; to: string };

export interface Filters {
  types: readonly EventType[];
  when: When;
  hosts: readonly string[];
}

export const NO_FILTERS: Filters = { types: [], when: { kind: 'any' }, hosts: [] };

export const SEARCH_LEAST = 2;

export function folded(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('en').replace(/[‘’]/g, "'");
}

/** Any part of a word in the event's or the venue's name, accents ignored; under 2 characters is no search. */
export function matchesSearch(event: SampleEvent, typed: string): boolean {
  const q = folded(typed.trim());

  if (q.length < SEARCH_LEAST) return true;

  return [event.name, event.venue?.name ?? ''].some((name) => folded(name).includes(q));
}

const DAY = 86_400_000;

function addMonths(day: string, months: number): string {
  const [year = 0, month = 1, date = 1] = day.split('-').map(Number);
  const moved = new Date(Date.UTC(year, month - 1 + months, date));

  return moved.toISOString().slice(0, 10);
}

function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}

export function whenSpan(when: When, now: Date): { from: string; to: string } | null {
  const today = wallDay(now, READER_ZONE);

  switch (when.kind) {
    case 'any':
      return null;
    case 'week': {
      const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
      const monday = addDays(today, -weekday);

      return { from: monday, to: addDays(monday, 6) };
    }
    case 'month':
      return {
        from: `${today.slice(0, 7)}-01`,
        to: addDays(addMonths(`${today.slice(0, 7)}-01`, 1), -1),
      };
    case 'next3':
      return { from: today, to: addMonths(today, 3) };
    case 'between':
      return { from: when.from, to: when.to };
  }
}

/** Choices within one filter widen the results; different filters narrow them. */
export function matchesFilters(event: SampleEvent, filters: Filters, now: Date): boolean {
  if (filters.types.length > 0 && !filters.types.includes(event.type)) return false;
  if (filters.hosts.length > 0 && !event.hosts.some((host) => filters.hosts.includes(host)))
    return false;

  const span = whenSpan(filters.when, now);

  if (span == null) return true;

  return (
    wallDay(event.startsAt, event.timeZone) <= span.to &&
    wallDay(event.endsAt, event.timeZone) >= span.from
  );
}

export function filtered(filters: Filters): boolean {
  return filters.types.length > 0 || filters.when.kind !== 'any' || filters.hosts.length > 0;
}

export function searching(typed: string): boolean {
  return folded(typed.trim()).length >= SEARCH_LEAST;
}

export function whenWords(when: When, locale: string): string {
  switch (when.kind) {
    case 'any':
      return W.anyTime;
    case 'week':
      return W.thisWeek;
    case 'month':
      return W.thisMonth;
    case 'next3':
      return W.next3Months;
    case 'between':
      return say.days(formatWallDay(when.from, locale), formatWallDay(when.to, locale));
  }
}

export function typesWords(types: readonly EventType[]): string {
  return types.length === 0 ? W.anyType : types.map((type) => TYPE_WORDS[type]).join(', ');
}

export function hostsWords(hosts: readonly string[]): string {
  return hosts.length === 0 ? W.anyone : hosts.join(', ');
}

export function filterWord(filters: Filters, locale: string): string {
  const parts = [
    ...filters.types.map((type) => TYPE_WORDS[type]),
    ...(filters.when.kind === 'any' ? [] : [whenWords(filters.when, locale)]),
    ...filters.hosts,
  ];

  return parts.length === 0 ? W.all : parts.join(', ');
}

export function noMatchLine(typed: string, filters: Filters, locale: string): string {
  const q = typed.trim();
  const what = filterWord(filters, locale);

  if (searching(q) && filtered(filters)) return say.searchedAndFiltered(q, what);
  if (searching(q)) return say.searched(q);

  return say.filtered(what);
}

export interface Results {
  count: number;
  groups: { tab: ListTab; events: Shown[] }[];
}

export function resultsOf(
  events: readonly SampleEvent[],
  typed: string,
  filters: Filters,
  now: Date,
  locale: string,
): Results {
  const home = homeOf(
    events.filter((event) => matchesSearch(event, typed) && matchesFilters(event, filters, now)),
    now,
    locale,
  );
  const groups = (['upcoming', 'drafts', 'past'] as const)
    .map((tab) => ({ tab, events: home[tab] }))
    .filter((group) => group.events.length > 0);

  return { count: groups.reduce((sum, group) => sum + group.events.length, 0), groups };
}

export function hostNames(events: readonly SampleEvent[], locale: string): string[] {
  const collator = new Intl.Collator(locale);

  return [...new Set(events.flatMap((event) => event.hosts))].sort(collator.compare);
}

export function wallOf(moment: string, timeZone: string): { date: string; time: string } {
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(moment));

  return { date: wallDay(moment, timeZone), time };
}

export function instantOf(date: string, time: string, timeZone: string): string {
  const guess = Date.parse(`${date}T${time}:00Z`);
  const seen = wallOf(new Date(guess).toISOString(), timeZone);
  const drift = Date.parse(`${seen.date}T${seen.time}:00Z`) - guess;

  return new Date(guess - drift).toISOString();
}

export function eventHref(id: string, query: Readonly<Record<string, string>> = {}): string {
  const search = Object.entries(query)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

  return `/demo/events/${id}${search === '' ? '' : `?${search}`}`;
}

export function tabWord(tab: ListTab): string {
  return t(TAB_WORD[tab]);
}

export const LIST_STATES = [
  'loading',
  'first',
  'firstAsk',
  'emptyUpcoming',
  'emptyDrafts',
  'emptyPast',
  'drafts',
  'past',
  'pastMore',
  'offline',
  'search',
  'filtered',
  'filterOpen',
  'noMatch',
  'noGuests',
  'events',
  'eventsFirst',
  'eventsZero',
  'eventsOffline',
] as const;
export type ListState = (typeof LIST_STATES)[number];

export function listStateOf(value: string | undefined): ListState | null {
  return LIST_STATES.find((state) => state === value) ?? null;
}

const EMPTY_TAB_OF: Partial<Record<ListState, ListTab>> = {
  emptyUpcoming: 'upcoming',
  emptyDrafts: 'drafts',
  emptyPast: 'past',
};

export function emptyTabOf(state: ListState | null): ListTab | null {
  return state == null ? null : (EMPTY_TAB_OF[state] ?? null);
}

/** The organisation's events with none on one tab, so the other tabs, the counts and the summary stay true. */
export function withoutTab(
  events: readonly SampleEvent[],
  tab: ListTab,
  now: Date,
  locale: string,
): SampleEvent[] {
  const gone = new Set(homeOf(events, now, locale)[tab].map((event) => event.id));

  return events.filter((event) => !gone.has(event.id));
}

export function listStart(state: ListState | null): {
  tab: ListTab;
  typed: string;
  filters: Filters;
  pastShown: number;
} {
  const start = {
    tab: 'upcoming' as ListTab,
    typed: '',
    filters: NO_FILTERS,
    pastShown: PAST_PAGE,
  };

  switch (state) {
    case 'drafts':
    case 'eventsZero':
    case 'emptyDrafts':
      return { ...start, tab: 'drafts' };
    case 'past':
    case 'emptyPast':
      return { ...start, tab: 'past' };
    case 'pastMore':
      return { ...start, tab: 'past', pastShown: PAST_PAGE * 2 };
    case 'search':
      return { ...start, typed: 'lucia' };
    case 'filtered':
      return { ...start, filters: { ...NO_FILTERS, types: ['wedding', 'birthday'] } };
    case 'noMatch':
      return { ...start, typed: 'garden party', filters: { ...NO_FILTERS, types: ['wedding'] } };
    default:
      return start;
  }
}

export const EVENT_STATES = [
  'draft',
  'draftPast',
  'live',
  'now',
  'paused',
  'finished',
  'calledOff',
  'photo',
  'dates',
  'datesChanged',
  'datesError',
  'datesReplyBy',
  'datesReplyByAsk',
  'datesReplyBySaved',
  'discard',
  'changedElsewhere',
  'showLatest',
  'saved',
  'replyBy',
  'replyByEmpty',
  'replyByError',
  'replyBySooner',
  'replyByNow',
  'replyBySaved',
  'replyByRemoved',
  'venue',
  'venueSuggestions',
  'venueZone',
  'venueDown',
  'hosts',
  'hostsDuplicate',
  'hostsSix',
  'lastHost',
  'type',
  'currency',
  'currencyRefused',
  'name',
  'nameBlank',
  'cover',
  'coverRefused',
  'coverPhoto',
  'pause',
  'callOff',
  'endNow',
  'deleteDraft',
  'delete',
  'deleteMismatch',
  'deleteTyped',
  'duplicate',
  'muted',
  'muteNotLoaded',
  'muteNotSaved',
  'more',
  'needsYou',
  'needsYouOne',
  'needsYouOverdue',
  'needsYouGiven',
  'needsYouReadOnly',
  'needsYouLoading',
  'needsYouFailed',
  ...FINAL_NUMBERS_STATES,
  ...CHANGES_STATES,
] as const;
export type EventDemoState = (typeof EVENT_STATES)[number];

export function eventStateOf(value: string | undefined): EventDemoState | null {
  return EVENT_STATES.find((state) => state === value) ?? null;
}

/** Happening now is the wedding's second day; Finished the week after it; every other state reads the reader's clock. */
export function clockOf(state: EventDemoState | null): Date {
  if (state === 'now' || state === 'endNow') return new Date(CLOCKS.happening);
  if (state === 'finished') return new Date(CLOCKS.finished);

  return new Date(CLOCKS.reader);
}

export type EditPart =
  'dates' | 'replyBy' | 'venue' | 'hosts' | 'type' | 'currency' | 'name' | 'cover';

export function editOf(state: EventDemoState | null): EditPart | null {
  switch (state) {
    case 'dates':
    case 'datesChanged':
    case 'datesError':
    case 'datesReplyBy':
    case 'datesReplyByAsk':
    case 'discard':
    case 'changedElsewhere':
    case 'showLatest':
      return 'dates';
    case 'replyBy':
    case 'replyByEmpty':
    case 'replyByError':
    case 'replyBySooner':
    case 'replyByNow':
      return 'replyBy';
    case 'venue':
    case 'venueSuggestions':
    case 'venueZone':
    case 'venueDown':
      return 'venue';
    case 'hosts':
    case 'hostsDuplicate':
    case 'hostsSix':
    case 'lastHost':
      return 'hosts';
    case 'type':
      return 'type';
    case 'currency':
    case 'currencyRefused':
      return 'currency';
    case 'name':
    case 'nameBlank':
      return 'name';
    case 'cover':
    case 'coverRefused':
    case 'coverPhoto':
      return 'cover';
    default:
      return null;
  }
}
