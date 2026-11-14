import type { ListFilter } from './GuestsModel.ts';

/** sc-3784's Export in the app: the dialog's choices, the file it names, and what it says while the file is made. */
export type Scope = 'view' | 'all';
export type Format = 'xlsx' | 'csv';
export type Making = 'ready' | 'preparing' | 'failed';

export const EXPORT_STATES = [
  'export',
  'exportNarrowed',
  'exportEmpty',
  'exportCsv',
  'exportNoNeeds',
  'exportPreparing',
  'exportFailed',
  'exportShare',
  'exportOffline',
  'exportDropped',
  'exportGrantView',
] as const;

export type ExportState = (typeof EXPORT_STATES)[number];

export interface ExportStart {
  open: boolean;
  format: Format;
  making: Making;
  needs: boolean;
  share: boolean;
  dropped: boolean;
}

const CLOSED: ExportStart = {
  open: false,
  format: 'xlsx',
  making: 'ready',
  needs: true,
  share: false,
  dropped: false,
};

export function exportStart(state: string | null): ExportStart {
  switch (state) {
    case 'export':
    case 'exportNarrowed':
    case 'exportEmpty':
      return { ...CLOSED, open: true };
    case 'exportCsv':
      return { ...CLOSED, open: true, format: 'csv' };
    case 'exportNoNeeds':
      return { ...CLOSED, open: true, needs: false };
    case 'exportPreparing':
      return { ...CLOSED, open: true, making: 'preparing' };
    case 'exportFailed':
      return { ...CLOSED, open: true, making: 'failed' };
    case 'exportShare':
      return { ...CLOSED, share: true };
    case 'exportDropped':
      return { ...CLOSED, open: true, dropped: true };
    default:
      return CLOSED;
  }
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

export function exportDay(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((one) => one.type === type)?.value ?? '';

  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function fileName(event: string, day: string, format: Format): string {
  return `${event} – guests – ${day}.${format}`;
}

/** An empty view can't be exported, so All guests is chosen whatever was asked. */
export function scopeFor(asked: Scope, inView: number): Scope {
  return inView === 0 ? 'all' : asked;
}

/** The people This view holds, as the list's own "{n} of {total} shown" counts them. */
export function inViewOf({
  filter,
  searched,
  rows,
  filtered,
  total,
}: {
  filter: ListFilter;
  searched: string;
  rows: number;
  filtered: number;
  total: number;
}): number {
  const looking = filter !== 'all' || searched.trim() !== '';
  if (!looking) return total;
  if (rows === 0) return 0;
  return searched.trim() === '' && filter !== 'changed' ? filtered : rows;
}

/** What narrows This view, as whole lines with slots: the menu's choice, then the search. */
export function narrowing(shown: string, searched: string): string {
  const query = searched.trim();

  return query === '' ? `Filter: ${shown}` : `Filter: ${shown} · search “${query}”`;
}

const people = (count: number) => (count === 1 ? '1 person' : `${count} people`);

export const XW = {
  export: 'Export',
  title: 'Export guests',
  close: 'Cancel',
  who: 'Who’s in it',
  thisView: (count: number) => `This view (${people(count)})`,
  allGuests: (count: number) => `All guests (${people(count)})`,
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
  share: 'Share',
  preparing: 'Preparing the file…',
  failed: 'The file could not be made, so nothing was shared. Try again.',
  needsConnection: 'Export needs a connection',
  dropped: 'Export needs a connection. Nothing was exported.',
  shareSheet: 'Share',
  shareSheetDemo: (file: string) =>
    `Drawn by the system: the iOS share sheet, or Android’s share intent, with ${file}. Closing it returns to the list with no message, and the app keeps no copy.`,
  closeShareSheet: 'Close the share sheet',
};
