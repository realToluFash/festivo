import {
  ApiError,
  AUDIT_TYPES,
  type AuditEntry,
  type AuditExportOutcome,
  type AuditFilters,
  type AuditFormat,
  type AuditLogPage,
  type AuditType,
  type AuditWho,
} from '@soirely/api-client';
import type { TFunction } from 'i18next';

import type { LayoutKind } from '../layout/classify.ts';

export type AuditMenu = 'person' | 'type' | 'event';

export interface DayRange {
  from: string;
  to: string;
}

export interface AuditPicks {
  person: string | null;
  type: AuditType | null;
  event: string | null;
  range: DayRange | null;
}

export const NO_PICKS: AuditPicks = { person: null, type: null, event: null, range: null };

export function picked(picks: AuditPicks): boolean {
  return picks.person != null || picks.type != null || picks.event != null || picks.range != null;
}

export function auditFiltersOf(picks: AuditPicks): AuditFilters {
  return {
    person: picks.person,
    type: picks.type,
    event: picks.event,
    from: picks.range?.from ?? null,
    to: picks.range?.to ?? null,
  };
}

export function datesProblem(t: TFunction, range: DayRange): string | null {
  return range.from > range.to ? t('auditLog.order') : null;
}

export function dayKeyIn(at: Date | string, zone: string | null): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: zone ?? 'UTC',
  }).format(typeof at === 'string' ? new Date(at) : at);
}

function daysBefore(key: string, days: number): string {
  const at = new Date(`${key}T12:00:00Z`);
  at.setUTCDate(at.getUTCDate() - days);

  return at.toISOString().slice(0, 10);
}

/** What Dates opens on with no range picked: the last 365 days, as the log keeps them. */
export function lastYear(now: Date, zone: string | null): DayRange {
  const today = dayKeyIn(now, zone);

  return { from: daysBefore(today, 365), to: today };
}

export interface AuditDay {
  key: string;
  heading: string;
  entries: AuditEntry[];
}

/** "Monday, Oct 19" for a YYYY-MM-DD already placed in the reader's zone. */
export function dayWords(key: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${key}T12:00:00Z`));
}

/** The entries newest first as the server sends them, a heading per day; today's says so. */
export function byDay(
  t: TFunction,
  entries: readonly AuditEntry[],
  now: Date,
  zone: string | null,
  locale: string,
): AuditDay[] {
  const today = dayKeyIn(now, zone);
  const days: AuditDay[] = [];

  for (const entry of entries) {
    const key = dayKeyIn(entry.at, zone);
    const last = days[days.length - 1];
    if (last?.key === key) last.entries.push(entry);
    else
      days.push({
        key,
        heading:
          key === today
            ? t('auditLog.today', { day: dayWords(key, locale) })
            : dayWords(key, locale),
        entries: [entry],
      });
  }

  return days;
}

export function whoName(t: TFunction, who: AuditWho): string {
  if (who.kind === 'support') return t('auditLog.support');
  if (who.kind === 'system') return t('auditLog.system');

  return who.name ?? '';
}

export function typeWord(t: TFunction, type: AuditType): string {
  return t(`auditLog.types.${type}`);
}

export function entryLine(t: TFunction, entry: AuditEntry): string {
  return t('auditLog.entryLine', { who: whoName(t, entry.who), type: typeWord(t, entry.type) });
}

export interface AuditChoice {
  value: string | null;
  word: string;
}

export function menuChoices(
  t: TFunction,
  menu: AuditMenu,
  page: Pick<AuditLogPage, 'people' | 'events'>,
): AuditChoice[] {
  if (menu === 'person')
    return [
      { value: null, word: t('auditLog.anyone') },
      ...page.people.map((person) => ({
        value: person.id,
        word: person.left ? t('auditLog.left', { name: person.name }) : person.name,
      })),
    ];
  if (menu === 'type')
    return [
      { value: null, word: t('auditLog.allTypes') },
      ...AUDIT_TYPES.map((type) => ({ value: type, word: typeWord(t, type) })),
    ];

  return [
    { value: null, word: t('auditLog.allEvents') },
    ...page.events.map((event) => ({ value: event.id, word: event.name })),
  ];
}

export function rangeWords(t: TFunction, range: DayRange | null, locale: string): string {
  if (range == null) return t('auditLog.lastYear');
  const format = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const day = (key: string) => format.format(new Date(`${key}T12:00:00Z`));

  return t('auditLog.range', { from: day(range.from), to: day(range.to) });
}

/** What each filter's button reads: its resting words, or what is picked. */
export function buttonWords(
  t: TFunction,
  picks: AuditPicks,
  page: Pick<AuditLogPage, 'people' | 'events'>,
  locale: string,
): Record<AuditMenu | 'dates', string> {
  const person = page.people.find((one) => one.id === picks.person);
  const event = page.events.find((one) => one.id === picks.event);

  return {
    person: person?.name ?? t('auditLog.anyone'),
    type: picks.type == null ? t('auditLog.allTypes') : typeWord(t, picks.type),
    event: event?.name ?? t('auditLog.allEvents'),
    dates: rangeWords(t, picks.range, locale),
  };
}

export interface DetailRow {
  key: string;
  label: string;
  value: string;
  code?: string;
  /** An event that still exists opens from here. */
  eventId?: string;
  codeOnly?: boolean;
}

export function detailRows(t: TFunction, entry: AuditEntry): DetailRow[] {
  const label = (key: string) => t(`auditLog.labels.${key}`);
  const who = whoName(t, entry.who);
  const on = entry.on;
  const rows: (DetailRow | null)[] = [
    { key: 'when', label: label('when'), value: entry.when },
    {
      key: 'who',
      label: label('who'),
      value:
        entry.who.email == null
          ? who
          : t('auditLog.whoWithEmail', { name: who, email: entry.who.email }),
    },
    { key: 'what', label: label('what'), value: entry.what },
    on == null
      ? null
      : {
          key: 'on',
          label: label('on'),
          value: on.gone ? t('auditLog.gone', { name: on.name }) : on.name,
          ...(on.gone || on.eventId == null ? {} : { eventId: on.eventId }),
        },
    entry.changes.length === 0
      ? null
      : { key: 'changes', label: label('changes'), value: entry.changes.join('\n') },
    {
      key: 'kind',
      label: label('kind'),
      value: t('auditLog.kindValue', { type: typeWord(t, entry.type) }),
      code: entry.action,
    },
    entry.address == null
      ? null
      : { key: 'address', label: label('address'), value: '', code: entry.address, codeOnly: true },
    entry.device == null ? null : { key: 'device', label: label('device'), value: entry.device },
    {
      key: 'reference',
      label: label('reference'),
      value: '',
      code: entry.reference,
      codeOnly: true,
    },
  ];

  return rows.filter((row): row is DetailRow => row != null);
}

/** The phone has no Export; both iPad layouts have it. */
export function exportsHere(kind: LayoutKind): boolean {
  return kind !== 'phone';
}

export const AUDIT_FILE_TYPES: Record<AuditFormat, { mimeType: string; UTI: string }> = {
  csv: { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' },
  jsonl: { mimeType: 'application/jsonl', UTI: 'public.plain-text' },
};

export function auditFileName(format: AuditFormat, now: Date, zone: string | null): string {
  return `audit-log-${dayKeyIn(now, zone)}.${format}`;
}

export type ExportAnswer =
  | { kind: 'file'; bytes: Uint8Array<ArrayBuffer> }
  | { kind: 'preparing'; email: string }
  | { kind: 'tooMany' }
  | { kind: 'failed' };

export function exportAnswered(outcome: AuditExportOutcome): ExportAnswer {
  return outcome.kind === 'file'
    ? { kind: 'file', bytes: outcome.bytes }
    : { kind: 'preparing', email: outcome.email };
}

export function exportRefused(error: unknown): ExportAnswer {
  return error instanceof ApiError && error.is('audit_export_too_many')
    ? { kind: 'tooMany' }
    : { kind: 'failed' };
}

/** Off Enterprise the log is refused `plan_required`, and the page shows it locked. */
export function loadRefused(error: unknown): 'locked' | 'failed' {
  return error instanceof ApiError && error.status === 403 && error.is('plan_required')
    ? 'locked'
    : 'failed';
}

export interface AuditCard {
  says: string;
  line: string;
  step: string | null;
}

export function auditCard(
  t: TFunction,
  {
    organisation,
    locked,
    preparing,
    kind,
  }: { organisation: string; locked: boolean; preparing: string | null; kind: LayoutKind },
): AuditCard {
  if (locked)
    return {
      says: t('auditLog.locked'),
      line: t('auditLog.lockedLine', { organisation }),
      step: null,
    };
  if (preparing != null)
    return {
      says: t('auditLog.preparing'),
      line: t('auditLog.preparingLine', { email: preparing }),
      step: null,
    };

  return {
    says: t('auditLog.says', { organisation }),
    line: t('auditLog.line'),
    step: exportsHere(kind) ? t('auditLog.export') : null,
  };
}

/** The next page after the ones shown: its entries after theirs, once each. */
export function withMore(shown: AuditLogPage, more: AuditLogPage): AuditLogPage {
  const ids = new Set(shown.entries.map((entry) => entry.id));

  return {
    ...more,
    entries: [...shown.entries, ...more.entries.filter((entry) => !ids.has(entry.id))],
  };
}

const opened = new Map<string, AuditEntry>();

/** On a phone an entry opens on a page of its own, which reads it from here; there is no request for one entry. */
export function rememberEntry(entry: AuditEntry): void {
  opened.clear();
  opened.set(entry.id, entry);
}

export function rememberedEntry(id: string | undefined): AuditEntry | null {
  return id == null ? null : (opened.get(id) ?? null);
}
