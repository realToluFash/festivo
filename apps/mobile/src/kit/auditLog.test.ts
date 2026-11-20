import { ApiError, type AuditEntry, ERROR_TYPE_PREFIX } from '@soirely/api-client';
import { init, t } from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';

import en from '../i18n/locales/en.json';
import {
  auditCard,
  auditFileName,
  auditFiltersOf,
  buttonWords,
  byDay,
  datesProblem,
  detailRows,
  entryLine,
  exportAnswered,
  exportRefused,
  exportsHere,
  lastYear,
  loadRefused,
  menuChoices,
  NO_PICKS,
  picked,
  rangeWords,
  rememberedEntry,
  rememberEntry,
  withMore,
} from './auditLog.ts';

beforeAll(() =>
  init({
    lng: 'en',
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
  }),
);

const entry = (over: Partial<AuditEntry> & Pick<AuditEntry, 'id' | 'at' | 'day'>): AuditEntry => ({
  time: '09:05',
  when: 'Monday, Oct 19, 2026, 10:05:18 WAT',
  who: { kind: 'person', name: 'Folake Adeyemi', email: 'folake@ire.events' },
  what: 'Made Ireti at 40 live',
  on: { name: 'Ireti at 40', eventId: 'evt-ireti', gone: false },
  changes: [],
  type: 'events',
  action: 'event.made_live',
  address: null,
  device: null,
  reference: 'c41e9a7b-2f6d-4b1e-9a53-7d0e6c2b8f14',
  ...over,
});

const PAGE = {
  people: [
    { id: 'p-folake', name: 'Folake Adeyemi', email: 'folake@ire.events', left: false },
    { id: 'p-marta', name: 'Marta Silva', email: null, left: true },
  ],
  events: [
    { id: 'e-ireti', name: 'Ireti at 40', gone: false },
    { id: 'e-bisi', name: 'Bisi & Kola’s engagement', gone: true },
  ],
};

const problem = (code: string, status: number) =>
  new ApiError({ type: `${ERROR_TYPE_PREFIX}${code}`, title: code, status });

describe('grouping by day', () => {
  const now = new Date('2026-10-19T12:00:00Z');

  it('keeps the server’s order, one heading per day in the reader’s zone, today saying so', () => {
    const days = byDay(
      t,
      [
        entry({ id: 'a', at: '2026-10-19T09:05:18Z', day: '2026-10-19' }),
        entry({ id: 'b', at: '2026-10-19T07:15:41Z', day: '2026-10-19' }),
        entry({ id: 'c', at: '2026-10-17T13:20:09Z', day: '2026-10-17' }),
      ],
      now,
      'Africa/Lagos',
      'en-US',
    );

    expect(days.map((day) => [day.heading, day.entries.map((one) => one.id)])).toEqual([
      ['Today · Monday, Oct 19', ['a', 'b']],
      ['Saturday, Oct 17', ['c']],
    ]);
  });

  it('reads the day in the reader’s zone, UTC when the account has none', () => {
    const late = entry({ id: 'late', at: '2026-10-18T23:30:00Z', day: '2026-10-19' });

    expect(byDay(t, [late], now, 'Africa/Lagos', 'en-US')[0]?.heading).toBe(
      'Today · Monday, Oct 19',
    );
    expect(byDay(t, [late], now, null, 'en-US')[0]?.key).toBe('2026-10-18');
  });
});

describe('filters', () => {
  it('sends only what is picked, the dates as from and to', () => {
    expect(auditFiltersOf(NO_PICKS)).toEqual({
      person: null,
      type: null,
      event: null,
      from: null,
      to: null,
    });
    expect(
      auditFiltersOf({
        person: 'p-marta',
        type: 'security',
        event: 'e-ireti',
        range: { from: '2026-10-01', to: '2026-10-19' },
      }),
    ).toEqual({
      person: 'p-marta',
      type: 'security',
      event: 'e-ireti',
      from: '2026-10-01',
      to: '2026-10-19',
    });
  });

  it('offers Clear filters only once something is picked', () => {
    expect(picked(NO_PICKS)).toBe(false);
    expect(picked({ ...NO_PICKS, type: 'events' })).toBe(true);
  });

  it('lists anyone, then the people, marking who has left', () => {
    expect(menuChoices(t, 'person', PAGE).map((one) => one.word)).toEqual([
      'Anyone',
      'Folake Adeyemi',
      'Marta Silva · left',
    ]);
  });

  it('words the six types', () => {
    expect(menuChoices(t, 'type', PAGE).map((one) => one.word)).toEqual([
      'All types',
      'Events',
      'Event access',
      'Members and invitations',
      'Sign-in and security',
      'Organisation',
      'Audit log',
    ]);
  });

  it('lists every event, gone ones included', () => {
    expect(menuChoices(t, 'event', PAGE).map((one) => one.value)).toEqual([
      null,
      'e-ireti',
      'e-bisi',
    ]);
  });

  it('reads each button as what is picked, or its resting words', () => {
    expect(buttonWords(t, NO_PICKS, PAGE, 'en-GB')).toEqual({
      person: 'Anyone',
      type: 'All types',
      event: 'All events',
      dates: 'Last 365 days',
    });
    expect(
      buttonWords(
        t,
        { person: 'p-marta', type: 'security', event: 'e-bisi', range: null },
        PAGE,
        'en-GB',
      ),
    ).toMatchObject({
      person: 'Marta Silva',
      type: 'Sign-in and security',
      event: 'Bisi & Kola’s engagement',
    });
    expect(rangeWords(t, { from: '2026-10-01', to: '2026-10-19' }, 'en-US')).toBe(
      'Oct 1 to Oct 19',
    );
  });
});

describe('the date range', () => {
  it('refuses a start after the end, and allows one day', () => {
    expect(datesProblem(t, { from: '2026-10-19', to: '2026-10-01' })).toBe(
      'The start date must be on or before the end date.',
    );
    expect(datesProblem(t, { from: '2026-10-19', to: '2026-10-19' })).toBeNull();
  });

  it('opens on the last 365 days in the reader’s zone', () => {
    expect(lastYear(new Date('2026-10-18T23:30:00Z'), 'Africa/Lagos')).toEqual({
      from: '2025-10-19',
      to: '2026-10-19',
    });
  });
});

describe('an entry', () => {
  it('names support and the System in the client’s words', () => {
    const base = { id: 'x', at: '2026-10-19T09:05:18Z', day: '2026-10-19' };

    expect(entryLine(t, entry(base))).toBe('Folake Adeyemi · Events');
    expect(
      entryLine(
        t,
        entry({ ...base, who: { kind: 'support', name: null, email: null }, type: 'security' }),
      ),
    ).toBe('Soirely support · Sign-in and security');
    expect(entryLine(t, entry({ ...base, who: { kind: 'system', name: null, email: null } }))).toBe(
      'System · Events',
    );
  });

  it('shows when, who with their address, what, on as a link, type and action, reference', () => {
    const rows = detailRows(
      t,
      entry({ id: 'live', at: '2026-10-17T08:12:44Z', day: '2026-10-17' }),
    );

    expect(rows.map((row) => row.key)).toEqual(['when', 'who', 'what', 'on', 'kind', 'reference']);
    expect(rows.find((row) => row.key === 'who')?.value).toBe('Folake Adeyemi · folake@ire.events');
    expect(rows.find((row) => row.key === 'on')).toMatchObject({
      value: 'Ireti at 40',
      eventId: 'evt-ireti',
    });
    expect(rows.find((row) => row.key === 'kind')).toMatchObject({
      label: 'Type and action',
      value: 'Events ·',
      code: 'event.made_live',
    });
  });

  it('says an event no longer exists, with no link', () => {
    const on = detailRows(
      t,
      entry({
        id: 'deleted',
        at: '2026-10-06T09:40:35Z',
        day: '2026-10-06',
        on: { name: 'Bisi & Kola’s engagement', eventId: 'e-bisi', gone: true },
      }),
    ).find((row) => row.key === 'on');

    expect(on?.value).toBe('Bisi & Kola’s engagement · no longer exists');
    expect(on?.eventId).toBeUndefined();
  });

  it('adds changes, network address and device only when present', () => {
    const rows = detailRows(
      t,
      entry({
        id: 'rules',
        at: '2026-10-16T15:48:13Z',
        day: '2026-10-16',
        who: { kind: 'system', name: null, email: null },
        changes: ['Everyone needs two-factor: Off → On'],
        address: '203.0.113.17',
        device: 'Safari on macOS',
      }),
    );

    expect(rows.map((row) => row.key)).toEqual([
      'when',
      'who',
      'what',
      'on',
      'changes',
      'kind',
      'address',
      'device',
      'reference',
    ]);
    expect(rows.find((row) => row.key === 'who')?.value).toBe('System');
  });

  it('hands a phone’s entry page the entry it opened, and only that one', () => {
    const one = entry({ id: 'one', at: '2026-10-19T09:05:18Z', day: '2026-10-19' });
    const two = entry({ id: 'two', at: '2026-10-19T09:05:18Z', day: '2026-10-19' });

    rememberEntry(one);
    expect(rememberedEntry('one')).toBe(one);
    rememberEntry(two);
    expect(rememberedEntry('one')).toBeNull();
    expect(rememberedEntry(undefined)).toBeNull();
  });
});

describe('the page', () => {
  it('is locked off Enterprise, and failed otherwise', () => {
    expect(loadRefused(problem('plan_required', 403))).toBe('locked');
    expect(loadRefused(problem('permission_required', 403))).toBe('failed');
    expect(loadRefused(new Error('offline'))).toBe('failed');
  });

  it('offers Export on both iPad layouts and never on a phone', () => {
    expect(exportsHere('phone')).toBe(false);
    expect(exportsHere('tabletPortrait')).toBe(true);
    expect(exportsHere('tabletLandscape')).toBe(true);
  });

  it('says what the card says on a phone, an iPad, locked and while preparing', () => {
    const at = { organisation: 'Ire Events', locked: false, preparing: null };

    expect(auditCard(t, { ...at, kind: 'phone' })).toEqual({
      says: 'Who did what in Ire Events',
      line: 'Kept for 365 days. Nobody can change or delete an entry.',
      step: null,
    });
    expect(auditCard(t, { ...at, kind: 'tabletPortrait' }).step).toBe('Export these entries');
    expect(auditCard(t, { ...at, locked: true, kind: 'tabletLandscape' })).toEqual({
      says: 'Available on Enterprise',
      line: 'See who did what in Ire Events, for 365 days, and export it.',
      step: null,
    });
    expect(auditCard(t, { ...at, preparing: 'folake@ire.events', kind: 'tabletPortrait' })).toEqual(
      {
        says: 'Preparing your export',
        line: 'We’ll email folake@ire.events a link when it’s ready. It works once, for 24 hours.',
        step: null,
      },
    );
  });

  it('adds the next page after the shown one, once each', () => {
    const a = entry({ id: 'a', at: '2026-10-19T09:05:18Z', day: '2026-10-19' });
    const b = entry({ id: 'b', at: '2026-10-18T09:05:18Z', day: '2026-10-18' });
    const page = {
      organisation: 'Ire Events',
      zone: null,
      entries: [a],
      next: 'cursor-1',
      ...PAGE,
      preparing: null,
    };

    expect(withMore(page, { ...page, entries: [a, b], next: null })).toMatchObject({
      entries: [a, b],
      next: null,
    });
  });
});

describe('exporting', () => {
  it('names the file by today in the reader’s zone', () => {
    const now = new Date('2026-10-18T23:30:00Z');

    expect(auditFileName('csv', now, 'Africa/Lagos')).toBe('audit-log-2026-10-19.csv');
    expect(auditFileName('jsonl', now, null)).toBe('audit-log-2026-10-18.jsonl');
  });

  it('downloads a small export, and prepares a large one for the address given', () => {
    const bytes = new Uint8Array(new ArrayBuffer(2));

    expect(exportAnswered({ kind: 'file', type: 'text/csv', name: null, bytes })).toEqual({
      kind: 'file',
      bytes,
    });
    expect(
      exportAnswered({ kind: 'preparing', count: 25_000, email: 'folake@ire.events' }),
    ).toEqual({ kind: 'preparing', email: 'folake@ire.events' });
  });

  it('shows too many inside the dialog, and any other refusal as a failure', () => {
    expect(exportRefused(problem('audit_export_too_many', 422))).toEqual({ kind: 'tooMany' });
    expect(exportRefused(problem('validation_failed', 422))).toEqual({ kind: 'failed' });
    expect(exportRefused(new Error('offline'))).toEqual({ kind: 'failed' });
  });
});
