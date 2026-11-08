import { describe, expect, it } from 'vitest';

import {
  AUDIT_STATES,
  ENTRIES,
  NO_FILTERS,
  auditStart,
  byDay,
  datesFault,
  downloading,
  exportOutcome,
  factsOf,
  matching,
  rangeWords,
  timeOf,
} from './auditLog.ts';
import { DATA_CONTROL_PAGES } from './dataControlPages.ts';

const LOCALE = 'en-US';
const entry = (id: string) => {
  const found = ENTRIES.find((one) => one.id === id);
  if (found == null) throw new Error(id);

  return found;
};
const facts = (id: string) =>
  Object.fromEntries(factsOf(entry(id), LOCALE).map((fact) => [fact.label, fact.value]));

describe('Audit log (sc-611)', () => {
  it('lists the entries by day, newest first, today’s day saying so', () => {
    expect(byDay(ENTRIES, LOCALE).map((day) => [day.heading, day.entries.length])).toEqual([
      ['Today · Monday, Oct 19', 3],
      ['Saturday, Oct 17', 2],
      ['Friday, Oct 16', 4],
      ['Tuesday, Oct 6', 2],
    ]);
    expect(timeOf(entry('download'), LOCALE)).toBe('10:05');
    expect(timeOf(entry('invited'), LOCALE)).toBe('18:05');
  });

  it('filters by person, type, event and dates, together', () => {
    const signIn = matching(ENTRIES, { ...NO_FILTERS, type: 'Sign-in and security' });

    expect(signIn.map((one) => one.id)).toEqual(['signIn', 'domainAdded', 'proved']);
    expect(matching(ENTRIES, auditStart('empty_filter').filters)).toEqual([]);
    expect(matching(ENTRIES, { ...NO_FILTERS, event: 'Ireti at 40' }).map((one) => one.id)).toEqual(
      ['live'],
    );
    expect(matching(ENTRIES, { ...NO_FILTERS, from: '2026-10-17', to: '2026-10-17' }).length).toBe(
      2,
    );
    expect(matching(ENTRIES, { ...NO_FILTERS, person: 'Marta Silva' })).toEqual([]);
  });

  it('catches a range the wrong way round at once', () => {
    expect(datesFault('2026-10-19', '2026-10-01')).toBe(
      'The start date must be on or before the end date.',
    );
    expect(datesFault('2026-10-01', '2026-10-19')).toBeNull();
    expect(datesFault('', '2026-10-01')).toBeNull();
    expect(rangeWords(NO_FILTERS, LOCALE)).toBe('Last 365 days');
    expect(rangeWords({ from: '2026-10-01', to: '2026-10-19' }, LOCALE)).toBe('Oct 1 to Oct 19');
  });

  it('downloads up to 10,000, prepares up to a million, and starts nothing past it', () => {
    expect(exportOutcome(10_000)).toBe('download');
    expect(exportOutcome(10_001)).toBe('prepare');
    expect(exportOutcome(1_000_000)).toBe('prepare');
    expect(exportOutcome(1_000_001)).toBe('tooMany');
    expect(downloading('JSON Lines')).toBe('Downloading Ire Events’ audit log as JSON Lines.');
  });

  it('shows an entry with what it records, and only that', () => {
    expect(facts('live')).toEqual({
      When: 'Saturday, Oct 17, 2026 at 09:12:44 WAT',
      Who: 'Folake Adeyemi · folake@ire.events',
      What: 'Made Ireti at 40 live',
      On: 'Ireti at 40',
      Changes: 'Live: Off → On',
      'Type and action': 'Events · event.made_live',
      Reference: 'c41e9a7b-2f6d-4b1e-9a53-7d0e6c2b8f14',
    });
    expect(factsOf(entry('live'), LOCALE).find((fact) => fact.label === 'On')?.link).toBe(
      '/demo/events/evt-ireti-2',
    );
    expect(facts('deleted').On).toBe('Bisi & Kola’s engagement · no longer exists');
    expect(factsOf(entry('deleted'), LOCALE).find((fact) => fact.label === 'On')?.link).toBe(
      undefined,
    );
    expect(facts('signIn')).toMatchObject({
      On: 'Ire Events’ sign-in rules',
      Changes: 'Everyone needs two-factor: Off → On',
      'Type and action': 'Sign-in and security · sign_in_rules.changed',
      'Network address': '102.89.34.17',
      Device: 'Safari on macOS',
    });
    expect(facts('domainAdded')['Network address']).toBe('102.89.34.17');
    expect(facts('domainAdded').Device).toBeUndefined();
    expect(facts('proved').Who).toBe('System');
    expect(facts('proved')['Network address']).toBeUndefined();
  });

  it('opens each state as the boards draw it', () => {
    expect(auditStart('filtered').filters.type).toBe('Sign-in and security');
    expect(auditStart('date_invalid').dates).toEqual({ from: '2026-10-19', to: '2026-10-01' });
    expect(auditStart('detail_gone').detail).toBe('deleted');
    expect(auditStart('export_small').told).toBe('Downloading Ire Events’ audit log as CSV.');
    expect(auditStart('export_too_many').exporting).toBe('tooMany');
    expect(auditStart('nope')).toMatchObject({ detail: null, menu: null, locked: false });
  });

  it('links every state from the demo’s home', () => {
    const linked = DATA_CONTROL_PAGES.flatMap((one) => one.states.map((state) => state.to));

    for (const state of AUDIT_STATES)
      expect(linked).toContain(`/demo/settings/data-and-control/audit-log?state=${state}`);
  });
});
