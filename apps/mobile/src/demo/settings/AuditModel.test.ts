import { describe, expect, it } from 'vitest';

import {
  auditStart,
  auditStateOf,
  AUDIT_STATES,
  buttonWords,
  byDay,
  datesProblem,
  detailRows,
  entryLine,
  entryOf,
  exportAnswer,
  filtered,
  matching,
  menuChoices,
  NO_FILTERS,
  SAMPLE_RANGE,
} from './AuditModel.ts';
import { ENTRIES } from './AuditSample.ts';
import { DATA_BOARDS } from './DataBoards.ts';
import { dataHref } from './DataModel.ts';
import { dataSayIn } from './DataSample.ts';

const say = dataSayIn('en-US');
const detail = (state: Parameters<typeof auditStart>[0]) => {
  const entry = entryOf(auditStart(state).open);
  if (entry == null) throw new Error(`${state} opens an entry.`);

  return Object.fromEntries(
    detailRows(entry, say).map((row) => [
      row.label,
      [row.codeOnly === true ? '' : row.value, row.code ?? ''].filter(Boolean).join(' '),
    ]),
  );
};

describe('the audit log’s states (sc-611)', () => {
  it('opens a state it names, the list for anything else, and the list for Export on the phone', () => {
    expect(auditStateOf('filtered', false)).toBe('filtered');
    expect(auditStateOf('nonsense', false)).toBe('list');
    expect(auditStateOf('export', false)).toBe('export');
    for (const state of ['export', 'export_small', 'export_preparing', 'export_too_many'])
      expect(auditStateOf(state, true)).toBe('list');
    expect(auditStateOf('locked', true)).toBe('locked');
  });

  it('links every state from the demo’s home', () => {
    const hrefs = DATA_BOARDS.map(({ href }) => href);
    for (const state of AUDIT_STATES.filter((one) => one !== 'list'))
      expect(hrefs).toContain(dataHref('auditLog', { state }));
  });

  it('lists the entries by day, newest first, today named', () => {
    const days = byDay(matching(NO_FILTERS), say);

    expect(days.map(({ heading, entries }) => [heading, entries.length])).toEqual([
      ['Today · Monday, Oct 19', 3],
      ['Saturday, Oct 17', 2],
      ['Friday, Oct 16', 4],
      ['Tuesday, Oct 6', 2],
    ]);
    expect(
      days[0]?.entries.map((entry) => [say.time(entry.at), entry.what, entryLine(entry)]),
    ).toEqual([
      ['10:05', 'Downloaded Ire Events’ data', 'Folake Adeyemi · Organisation'],
      ['09:30', 'Asked for an export of Ire Events’ data', 'Folake Adeyemi · Organisation'],
      [
        '08:15',
        'Added Tom Becker to Adaeze & Tunde’s wedding as Can check guests in',
        'Priya Shah · Event access',
      ],
    ]);
    expect(days[3]?.entries.map((entry) => entryLine(entry))).toEqual([
      'System · Sign-in and security',
      'Julien Moreau · Events',
    ]);
  });

  it('reads Anyone, All types, All events and Last 365 days at rest', () => {
    expect(buttonWords(NO_FILTERS, 'en-US')).toEqual({
      person: 'Anyone',
      type: 'All types',
      event: 'All events',
      dates: 'Last 365 days',
    });
    expect(filtered(NO_FILTERS)).toBe(false);
  });

  it('offers each menu’s choices, Marta Silva marked as left and the six types exactly', () => {
    expect(menuChoices('person').map(({ word }) => word)).toEqual([
      'Anyone',
      'Folake Adeyemi',
      'Julien Moreau',
      'Priya Shah',
      'Ana Souza',
      'Tom Becker',
      'Marta Silva · left',
    ]);
    expect(menuChoices('type').map(({ word }) => word)).toEqual([
      'All types',
      'Events',
      'Event access',
      'Members and invitations',
      'Sign-in and security',
      'Organisation',
      'Audit log',
    ]);
    expect(menuChoices('event')[0]).toEqual({ value: null, word: 'All events' });
    expect(auditStart('filter_person').menu).toBe('person');
    expect(auditStart('filter_type').menu).toBe('type');
    expect(auditStart('filter_event').menu).toBe('event');
  });

  it('filters to Sign-in and security’s three, with Clear filters', () => {
    const { filters } = auditStart('filtered');

    expect(buttonWords(filters, 'en-US').type).toBe('Sign-in and security');
    expect(filtered(filters)).toBe(true);
    expect(matching(filters).map(({ what }) => what)).toEqual([
      'Changed the sign-in rules: everyone needs two-factor',
      'Added ireevents.com to Email domains',
      'Proved ire.events',
    ]);
  });

  it('finds nothing for Ana Souza and Events', () => {
    expect(matching(auditStart('empty_filter').filters)).toEqual([]);
  });

  it('opens the dates from Oct 1 to Oct 19, and refuses them the wrong way round at once', () => {
    expect(auditStart('dates').dates).toEqual(SAMPLE_RANGE);
    expect(datesProblem(SAMPLE_RANGE)).toBeNull();
    expect(datesProblem(auditStart('date_invalid').dates ?? SAMPLE_RANGE)).toBe(
      'The start date must be on or before the end date.',
    );
    const range = { from: '2026-10-16', to: '2026-10-17' };
    expect(matching({ ...NO_FILTERS, range })).toHaveLength(6);
    expect(buttonWords({ ...NO_FILTERS, range }, 'en-US').dates).toBe('Oct 16 to Oct 17');
  });

  it('writes Made Ireti at 40 live as the spec has it', () => {
    expect(detail('detail')).toEqual({
      When: 'Saturday, Oct 17, 2026 at 09:12:44 WAT',
      Who: 'Folake Adeyemi · folake@ire.events',
      What: 'Made Ireti at 40 live',
      On: 'Ireti at 40',
      Changes: 'Live: Off → On',
      'Type and action': 'Events · event.made_live',
      Reference: 'c41e9a7b-2f6d-4b1e-9a53-7d0e6c2b8f14',
    });
    const on = detailRows(entryOf('live') ?? ENTRIES[0]!, say).find(({ label }) => label === 'On');
    expect(on?.eventId).toBe('evt-ireti-2');
  });

  it('says an event that is gone, with no link', () => {
    expect(detail('detail_gone').On).toBe('Bisi & Kola’s engagement · no longer exists');
    const on = detailRows(entryOf('deleted') ?? ENTRIES[0]!, say).find(
      ({ label }) => label === 'On',
    );
    expect(on?.eventId).toBeUndefined();
  });

  it('records the network address and device on sign-in and security, none before or by System', () => {
    expect(detail('detail_signin')).toMatchObject({
      On: 'Ire Events’ sign-in rules',
      Changes: 'Everyone needs two-factor: Off → On',
      'Type and action': 'Sign-in and security · sign_in_rules.changed',
      'Network address': '203.0.113.17',
      Device: 'Safari on macOS',
    });
    expect(detail('detail_old')).toMatchObject({ 'Network address': '203.0.113.17' });
    expect(detail('detail_old')).not.toHaveProperty('Device');
    expect(detail('detail_system')).toMatchObject({ Who: 'System' });
    expect(detail('detail_system')).not.toHaveProperty('Network address');
    expect(detail('detail_system')).not.toHaveProperty('Device');
  });

  it('exports on the iPad by how many match: a download, prepared and emailed, or refused', () => {
    expect(auditStart('export').exporting).toEqual({ format: 'csv', refused: false });
    expect(auditStart('export_small').toast).toBe('Downloading the audit log as CSV.');
    expect(auditStart('export_preparing')).toMatchObject({ preparing: true });
    expect(auditStart('export_too_many').exporting).toEqual({ format: 'csv', refused: true });
    expect(exportAnswer('small')).toBe('download');
    expect(exportAnswer('large')).toBe('prepare');
    expect(exportAnswer('tooMany')).toBe('refuse');
  });

  it('locks on the free plan, and loads and fails as a page', () => {
    expect(auditStart('locked').locked).toBe(true);
    expect(auditStart('loading').load).toBe('loading');
    expect(auditStart('failed').load).toBe('failed');
  });
});
