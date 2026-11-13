import { CLOCKS, localDay, sampleEvent } from './events.ts';
import type { Choice } from './guests.ts';
import { CHOICE_WORDS, GW, figure } from './guestsWords.ts';

/** sc-3784's Export at a desk: the dialog's choices, the file it names, and what it says while the file is made. */
export type Scope = 'view' | 'all';
export type Format = 'xlsx' | 'csv';
export type Making = 'ready' | 'preparing' | 'failed';

export interface ExportStart {
  scope?: Scope;
  format?: Format;
  making?: Making;
}

/** Decided, 19 Oct (pm): the file's columns, in this order; later epics add Table and Meal. */
export const COLUMNS = [
  'Full name',
  'Guest of',
  'Group',
  'Reply',
  'Replied on',
  'Email',
  'Mobile number',
  'Allergies',
  'Diet',
  'Access',
  'Places',
  'Added on',
] as const;

const NEEDS: readonly string[] = ['Allergies', 'Diet', 'Access'];

/** Without guests.manage the needs columns are not in the file, so not in the list either. */
export function columnsFor(needs: boolean): readonly string[] {
  return needs ? COLUMNS : COLUMNS.filter((one) => !NEEDS.includes(one));
}

/** "{event name} – guests – {YYYY-MM-DD}.xlsx", the date today in the event's zone (ISO 8601). */
export function fileName(event: string, day: string, format: Format): string {
  return `${event} – guests – ${day}.${format}`;
}

/** Today in the event's own zone, as the file name's date. */
export function exportDay(event: string, clock: Date = CLOCKS.rest): string {
  return localDay(clock, sampleEvent(event)?.timeZone ?? 'Europe/London');
}

/** An empty view can't be exported, so All guests is chosen whatever was asked. */
export function scopeFor(asked: Scope, inView: number): Scope {
  return inView === 0 ? 'all' : asked;
}

export const XW = {
  export: 'Export',
  title: 'Export guests',
  who: 'Who’s in it',
  thisView: (count: number) =>
    count === 1 ? 'This view (1 person)' : `This view (${figure(count)} people)`,
  allGuests: (count: number) =>
    count === 1 ? 'All guests (1 person)' : `All guests (${figure(count)} people)`,
  nothingInView: 'Nothing in this view to export.',
  format: 'Format',
  excel: 'Excel (.xlsx)',
  csv: 'CSV',
  file: 'The file',
  columns: 'Its columns',
  noNeeds:
    'Allergies, diet and access aren’t in this file, because seeing them needs permission to manage guests.',
  safety:
    'This file has guests’ personal details. Keep it somewhere safe, and delete it when you’re done.',
  download: 'Download',
  preparing: 'Preparing the file…',
  failed: 'The file could not be made, so nothing was downloaded. Try again.',
  ready: (file: string) => `Your file is ready. Look in your downloads for ${file}.`,
};

/** What narrows This view, as whole lines with slots: the menu's choice, then the search. */
export function narrowing(choice: Choice | 'changed', q: string): string {
  const shown = choice === 'changed' ? GW.changedSince : CHOICE_WORDS[choice];
  const query = q.trim();

  return query === '' ? `Filter: ${shown}` : `Filter: ${shown} · search “${query}”`;
}
