import { type Translate, exportColumns } from '@soirely/domain';

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
  'exportSearched',
  'exportSearchedPt',
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
    case 'exportSearched':
    case 'exportSearchedPt':
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

/** What narrows This view, as whole lines with slots: the menu's choice, then the search. */
export function narrowing(shown: string, searched: string): string {
  const query = searched.trim();

  return query === '' ? `Filter: ${shown}` : `Filter: ${shown} · search “${query}”`;
}

const people = (count: number) => (count === 1 ? '1 person' : `${count} people`);

/** Export's header words from a catalogue, as the Portuguese title row reads them (sc-67659). */
export function exportWordsIn(
  t: (key: 'guestExport.export' | 'guestExport.needsConnection') => string,
) {
  return { export: t('guestExport.export'), needsConnection: t('guestExport.needsConnection') };
}

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

/** The words the Export sheet shows: English from XW, or another language from its catalogue (sc-72136). */
export interface SheetWords {
  title: string;
  close: string;
  who: string;
  thisView: (count: number) => string;
  allGuests: (count: number) => string;
  nothingInView: string;
  format: string;
  excel: string;
  csv: string;
  file: string;
  columns: string;
  columnsFor: (needs: boolean) => readonly string[];
  noNeeds: string;
  safety: string;
  share: string;
  preparing: string;
  failed: string;
  dropped: string;
}

export const ENGLISH_SHEET: SheetWords = {
  title: XW.title,
  close: XW.close,
  who: XW.who,
  thisView: XW.thisView,
  allGuests: XW.allGuests,
  nothingInView: XW.nothingInView,
  format: XW.format,
  excel: XW.excel,
  csv: XW.csv,
  file: XW.file,
  columns: XW.columns,
  columnsFor,
  noNeeds: XW.noNeeds,
  safety: XW.safety,
  share: XW.share,
  preparing: XW.preparing,
  failed: XW.failed,
  dropped: XW.dropped,
};

export function sheetWordsIn(t: Translate): SheetWords {
  return {
    title: t('guestExport.title'),
    close: t('guestList.cancel'),
    who: t('guestExport.who'),
    thisView: (count) => t('guestExport.thisView', { count }),
    allGuests: (count) => t('guestExport.allGuests', { count }),
    nothingInView: t('guestExport.nothingInView'),
    format: t('guestExport.format'),
    excel: t('guestExport.excel'),
    csv: t('guestExport.csv'),
    file: t('guestExport.file'),
    columns: t('guestExport.columns'),
    columnsFor: (needs) => exportColumns(needs).map((one) => t(`guestExport.column.${one}`)),
    noNeeds: t('guestExport.noNeeds'),
    safety: t('guestExport.safety'),
    share: t('guestExport.share'),
    preparing: t('guestExport.preparing'),
    failed: t('guestExport.failed'),
    dropped: t('guestExport.dropped'),
  };
}

/** sc-72136: Cancel shares the title's row only where the title's widest word, at the size the title draws alone, a gap and Cancel fit the row; otherwise it takes the row under the title. Until all three are measured it stays beside, as on main. */
export function cancelUnder({
  room,
  widest,
  cancel,
  gap,
}: {
  room: number;
  widest: number;
  cancel: number;
  gap: number;
}): boolean {
  if (room <= 0 || widest <= 0 || cancel <= 0) return false;

  return widest + gap + cancel > room;
}
