import {
  type EventsFilters,
  type Milestone,
  NO_EVENTS_FILTERS,
  eventPhase,
  eventsHome,
  searching,
  wallDay,
  whenSpan,
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
  daysWords as productDaysWords,
  howSoon as productHowSoon,
  rowLine as productRowLine,
  rowTag as productRowTag,
  shownEvent as productShownEvent,
} from '../../kit/eventsList.ts';
import {
  type ManageKey,
  type RowWords,
  datesRow as productDatesRow,
  hostsRow as productHostsRow,
  manageOf as productManageOf,
  scheduleLocked as productScheduleLocked,
} from '../../kit/eventOverview.ts';
import { CLOCKS, READER_ZONE, type SampleEvent } from './EventsSample.ts';
import { W, say } from './EventsWords.ts';
import { CHANGES_STATES, FINAL_NUMBERS_STATES, kitchenOwed, othersOwed } from './FinalNumbers.ts';
import { WRITE_STATES } from './GuestsCanWrite.ts';

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

const DEMO_NOW = new Date(CLOCKS.reader);

export function daysWords(event: SampleEvent, locale: string, list: boolean): string {
  return productDaysWords(event, DEMO_NOW, locale, list, t);
}

export function placeWords(event: SampleEvent): string {
  return event.venue?.place ?? W.venueToBeConfirmed;
}

export function rowLine(event: Shown, locale: string, list = true): string {
  return productRowLine(event, DEMO_NOW, locale, t, list);
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

export function cardStep(event: Shown, now: Date, locale: string): CardStep | null {
  return productCardStep(event, now, locale, t);
}

export type { ManageKey };

export function manageOf(event: Shown, now: Date): ManageKey[] {
  return productManageOf(event, event.phase, now);
}

export function scheduleLocked(event: Shown): boolean {
  return productScheduleLocked(event.phase);
}

export function datesRow(event: Shown, locale: string): RowWords {
  return productDatesRow(event, event.phase, locale, t);
}

export function hostsRow(event: Omit<SampleEvent, 'photo'>, locale: string): RowWords {
  return productHostsRow(event.hosts, locale, t);
}

/** sc-1468: only a Draft with nobody on its list keeps the plain question; `people` is the Guests header's N, guests and companions together. */
export function needsName(event: SampleEvent, people: number): boolean {
  return event.status !== 'draft' || people > 0;
}

export type Filters = EventsFilters;

export const NO_FILTERS: Filters = NO_EVENTS_FILTERS;

/** The sample's weeks start on Monday, as the boards draw them. */
const SAMPLE_FIRST_DAY = 1;

export function folded(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('en').replace(/[‘’]/g, "'");
}

/** The sample's stand-in for the API's search: any part of the event's or the venue's name, accents ignored. */
export function matchesSearch(event: SampleEvent, typed: string): boolean {
  if (!searching(typed)) return true;

  const q = folded(typed.trim());

  return [event.name, event.venue?.name ?? ''].some((name) => folded(name).includes(q));
}

/** Choices within one filter widen the results; different filters narrow them; a day of it in the span. */
export function matchesFilters(event: SampleEvent, filters: Filters, now: Date): boolean {
  if (filters.types.length > 0 && !filters.types.includes(event.type)) return false;
  if (filters.hosts.length > 0 && !event.hosts.some((host) => filters.hosts.includes(host)))
    return false;

  const span = whenSpan(filters.when, wallDay(now, READER_ZONE), SAMPLE_FIRST_DAY);

  if (span == null) return true;

  return (
    (span.to === '' || wallDay(event.startsAt, event.timeZone) <= span.to) &&
    (span.from === '' || wallDay(event.endsAt, event.timeZone) >= span.from)
  );
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
  'pastFailed',
  'failed',
  'offline',
  'search',
  'filtered',
  'filterOpen',
  'manyFilters',
  'manyFiltersOpen',
  'longHost',
  'noMatch',
  'noGuests',
  'replyLands',
  'noGuestsRead',
  'tileInvited',
  'tileReplied',
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

/** More picks than a phone's Filter has room for, and more than the menu's Type and Hosted by rows have; the wedding this week still matches (sc-39348). */
export const MANY_FILTERS: Filters = {
  types: ['wedding', 'birthday', 'gala'],
  when: { kind: 'week' },
  hosts: ['Adaeze Obi', 'Tunde Bakare'],
};

export const LONG_HOST = 'Funmilayo Adéṣínà-Ọláolúwa';

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
    case 'pastFailed':
      return { ...start, tab: 'past' };
    case 'pastMore':
      return { ...start, tab: 'past', pastShown: PAST_PAGE * 2 };
    case 'search':
      return { ...start, typed: 'lucia' };
    case 'filtered':
      return { ...start, filters: { ...NO_FILTERS, types: ['wedding', 'birthday'] } };
    case 'manyFilters':
    case 'manyFiltersOpen':
      return { ...start, filters: MANY_FILTERS };
    case 'longHost':
      return { ...start, filters: { ...NO_FILTERS, hosts: [LONG_HOST] } };
    case 'noMatch':
      return { ...start, typed: 'garden party', filters: { ...NO_FILTERS, types: ['wedding'] } };
    default:
      return start;
  }
}

export const EVENT_STATES = [
  'loading',
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
  'venueNote',
  'venueNoteTooLong',
  'venueNoteRefused',
  'venueNoteForbidden',
  'noteNoVenue',
  'noteWide',
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
  'deleteDraftGuests',
  'delete',
  'deleteMismatch',
  'deleteTyped',
  'duplicate',
  'muted',
  'muteNotLoaded',
  'muteNotSaved',
  ...WRITE_STATES,
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
    case 'venueNote':
    case 'venueNoteTooLong':
    case 'venueNoteRefused':
    case 'venueNoteForbidden':
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
