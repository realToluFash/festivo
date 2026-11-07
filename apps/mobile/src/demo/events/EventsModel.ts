import {
  type EventPhase,
  type EventType,
  type Milestone,
  calledOff,
  endLabel,
  eventAllows,
  eventDays,
  eventPhase,
  eventsHome,
  formatEventDate,
  formatEventMoment,
  formatEventRange,
  formatEventShortDay,
  formatEventWeekday,
  formatWallDay,
  hostsLine,
  milestoneDistance,
  nextStep,
  wallDay,
} from '@soirely/domain';

import type { RowTag } from '../settings/SummaryRows.tsx';
import { CLOCKS, READER_ZONE, type SampleEvent, TYPE_WORDS } from './EventsSample.ts';
import { meshFor, type MeshKey } from '../../kit/today.ts';
import { W, say } from './EventsWords.ts';

export type ListTab = 'upcoming' | 'drafts' | 'past';

export interface Shown extends SampleEvent {
  phase: EventPhase;
  calledOff: boolean;
  mesh: MeshKey;
}

export function shownEvent(event: SampleEvent, now: Date): Shown {
  return {
    ...event,
    phase: eventPhase(event, now),
    calledOff: calledOff(event),
    mesh: meshFor(event.id),
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
  const days = eventDays(event);

  if (days.kind === 'calledOffOn') {
    if (list) return say.calledOffOn(formatEventShortDay(days.concludedAt, event.timeZone, locale));

    return say.days(
      formatEventWeekday(event.startsAt, event.timeZone, locale),
      formatEventWeekday(event.endsAt, event.timeZone, locale),
    );
  }

  const first = formatEventWeekday(days.startsAt, event.timeZone, locale);

  return days.kind === 'oneDay'
    ? first
    : say.days(first, formatEventWeekday(days.endsAt, event.timeZone, locale));
}

export function placeWords(event: SampleEvent): string {
  return event.venue?.place ?? W.venueToBeConfirmed;
}

export function rowLine(event: SampleEvent, locale: string, list = true): string {
  return `${daysWords(event, locale, list)} · ${placeWords(event)}`;
}

export function rowTag(event: Shown, everyPhase: boolean): RowTag | null {
  if (event.phase === 'happening_now') return { kind: 'now', word: W.happeningNow };
  if (event.phase === 'paused') return { kind: 'paused', word: W.paused };
  if (event.calledOff) return { kind: 'ended', word: W.calledOff };
  if (!everyPhase) return null;
  if (event.phase === 'draft') return { kind: 'notyet', word: W.draft };
  if (event.phase === 'live') return { kind: 'yes', word: W.live };

  return { kind: 'ended', word: W.finished };
}

function distanceWords(at: string, timeZone: string, now: Date): string {
  const distance = milestoneDistance(at, timeZone, now);

  switch (distance.kind) {
    case 'inDays':
      return say.inDays(distance.count);
    case 'daysAgo':
      return say.daysAgo(distance.count);
    case 'today':
      return 'today';
    case 'now':
      return 'now';
  }
}

export function howSoon(event: Shown, now: Date): string | null {
  if (event.phase === 'finished' || event.phase === 'happening_now') return null;
  if (Date.parse(event.startsAt) <= now.getTime()) return null;

  return distanceWords(event.startsAt, event.timeZone, now);
}

const DAY = 86_400_000;

function dayNumber(moment: string | Date, timeZone: string): number {
  return Date.parse(`${wallDay(moment, timeZone)}T00:00:00Z`) / DAY;
}

export function dayCount(event: SampleEvent): number {
  return dayNumber(event.endsAt, event.timeZone) - dayNumber(event.startsAt, event.timeZone) + 1;
}

export interface DayTile {
  weekday: string;
  day: string;
  today: boolean;
}

export function dayTiles(event: Shown, now: Date, locale: string): DayTile[] | null {
  const count = dayCount(event);

  if (count < 2 || event.phase === 'finished') return null;

  const first = dayNumber(event.startsAt, event.timeZone);
  const today = dayNumber(now, event.timeZone);
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
  const number = new Intl.DateTimeFormat(locale, { day: 'numeric', timeZone: 'UTC' });

  return Array.from({ length: count }, (_, index) => {
    const day = new Date((first + index) * DAY);

    return {
      weekday: weekday.format(day),
      day: number.format(day),
      today: first + index === today,
    };
  });
}

export type PhaseMark = 'draft' | 'live' | 'now' | 'paused' | 'finished' | 'calledOff';

export interface CardTag {
  word: string;
  mark?: PhaseMark;
}

export function cardTags(event: Shown, now: Date): CardTag[] {
  const soon = howSoon(event, now);
  const soonTag = soon == null ? [] : [{ word: soon }];

  switch (event.phase) {
    case 'draft':
      return [{ word: W.draft, mark: 'draft' }, ...soonTag];
    case 'live':
      return [{ word: W.live, mark: 'live' }, ...soonTag];
    case 'paused':
      return [{ word: W.paused, mark: 'paused' }, ...soonTag];
    case 'happening_now': {
      const day = dayNumber(now, event.timeZone) - dayNumber(event.startsAt, event.timeZone) + 1;
      const count = dayCount(event);

      return count > 1
        ? [{ word: W.happeningNow, mark: 'now' }, { word: say.dayOf(day, count) }]
        : [{ word: W.happeningNow, mark: 'now' }];
    }
    case 'finished':
      return event.calledOff
        ? [{ word: W.calledOff, mark: 'calledOff' }]
        : [{ word: W.finished, mark: 'finished' }];
  }
}

export function milestonesOf(event: SampleEvent): Milestone[] {
  const own = { note: null, owner: 'event', area: 'events', action: null } as const;

  return [
    { ...own, at: event.startsAt, title: say.starts(event.name) },
    { ...own, at: event.endsAt, title: say.ends(event.name) },
  ];
}

export type StepAction = 'makeLive' | 'changeDates' | 'resume' | 'duplicate';

export type CardStep =
  | { kind: 'button'; line: string; label: string; action: StepAction }
  | { kind: 'next'; title: string; when: string };

/** The card's one step, by main's nextStep: what the phase asks for, else the next thing that happens; Duplicate once it is over. */
export function cardStep(event: Shown, now: Date, locale: string): CardStep {
  const step = nextStep({ ...event, milestones: milestonesOf(event) }, event.phase, now);

  switch (step?.kind) {
    case 'makeLive':
      return { kind: 'button', line: W.guestsBlocked, label: W.makeLive, action: 'makeLive' };
    case 'changeDates':
      return { kind: 'button', line: W.endPassed, label: W.changeDates, action: 'changeDates' };
    case 'resume':
      return { kind: 'button', line: W.pausedNotice, label: W.resume, action: 'resume' };
    case 'nextUp':
      return {
        kind: 'next',
        title: say.nextUp(step.milestone.title),
        when: `${formatEventMoment(step.milestone.at, event.timeZone, locale)} · ${distanceWords(
          step.milestone.at,
          event.timeZone,
          now,
        )}`,
      };
    case undefined: {
      const line =
        event.calledOff && event.concludedAt != null
          ? say.calledOffNotice(formatEventDate(event.concludedAt, event.timeZone, locale))
          : W.timelineFinished;

      return { kind: 'button', line, label: W.duplicate, action: 'duplicate' };
    }
  }
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

export function hostsRow(event: SampleEvent, locale: string): { title: string; line: string } {
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

export const TAB_WORDS: Record<ListTab, string> = {
  upcoming: W.upcoming,
  drafts: W.drafts,
  past: W.past,
};

export const LIST_STATES = [
  'first',
  'drafts',
  'past',
  'pastMore',
  'offline',
  'search',
  'filtered',
  'filterOpen',
  'noMatch',
] as const;
export type ListState = (typeof LIST_STATES)[number];

export function listStateOf(value: string | undefined): ListState | null {
  return LIST_STATES.find((state) => state === value) ?? null;
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
      return { ...start, tab: 'drafts' };
    case 'past':
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
  'discard',
  'changedElsewhere',
  'showLatest',
  'saved',
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

export type EditPart = 'dates' | 'venue' | 'hosts' | 'type' | 'currency' | 'name' | 'cover';

export function editOf(state: EventDemoState | null): EditPart | null {
  switch (state) {
    case 'dates':
    case 'datesChanged':
    case 'datesError':
    case 'discard':
    case 'changedElsewhere':
    case 'showLatest':
      return 'dates';
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

type Rgb = readonly [number, number, number];

function rgbOf(hex: string): Rgb {
  const value = Number.parseInt(hex.replace('#', '').slice(0, 6), 16);

  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function hexOf([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;
}

function mixed(under: Rgb, over: Rgb, alpha: number): Rgb {
  return [0, 1, 2].map(
    (i) => (under[i] ?? 0) * (1 - alpha) + (over[i] ?? 0) * alpha,
  ) as unknown as Rgb;
}

function luminance(rgb: Rgb): number {
  const [r = 0, g = 0, b = 0] = rgb.map((channel) => {
    const c = channel / 255;

    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string | Rgb, b: string | Rgb): number {
  const [la, lb] = [a, b].map((one) => luminance(typeof one === 'string' ? rgbOf(one) : one));
  const light = Math.max(la ?? 0, lb ?? 0);
  const dark = Math.min(la ?? 0, lb ?? 0);

  return (light + 0.05) / (dark + 0.05);
}

const WHITE: Rgb = [255, 255, 255];
const WHITE_GLOW = 0.4;
const LEAST = 4.5;

export interface Scrim {
  ink: string;
  top: number;
  middle: number;
  foot: number;
}

/** A deeper shade of the colour, as little of it as keeps white at 4.5:1 over the cover's lightest point: its white glow, or any photo's white. */
export function scrimFor(base: string, photo: boolean, ink: string): Scrim {
  const colour = rgbOf(
    photo ? ink : hexOf(rgbOf(base).map((channel) => channel * 0.42) as unknown as Rgb),
  );
  const lightest = photo ? WHITE : mixed(rgbOf(base), WHITE, WHITE_GLOW);
  let middle = 0.2;

  while (middle < 0.95 && contrast(WHITE, mixed(lightest, colour, middle)) < LEAST) middle += 0.02;

  return {
    ink: hexOf(colour),
    top: Math.min(0.95, middle + 0.06),
    middle,
    foot: Math.min(0.95, middle + 0.16),
  };
}

export function scrimContrast(base: string, photo: boolean, ink: string): number {
  const scrim = scrimFor(base, photo, ink);
  const lightest = photo ? WHITE : mixed(rgbOf(base), WHITE, WHITE_GLOW);

  return contrast(WHITE, mixed(lightest, rgbOf(scrim.ink), scrim.middle));
}

/** Each tab's width as CSS shares a row: an equal share of the room, or the tab's own words where they need more. */
export function tabWidths(room: number, mins: readonly number[]): number[] {
  const fixed = mins.map(() => false);

  for (;;) {
    const free = fixed.filter((f) => !f).length;
    const left = room - mins.reduce((sum, min, i) => (fixed[i] ? sum + min : sum), 0);
    const share = free > 0 ? left / free : 0;
    const grown = mins.findIndex((min, i) => !fixed[i] && min > share);

    if (grown < 0) return mins.map((min, i) => (fixed[i] ? min : share));
    fixed[grown] = true;
  }
}
