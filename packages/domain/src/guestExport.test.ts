import { describe, expect, it } from 'vitest';

import {
  EXPORT_COLUMNS,
  exportColumns,
  exportFileName,
  exportNarrowing,
  exportScope,
  exportsGuests,
} from './guestExport.ts';
import type { Translate } from './eventWords.ts';

const t = ((key: string, values?: Record<string, string | number>) =>
  values == null ? key : `${key} ${JSON.stringify(values)}`) as Translate;

describe('guest export (sc-3784)', () => {
  it('leaves the needs columns out without guests.manage', () => {
    expect(exportColumns(true)).toEqual(EXPORT_COLUMNS);
    expect(exportColumns(false)).toEqual([
      'fullName',
      'guestOf',
      'group',
      'reply',
      'repliedOn',
      'email',
      'mobile',
      'places',
      'addedOn',
    ]);
  });

  it('offers Export to everyone who reads guests but Can view and Can check guests in', () => {
    const reads = ['guests.read'];

    expect(exportsGuests({ permissions: reads })).toBe(true);
    expect(exportsGuests({ permissions: reads, roleOnEvent: 'can_edit' })).toBe(true);
    expect(exportsGuests({ permissions: reads, roleOnEvent: 'can_view' })).toBe(false);
    expect(exportsGuests({ permissions: reads, roleOnEvent: 'can_check_in' })).toBe(false);
    expect(exportsGuests({ permissions: [] })).toBe(false);
  });

  it('chooses All guests when the view is empty', () => {
    expect(exportScope('view', 0)).toBe('all');
    expect(exportScope('view', 3)).toBe('view');
    expect(exportScope('all', 3)).toBe('all');
  });

  it('names the file by the event and today in its own zone, a slash read as a dash', () => {
    const now = new Date('2026-11-17T23:30:00Z');

    expect(exportFileName(t, { name: 'Ada / Obi', timeZone: 'Africa/Lagos' }, now, 'csv')).toBe(
      'guestExport.fileName {"event":"Ada - Obi","day":"2026-11-18","extension":"csv"}',
    );
    expect(exportFileName(t, { name: 'Owambe', timeZone: 'America/New_York' }, now, 'xlsx')).toBe(
      'guestExport.fileName {"event":"Owambe","day":"2026-11-17","extension":"xlsx"}',
    );
  });

  it('says what narrows This view as one whole line', () => {
    expect(exportNarrowing(t, 'All', ' ', [])).toBe('guestExport.narrowed {"choice":"All"}');
    expect(exportNarrowing(t, 'Coming', ' okonkwo ', [])).toBe(
      'guestExport.narrowedSearch {"choice":"Coming","query":"okonkwo"}',
    );
    expect(exportNarrowing(t, 'All', '', ['Dietary notes', 'Family'])).toBe(
      'guestExport.narrowedFilters {"choice":"All","filters":"Dietary notes · Family"}',
    );
    expect(exportNarrowing(t, 'All', 'ada', ['Family'])).toBe(
      'guestExport.narrowedSearchFilters {"choice":"All","query":"ada","filters":"Family"}',
    );
  });
});
