import {
  type AuditEntry,
  type AuditType,
  AUDIT_EVENTS,
  AUDIT_PEOPLE,
  AUDIT_TYPES,
  ENTRIES,
} from './AuditSample.ts';
import { type DataSay, type DataZone, NOW, plusDays, ZONE } from './DataSample.ts';
import { AUDIT_WORDS as A } from './DataWords.ts';
import type { Load } from './RolesSample.ts';

export const AUDIT_STATES = [
  'list',
  'filter_person',
  'filter_type',
  'filter_event',
  'dates',
  'date_invalid',
  'filtered',
  'empty_filter',
  'detail',
  'detail_gone',
  'detail_signin',
  'detail_old',
  'detail_system',
  'export',
  'export_small',
  'export_preparing',
  'export_too_many',
  'locked',
  'loading',
  'failed',
] as const;
export type AuditState = (typeof AUDIT_STATES)[number];

/** The phone has no Export: its states open the list there. */
const EXPORT_STATES: readonly AuditState[] = [
  'export',
  'export_small',
  'export_preparing',
  'export_too_many',
];

export function auditStateOf(name: string | undefined, phone: boolean): AuditState {
  const state = AUDIT_STATES.find((one) => one === name) ?? 'list';

  return phone && EXPORT_STATES.includes(state) ? 'list' : state;
}

export type Menu = 'person' | 'type' | 'event';
export type Format = 'csv' | 'jsonLines';
/** How many entries match, as Export answers: one download, prepared and emailed, or too many. */
export type Scale = 'small' | 'large' | 'tooMany';

export interface Range {
  from: string;
  to: string;
}

export interface Filters {
  person: string | null;
  type: AuditType | null;
  event: string | null;
  range: Range | null;
}

export const NO_FILTERS: Filters = { person: null, type: null, event: null, range: null };

export interface AuditStart {
  load: Load;
  locked: boolean;
  filters: Filters;
  menu: Menu | null;
  dates: Range | null;
  open: string | null;
  exporting: { format: Format; refused: boolean } | null;
  preparing: boolean;
  toast: string | null;
  scale: Scale;
}

export const SAMPLE_RANGE: Range = { from: '2026-10-01', to: '2026-10-19' };

export function auditStart(state: AuditState): AuditStart {
  const base: AuditStart = {
    load: 'loaded',
    locked: false,
    filters: NO_FILTERS,
    menu: null,
    dates: null,
    open: null,
    exporting: null,
    preparing: false,
    toast: null,
    scale: 'small',
  };
  const detail = (id: string) => ({ ...base, open: id });

  switch (state) {
    case 'list':
      return base;
    case 'loading':
    case 'failed':
      return { ...base, load: state };
    case 'locked':
      return { ...base, locked: true };
    case 'filter_person':
      return { ...base, menu: 'person' };
    case 'filter_type':
      return { ...base, menu: 'type' };
    case 'filter_event':
      return { ...base, menu: 'event' };
    case 'dates':
      return { ...base, dates: SAMPLE_RANGE };
    case 'date_invalid':
      return { ...base, dates: { from: SAMPLE_RANGE.to, to: SAMPLE_RANGE.from } };
    case 'filtered':
      return { ...base, filters: { ...NO_FILTERS, type: 'Sign-in and security' } };
    case 'empty_filter':
      return { ...base, filters: { ...NO_FILTERS, person: 'Ana Souza', type: 'Events' } };
    case 'detail':
      return detail('live');
    case 'detail_gone':
      return detail('deleted');
    case 'detail_signin':
      return detail('rules');
    case 'detail_old':
      return detail('added');
    case 'detail_system':
      return detail('proved');
    case 'export':
      return { ...base, exporting: { format: 'csv', refused: false } };
    case 'export_small':
      return { ...base, toast: A.downloading(A.csv) };
    case 'export_preparing':
      return { ...base, preparing: true, scale: 'large' };
    case 'export_too_many':
      return { ...base, exporting: { format: 'csv', refused: true }, scale: 'tooMany' };
  }
}

export function filtered(filters: Filters): boolean {
  return (
    filters.person != null || filters.type != null || filters.event != null || filters.range != null
  );
}

export function dayKeyIn(iso: string, zone: DataZone = ZONE): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: zone,
  }).format(new Date(iso));
}

/** Kept for 365 days: the default range is the last 365 days to now. */
export function matching(
  filters: Filters,
  entries: readonly AuditEntry[] = ENTRIES,
  zone: DataZone = ZONE,
): AuditEntry[] {
  const oldest = plusDays(NOW, -365);

  return entries.filter((entry) => {
    const day = dayKeyIn(entry.at, zone);
    if (filters.range == null && entry.at < oldest) return false;
    if (filters.range != null && (day < filters.range.from || day > filters.range.to)) return false;
    if (filters.person != null && entry.who !== filters.person) return false;
    if (filters.type != null && entry.type !== filters.type) return false;

    return filters.event == null || entry.event === filters.event;
  });
}

export interface Day {
  key: string;
  heading: string;
  entries: AuditEntry[];
}

export function byDay(entries: readonly AuditEntry[], say: DataSay): Day[] {
  const today = say.dayKey(NOW);
  const days: Day[] = [];
  for (const entry of entries) {
    const key = say.dayKey(entry.at);
    const last = days[days.length - 1];
    if (last?.key === key) last.entries.push(entry);
    else {
      const day = say.day(entry.at);
      days.push({ key, heading: key === today ? A.today(day) : day, entries: [entry] });
    }
  }

  return days;
}

export function entryLine(entry: AuditEntry): string {
  return `${entry.who} · ${entry.type}`;
}

export interface Choice {
  value: string | null;
  word: string;
}

export function menuChoices(menu: Menu): Choice[] {
  if (menu === 'person')
    return [
      { value: null, word: A.anyone },
      ...AUDIT_PEOPLE.map(({ name, left }) => ({ value: name, word: left ? A.left(name) : name })),
    ];
  if (menu === 'type')
    return [
      { value: null, word: A.allTypes },
      ...AUDIT_TYPES.map((type) => ({ value: type, word: type })),
    ];

  return [
    { value: null, word: A.allEvents },
    ...AUDIT_EVENTS.map((event) => ({ value: event, word: event })),
  ];
}

export function rangeWords(range: Range | null, locale: string): string {
  if (range == null) return A.lastYear;
  const format = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

  const day = (key: string) => format.format(new Date(`${key}T12:00:00Z`));

  return `${day(range.from)} to ${day(range.to)}`;
}

/** What each menu button reads: its resting words, or what is picked. */
export function buttonWords(filters: Filters, locale: string): Record<Menu | 'dates', string> {
  return {
    person: filters.person ?? A.anyone,
    type: filters.type ?? A.allTypes,
    event: filters.event ?? A.allEvents,
    dates: rangeWords(filters.range, locale),
  };
}

export const MENU_NAMES: Record<Menu | 'dates', string> = {
  person: A.person,
  type: A.type,
  event: A.event,
  dates: A.dates,
};

/** Caught at once, under To: the start after the end. */
export function datesProblem(range: Range): string | null {
  return range.from > range.to ? A.order : null;
}

export interface DetailRow {
  label: string;
  value: string;
  code?: string;
  /** An event that still exists opens from here. */
  eventId?: string;
  codeOnly?: boolean;
}

export function detailRows(entry: AuditEntry, say: DataSay): DetailRow[] {
  const L = A.labels;
  const rows: (DetailRow | null)[] = [
    { label: L.when, value: say.exact(entry.at) },
    {
      label: L.who,
      value: entry.whoEmail == null ? entry.who : `${entry.who} · ${entry.whoEmail}`,
    },
    { label: L.what, value: entry.what },
    {
      label: L.on,
      value: entry.on.gone ? A.gone(entry.on.name) : entry.on.name,
      ...(entry.on.eventId == null ? {} : { eventId: entry.on.eventId }),
    },
    entry.changes == null ? null : { label: L.changes, value: entry.changes },
    { label: L.kind, value: `${entry.type} ·`, code: entry.action },
    entry.address == null
      ? null
      : { label: L.address, value: '', code: entry.address, codeOnly: true },
    entry.device == null ? null : { label: L.device, value: entry.device },
    { label: L.reference, value: '', code: entry.reference, codeOnly: true },
  ];

  return rows.filter((row): row is DetailRow => row != null);
}

export function entryOf(id: string | null): AuditEntry | null {
  return ENTRIES.find((entry) => entry.id === id) ?? null;
}

/** Export answers by how many match: up to 10,000 download, up to 1,000,000 are prepared, more are refused. */
export function exportAnswer(scale: Scale): 'download' | 'prepare' | 'refuse' {
  return scale === 'small' ? 'download' : scale === 'large' ? 'prepare' : 'refuse';
}

export const FORMAT_WORDS: Record<Format, string> = { csv: A.csv, jsonLines: A.jsonLines };
