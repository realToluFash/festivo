import { wallDay } from './calendar.ts';
import type { Translate } from './eventWords.ts';

/** sc-3784's Export, the same on the web and in the app: who is in the file, its format, its name and its columns. */
export type ExportScope = 'view' | 'all';
export type ExportFormat = 'xlsx' | 'csv';

/** Decided, 19 Oct (pm): the file's columns, in this order, as the API writes them; later epics add Table and Meal. */
export const EXPORT_COLUMNS = [
  'fullName',
  'guestOf',
  'group',
  'reply',
  'repliedOn',
  'email',
  'mobile',
  'allergies',
  'diet',
  'access',
  'places',
  'addedOn',
] as const;
export type ExportColumn = (typeof EXPORT_COLUMNS)[number];

const NEEDS_COLUMNS: readonly ExportColumn[] = ['allergies', 'diet', 'access'];

/** Without guests.manage the needs columns are not in the file, so not in the dialog's list either. */
export function exportColumns(needs: boolean): readonly ExportColumn[] {
  return needs ? EXPORT_COLUMNS : EXPORT_COLUMNS.filter((one) => !NEEDS_COLUMNS.includes(one));
}

const EXPORTING_ROLES: readonly (string | null)[] = [null, 'lead', 'can_edit'];

/** Decided, 1 Nov: only the grants that edit the event get a copy; Owner and Admin hold no event role, and any other level is refused until decided, as the API refuses it. */
export function exportsGuests(event: {
  permissions: readonly string[];
  roleOnEvent?: string | null;
}): boolean {
  return (
    event.permissions.includes('guests.read') && EXPORTING_ROLES.includes(event.roleOnEvent ?? null)
  );
}

/** An empty view can't be exported, so All guests is chosen whatever was asked. */
export function exportScope(asked: ExportScope, inView: number): ExportScope {
  return inView === 0 ? 'all' : asked;
}

/** "{event name} – guests – {YYYY-MM-DD}.xlsx", the date today in the event's zone; a slash would make it a path, so it reads as a dash, as the API names it. */
export function exportFileName(
  t: Translate,
  event: { name: string; timeZone: string },
  now: Date,
  format: ExportFormat,
): string {
  return t('guestExport.fileName', {
    event: event.name.replace(/[/\\]/g, '-'),
    day: wallDay(now, event.timeZone),
    extension: format,
  });
}

/** The line under This view, as one whole sentence: the menu's choice, then the search, then the chips that narrow it. */
export function exportNarrowing(
  t: Translate,
  choice: string,
  q: string,
  filters: readonly string[],
): string {
  const query = q.trim();
  const chips = filters.join(' · ');

  if (query === '' && chips === '') return t('guestExport.narrowed', { choice });
  if (chips === '') return t('guestExport.narrowedSearch', { choice, query });
  if (query === '') return t('guestExport.narrowedFilters', { choice, filters: chips });

  return t('guestExport.narrowedSearchFilters', { choice, query, filters: chips });
}
