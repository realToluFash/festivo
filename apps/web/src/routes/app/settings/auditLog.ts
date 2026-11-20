import type {
  AuditEntry,
  AuditFilters,
  AuditFormat,
  AuditType,
  AuditWho,
} from '@soirely/api-client';
import type { TFunction } from 'i18next';

import type { Fact } from '../../../components/AuditLogParts.tsx';

export interface Filters {
  person: string | null;
  type: AuditType | null;
  event: string | null;
  from: string;
  to: string;
}

export const NO_FILTERS: Filters = { person: null, type: null, event: null, from: '', to: '' };

export function filtered(filters: Filters): boolean {
  return (
    filters.person != null ||
    filters.type != null ||
    filters.event != null ||
    filters.from !== '' ||
    filters.to !== ''
  );
}

export function asQuery(filters: Filters): AuditFilters {
  return {
    person: filters.person,
    type: filters.type,
    event: filters.event,
    from: filters.from === '' ? null : filters.from,
    to: filters.to === '' ? null : filters.to,
  };
}

export function datesBackwards(from: string, to: string): boolean {
  return from !== '' && to !== '' && from > to;
}

export function typeWord(t: TFunction, type: AuditType): string {
  return t(`auditLog.types.${type}`);
}

export function whoWord(t: TFunction, who: AuditWho): string {
  if (who.kind === 'support') return t('auditLog.support');
  if (who.kind === 'system') return t('auditLog.system');

  return who.name ?? '';
}

/** The day an instant falls on in a zone, as YYYY-MM-DD; null is UTC. */
export function dayIn(at: string | Date, zone: string | null): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zone ?? 'UTC' }).format(new Date(at));
}

export interface Day {
  day: string;
  heading: string;
  entries: AuditEntry[];
}

/** "Monday, Oct 19" for a YYYY-MM-DD the server already placed in the reader's zone. */
export function dayWords(day: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T12:00:00Z`));
}

/** The entries as the server orders them, newest first, a heading per day; today's, in the page's zone, says so. */
export function byDay(
  t: TFunction,
  entries: readonly AuditEntry[],
  zone: string | null,
  locale: string,
  now: Date,
): Day[] {
  const today = dayIn(now, zone);
  const days: Day[] = [];

  for (const entry of entries) {
    const last = days.at(-1);

    if (last?.day === entry.day) last.entries.push(entry);
    else
      days.push({
        day: entry.day,
        heading:
          entry.day === today
            ? t('auditLog.today', { day: dayWords(entry.day, locale) })
            : dayWords(entry.day, locale),
        entries: [entry],
      });
  }

  return days;
}

export function rangeWords(
  t: TFunction,
  dates: Pick<Filters, 'from' | 'to'>,
  locale: string,
): string {
  if (dates.from === '' && dates.to === '') return t('auditLog.lastYear');

  const day = (date: string) =>
    date === ''
      ? t('auditLog.openEnd')
      : new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
          new Date(`${date}T00:00Z`),
        );

  return t('auditLog.range', { from: day(dates.from), to: day(dates.to) });
}

export const EVENT_PAGE = (eventId: string) => `/app/events/${encodeURIComponent(eventId)}`;

/** An entry's detail: what it records, and only what it records. */
export function factsOf(t: TFunction, entry: AuditEntry): Fact[] {
  const who = whoWord(t, entry.who);
  const facts: Fact[] = [
    { label: t('auditLog.when'), value: entry.when },
    {
      label: t('auditLog.who'),
      value:
        entry.who.email == null ? who : t('auditLog.whoEmail', { who, email: entry.who.email }),
    },
    { label: t('auditLog.what'), value: entry.what },
  ];
  const on = entry.on;

  if (on != null)
    facts.push({
      label: t('auditLog.on'),
      value: on.gone ? t('auditLog.onGone', { name: on.name }) : on.name,
      ...(on.eventId == null || on.gone ? {} : { link: EVENT_PAGE(on.eventId) }),
    });
  if (entry.changes.length > 0) facts.push({ label: t('auditLog.changes'), value: entry.changes });
  facts.push({
    label: t('auditLog.typeAndAction'),
    value: t('auditLog.typeAction', { type: typeWord(t, entry.type), action: entry.action }),
  });
  if (entry.address != null)
    facts.push({ label: t('auditLog.address'), value: entry.address, code: true });
  if (entry.device != null) facts.push({ label: t('auditLog.device'), value: entry.device });
  facts.push({ label: t('auditLog.reference'), value: entry.reference, code: true });

  return facts;
}

export function formatOf(contentType: string): AuditFormat {
  return contentType.split(';')[0]?.trim().toLowerCase() === 'text/csv' ? 'csv' : 'jsonl';
}

export function auditFileName(format: AuditFormat, now: Date, zone: string | null): string {
  return `audit-log-${dayIn(now, zone)}.${format}`;
}

export function saveAuditFile(bytes: Uint8Array<ArrayBuffer>, type: string, name: string): void {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const link = document.createElement('a');

  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
