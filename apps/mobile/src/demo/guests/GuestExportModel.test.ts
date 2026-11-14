import { describe, expect, it } from 'vitest';

import {
  COLUMNS,
  EXPORT_STATES,
  XW,
  columnsFor,
  exportDay,
  exportStart,
  fileName,
  inViewOf,
  narrowing,
  scopeFor,
} from './GuestExportModel.ts';
import { GUESTS_BOARDS } from './GuestsBoards.ts';
import { areaStart, guestsStateOf, roleOf } from './GuestsModel.ts';

describe('the app’s guest export (sc-3784)', () => {
  it('names the file by the event and today in the event’s zone', () => {
    const late = new Date('2026-11-03T23:30:00Z');

    expect(exportDay(late, 'Africa/Lagos')).toBe('2026-11-04');
    expect(exportDay(late, 'America/New_York')).toBe('2026-11-03');
    expect(fileName('Adaeze & Tunde', '2026-11-04', 'xlsx')).toBe(
      'Adaeze & Tunde – guests – 2026-11-04.xlsx',
    );
    expect(fileName('Adaeze & Tunde', '2026-11-04', 'csv')).toMatch(/\.csv$/);
  });

  it('drops only the needs columns without guests.manage', () => {
    expect(columnsFor(true)).toEqual(COLUMNS);
    expect(columnsFor(false)).toEqual([
      'Full name',
      'Guest of',
      'Group',
      'Reply',
      'Replied on',
      'Email',
      'Mobile number',
      'Places',
      'Added on',
    ]);
  });

  it('chooses All guests when the view is empty, whatever was asked', () => {
    expect(scopeFor('view', 0)).toBe('all');
    expect(scopeFor('view', 21)).toBe('view');
    expect(scopeFor('all', 21)).toBe('all');
  });

  it('counts This view as the list’s own shown line does', () => {
    const base = { rows: 3, filtered: 21, total: 156 };

    expect(inViewOf({ ...base, filter: 'all', searched: '' })).toBe(156);
    expect(inViewOf({ ...base, filter: 'noreply', searched: '' })).toBe(21);
    expect(inViewOf({ ...base, filter: 'all', searched: 'okon' })).toBe(3);
    expect(inViewOf({ ...base, filter: 'changed', searched: '' })).toBe(3);
    expect(inViewOf({ ...base, rows: 0, filter: 'held', searched: 'marta' })).toBe(0);
  });

  it('says what narrows the view in whole lines', () => {
    expect(narrowing('All', '')).toBe('Filter: All');
    expect(narrowing('No reply', '  ')).toBe('Filter: No reply');
    expect(narrowing('Coming', ' okon ')).toBe('Filter: Coming · search “okon”');
  });

  it('counts people, one and many', () => {
    expect(XW.thisView(1)).toBe('This view (1 person)');
    expect(XW.allGuests(156)).toBe('All guests (156 people)');
  });

  it('opens each state as its board says', () => {
    expect(exportStart('export')).toMatchObject({ open: true, format: 'xlsx', needs: true });
    expect(exportStart('exportCsv').format).toBe('csv');
    expect(exportStart('exportNoNeeds').needs).toBe(false);
    expect(exportStart('exportPreparing').making).toBe('preparing');
    expect(exportStart('exportFailed').making).toBe('failed');
    expect(exportStart('exportShare')).toMatchObject({ open: false, share: true });
    expect(exportStart('exportDropped')).toMatchObject({ open: true, dropped: true });
    expect(exportStart('exportOffline').open).toBe(false);
    expect(exportStart(null).open).toBe(false);
    expect(areaStart('exportNarrowed').filter).toBe('noreply');
    expect(areaStart('exportEmpty')).toMatchObject({ filter: 'held', typed: 'marta' });
    expect(areaStart('exportOffline').offline).toBe(true);
    expect(areaStart('exportDropped').offline).toBe(true);
    expect(roleOf('exportGrantView')).toBe('viewer');
  });

  it('lists every state in the demo home', () => {
    for (const state of EXPORT_STATES) {
      expect(guestsStateOf(state)).toBe(state);
      expect(GUESTS_BOARDS.some((b) => b.href === `/demo/guests?state=${state}`)).toBe(true);
    }
  });
});
