import { addDays, dayDate } from './calendar.ts';
import { EVENT_TYPES, type EventType } from './events.ts';

/** A search shorter than this is no search, as the API ignores it (sc-30302). */
export const SEARCH_LEAST = 2;

export type EventsWhen =
  | { kind: 'any' }
  | { kind: 'week' }
  | { kind: 'month' }
  | { kind: 'next3' }
  | { kind: 'between'; from: string; to: string };

export interface EventsFilters {
  types: readonly EventType[];
  when: EventsWhen;
  hosts: readonly string[];
}

export const NO_EVENTS_FILTERS: EventsFilters = { types: [], when: { kind: 'any' }, hosts: [] };

export const EVENTS_PRESETS = ['week', 'month', 'next3'] as const;

export function searching(typed: string): boolean {
  return typed.trim().length >= SEARCH_LEAST;
}

export function filtered(filters: EventsFilters): boolean {
  return filters.types.length > 0 || filters.when.kind !== 'any' || filters.hosts.length > 0;
}

function addMonths(day: string, months: number): string {
  const date = dayDate(day);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  return new Date(Date.UTC(year, month, Math.min(date.getUTCDate(), last)))
    .toISOString()
    .slice(0, 10);
}

/** The days a When covers, `today` the reader's and the week starting on `firstDay` (0 Sunday to 6 Saturday); a From or To left empty is open. */
export function whenSpan(
  when: EventsWhen,
  today: string,
  firstDay: number,
): { from: string; to: string } | null {
  switch (when.kind) {
    case 'any':
      return null;
    case 'week': {
      const first = addDays(today, -((dayDate(today).getUTCDay() - firstDay + 7) % 7));

      return { from: first, to: addDays(first, 6) };
    }
    case 'month': {
      const first = `${today.slice(0, 7)}-01`;

      return { from: first, to: addDays(addMonths(first, 1), -1) };
    }
    case 'next3':
      return { from: today, to: addMonths(today, 3) };
    case 'between':
      return { from: when.from, to: when.to };
  }
}

const DAY_PATTERN = /^\d{4}-\d\d-\d\d$/;

function day(value: string | null): string {
  return value != null && DAY_PATTERN.test(value) && !Number.isNaN(Date.parse(value)) ? value : '';
}

/** A From and To read back as the preset they are today, else as Between dates. */
export function whenOfSpan(from: string, to: string, today: string, firstDay: number): EventsWhen {
  if (from === '' && to === '') return { kind: 'any' };

  for (const kind of EVENTS_PRESETS) {
    const span = whenSpan({ kind }, today, firstDay);

    if (span?.from === from && span.to === to) return { kind };
  }

  return { kind: 'between', from, to };
}

export interface EventsLook {
  q: string;
  filters: EventsFilters;
}

/** The search and filters an address carries: `q`, `type` as `wedding,birthday`, `from`, `to`, and each host its own `host`. */
export function eventsLookOf(params: URLSearchParams, today: string, firstDay: number): EventsLook {
  const types = params.getAll('type').flatMap((value) => value.split(','));

  return {
    q: params.get('q') ?? '',
    filters: {
      types: EVENT_TYPES.filter((type) => types.includes(type)),
      when: whenOfSpan(day(params.get('from')), day(params.get('to')), today, firstDay),
      hosts: [...new Set(params.getAll('host').filter((host) => host !== ''))],
    },
  };
}

/** `look` written into `keep`, whose other parameters stay as they are. */
export function eventsLookParams(
  look: EventsLook,
  keep: URLSearchParams,
  today: string,
  firstDay: number,
): URLSearchParams {
  const next = new URLSearchParams();
  const span = whenSpan(look.filters.when, today, firstDay);

  for (const [name, value] of keep)
    if (!['q', 'type', 'from', 'to', 'host'].includes(name)) next.append(name, value);
  if (look.q !== '') next.set('q', look.q);
  if (look.filters.types.length > 0) next.set('type', look.filters.types.join(','));
  if (span != null && span.from !== '') next.set('from', span.from);
  if (span != null && span.to !== '') next.set('to', span.to);
  for (const host of look.filters.hosts) next.append('host', host);

  return next;
}

export interface EventsSearch {
  q?: string;
  types?: readonly EventType[];
  from?: string;
  to?: string;
  hosts?: readonly string[];
}

/** What the API is asked for, or null when nothing is searched or filtered and the tabs show. */
export function eventsSearchOf(
  look: EventsLook,
  today: string,
  firstDay: number,
): EventsSearch | null {
  if (!searching(look.q) && !filtered(look.filters)) return null;

  const span = whenSpan(look.filters.when, today, firstDay);

  return {
    ...(searching(look.q) ? { q: look.q.trim() } : {}),
    ...(look.filters.types.length > 0 ? { types: look.filters.types } : {}),
    ...(span != null && span.from !== '' ? { from: span.from } : {}),
    ...(span != null && span.to !== '' ? { to: span.to } : {}),
    ...(look.filters.hosts.length > 0 ? { hosts: look.filters.hosts } : {}),
  };
}

function toggled<T>(list: readonly T[], one: T, order: readonly T[]): T[] {
  const next = list.includes(one) ? list.filter((item) => item !== one) : [...list, one];

  return order.filter((item) => next.includes(item));
}

export function withTypeToggled(filters: EventsFilters, type: EventType): EventsFilters {
  return { ...filters, types: toggled(filters.types, type, EVENT_TYPES) };
}

export function withHostToggled(
  filters: EventsFilters,
  host: string,
  offered: readonly string[],
): EventsFilters {
  const order = [...new Set([...offered, ...filters.hosts, host])];

  return { ...filters, hosts: toggled(filters.hosts, host, order) };
}
