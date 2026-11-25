import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  COLUMNS,
  EXPORT_STATES,
  ENGLISH_SHEET,
  LONG_ONE_WORD_NAME,
  XW,
  columnsFor,
  exportDay,
  exportStart,
  exportWordsIn,
  exportedName,
  fileName,
  narrowing,
  scopeFor,
  sheetWordsIn,
} from './GuestExportModel.ts';
import { GUESTS_BOARDS } from './GuestsBoards.ts';
import { areaStart, guestsStateOf, inViewOf, roleOf, titleRowOf } from './GuestsModel.ts';

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
    expect(areaStart('offlinePt').offline).toBe(true);
    expect(areaStart('exportPt').offline).toBe(false);
    expect(roleOf('exportGrantView')).toBe('viewer');
  });

  it('lists every state in the demo home', () => {
    for (const state of [...EXPORT_STATES, 'exportPt', 'offlinePt'] as const) {
      expect(guestsStateOf(state)).toBe(state);
      expect(GUESTS_BOARDS.some((b) => b.href === `/demo/guests?state=${state}`)).toBe(true);
    }
  });

  it('shows Export in Portuguese beside Convidados, online and offline, and hides it only in titlePt', () => {
    const pt = JSON.parse(
      readFileSync(join(import.meta.dirname, '../../i18n/locales/pt.json'), 'utf8'),
    ) as { guestExport: Record<string, string> };
    const words = exportWordsIn((key) => pt.guestExport[key.split('.')[1] as string] as string);

    expect(titleRowOf('exportPt')).toEqual({ locale: 'pt', export: true });
    expect(titleRowOf('offlinePt')).toEqual({ locale: 'pt', export: true });
    expect(titleRowOf('titlePt')).toEqual({ locale: 'pt', export: false });
    expect(titleRowOf('inUse')).toEqual({ locale: 'en', export: true });
    expect(words).toEqual({
      export: 'Exportar',
      needsConnection: 'É preciso Internet para exportar',
    });
  });

  it('hands the title row’s Portuguese words to the header’s Export', () => {
    const screen = readFileSync(join(import.meta.dirname, 'GuestsScreen.tsx'), 'utf8');
    const button = screen.slice(
      screen.indexOf('<ExportButton'),
      screen.indexOf('/>', screen.indexOf('<ExportButton')),
    );

    expect(screen).toMatch(/inPortuguese = titleRow\.locale === 'pt'/);
    expect(screen).toMatch(/exportShown = [^;]*&& titleRow\.export;/);
    expect(screen).toMatch(/exportShown \? \(\s*<ExportButton/);
    expect(button).toMatch(/words=\{inPortuguese \? exportWordsIn\(portuguese\) : undefined\}/);
  });
});

describe('the Export sheet at the largest text sizes (sc-72136)', () => {
  it('opens the sheet after a search, in English and in Portuguese', () => {
    for (const state of ['exportSearched', 'exportSearchedPt'] as const) {
      expect(exportStart(state).open).toBe(true);
      expect(areaStart(state).typed).toBe('okon');
    }
    expect(titleRowOf('exportSearched').locale).toBe('en');
    expect(titleRowOf('exportSearchedPt').locale).toBe('pt');
  });

  it('opens the sheet for an event named with one word wider than the row, in English and in Portuguese', () => {
    for (const state of ['exportLongName', 'exportLongNamePt'] as const) {
      expect(exportStart(state).open).toBe(true);
      expect(exportedName(state, 'Adeola & Kwame')).toBe(LONG_ONE_WORD_NAME);
    }
    expect(LONG_ONE_WORD_NAME).not.toMatch(/\s/);
    expect(exportedName('exportSearched', 'Adeola & Kwame')).toBe('Adeola & Kwame');
    expect(titleRowOf('exportLongName').locale).toBe('en');
    expect(titleRowOf('exportLongNamePt').locale).toBe('pt');
  });

  it('speaks Portuguese from the catalogue, and English as XW has it', () => {
    const pt = JSON.parse(
      readFileSync(join(import.meta.dirname, '../../i18n/locales/pt.json'), 'utf8'),
    ) as Record<string, Record<string, unknown>>;
    const t = (key: string, values: Record<string, string | number> = {}) => {
      const [area, ...rest] = key.split('.');
      let found: unknown = pt[area as string];
      for (const part of rest) found = (found as Record<string, unknown>)[part];
      if (found == null && 'count' in values)
        found = (pt[area as string] as Record<string, unknown>)[`${rest.join('.')}_other`];
      return String(found).replace(/\{\{(\w+)(, number)?\}\}/g, (_, name: string) =>
        String(values[name]),
      );
    };
    const words = sheetWordsIn(t);

    expect(words.title).toBe('Exportar convidados');
    expect(words.close).toBe('Cancelar');
    expect(words.thisView(156)).toBe('Esta vista (156 pessoas)');
    expect(words.columnsFor(true)).toContain('Acessibilidade');
    expect(words.columnsFor(false)).not.toContain('Acessibilidade');
    expect(ENGLISH_SHEET.title).toBe(XW.title);
    expect(ENGLISH_SHEET.columnsFor(true)).toEqual(columnsFor(true));
  });
});
