import { describe, expect, it } from 'vitest';

import {
  AUDIT_STATES,
  TYPES,
  TYPE_WORDS,
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
const LAGOS = 'Africa/Lagos';
const entry = (id: string) => {
  const found = ENTRIES.find((one) => one.id === id);
  if (found == null) throw new Error(id);

  return found;
};
const facts = (id: string) =>
  Object.fromEntries(factsOf(entry(id), LOCALE, LAGOS).map((fact) => [fact.label, fact.value]));

describe('Audit log (sc-611)', () => {
  it('lists the entries by day, newest first, today’s day saying so', () => {
    expect(byDay(ENTRIES, LOCALE, LAGOS).map((day) => [day.heading, day.entries.length])).toEqual([
      ['Today · Monday, Oct 19', 3],
      ['Sunday, Oct 18', 7],
      ['Saturday, Oct 17', 2],
      ['Friday, Oct 16', 4],
      ['Tuesday, Oct 6', 2],
    ]);
    expect(timeOf(entry('download'), LOCALE, LAGOS)).toBe('10:05');
    expect(timeOf(entry('invited'), LOCALE, LAGOS)).toBe('18:05');
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
    expect(downloading('JSON Lines')).toBe('Downloading the audit log as JSON Lines.');
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
    expect(factsOf(entry('live'), LOCALE, LAGOS).find((fact) => fact.label === 'On')?.link).toBe(
      '/demo/events/evt-ireti-2',
    );
    expect(facts('deleted').On).toBe('Bisi & Kola’s engagement · no longer exists');
    expect(factsOf(entry('deleted'), LOCALE, LAGOS).find((fact) => fact.label === 'On')?.link).toBe(
      undefined,
    );
    expect(facts('signIn')).toMatchObject({
      On: 'Ire Events’s sign-in rules',
      Changes: 'Everyone needs two-factor: Off → On',
      'Type and action': 'Sign-in and security · sign_in_rules.changed',
      'Network address': '203.0.113.17',
      Device: 'Safari on macOS',
    });
    expect(facts('domainAdded')['Network address']).toBe('203.0.113.17');
    expect(facts('domainAdded').Device).toBeUndefined();
    expect(facts('proved').Who).toBe('System');
    expect(facts('proved')['Network address']).toBeUndefined();
  });

  it('opens each state as the boards draw it', () => {
    expect(auditStart('filtered').filters.type).toBe('Sign-in and security');
    expect(auditStart('date_invalid').dates).toEqual({ from: '2026-10-19', to: '2026-10-01' });
    expect(auditStart('detail_gone').detail).toBe('deleted');
    expect(auditStart('export_small').told).toBe('Downloading the audit log as CSV.');
    expect(auditStart('export_too_many').exporting).toBe('tooMany');
    expect(auditStart('nope')).toMatchObject({ detail: null, menu: null, locked: false });
  });

  it('offers the twelve types in the AC’s order (sc-71986)', () => {
    expect(TYPES).toEqual([
      'Events',
      'Event access',
      'Guests',
      'Menu',
      'Seating',
      'Schedule',
      'Staff',
      'Budget',
      'Members and invitations',
      'Sign-in and security',
      'Organisation',
      'Audit log',
    ]);
    expect([TYPE_WORDS.fr.Seating, TYPE_WORDS.fr.Staff, TYPE_WORDS.es.Seating]).toEqual([
      'Plan de table',
      'Équipe',
      'Mesas',
    ]);
    expect(auditStart('filter_type_fr')).toMatchObject({ menu: 'type', lang: 'fr' });
  });

  it('files each new entry under its type, by its code (sc-71986)', () => {
    const ids = (type: (typeof TYPES)[number]) =>
      matching(ENTRIES, { ...NO_FILTERS, type }).map((one) => one.id);

    expect(ids('Guests')).toEqual(['guestRemoved', 'guestGone']);
    expect(ids('Schedule')).toEqual(['skipped']);
    expect(ids('Staff')).toEqual(['floorLead']);
    expect(ids('Seating')).toEqual(['seatMoved']);
    expect(ids('Menu')).toEqual(['dish']);
    expect(ids('Budget')).toEqual(['budgetLine']);
    expect(ids('Events')).toEqual(['live', 'deleted']);
    for (const entry of ENTRIES) expect(TYPES).toContain(entry.type);
  });

  it('shows no organisation’s dish with an event picked', () => {
    const wedding = matching(ENTRIES, { ...NO_FILTERS, event: 'Adaeze & Tunde’s wedding' });

    expect(wedding.map((one) => one.id)).not.toContain('dish');
    expect(wedding.map((one) => one.id)).toContain('guestRemoved');
    expect(matching(ENTRIES, { ...NO_FILTERS, type: 'Menu', event: 'Ireti at 40' })).toEqual([]);
  });

  it('says a guest, never the name, once the guest is gone', () => {
    expect(facts('guestRemoved')).toMatchObject({
      What: 'Removed a guest',
      On: 'Adaeze & Tunde’s wedding · Guests',
      'Type and action': 'Guests · guest.removed',
    });
    expect(facts('guestGone')).toMatchObject({
      What: 'Changed a guest’s needs',
      On: 'A guest · no longer exists',
    });
    expect(
      factsOf(entry('guestGone'), LOCALE, LAGOS).find((fact) => fact.label === 'On')?.link,
    ).toBeUndefined();
    const guests = ENTRIES.filter((one) => one.type === 'Guests');
    for (const one of guests) expect(one.what).not.toMatch(/Emeka|Nwosu/u);
  });

  it('links an entry to its event’s section, its guest or its dish, and no device on any', () => {
    const link = (id: string) =>
      factsOf(entry(id), LOCALE, LAGOS).find((fact) => fact.label === 'On')?.link;

    expect(link('skipped')).toBe('/demo/events/evt-wed-4/schedule');
    expect(link('floorLead')).toBe('/demo/events/evt-wed-4/staff');
    expect(link('guestRemoved')).toBe('/demo/guests');
    expect(link('seatMoved')).toBe('/demo/guests');
    expect(link('dish')).toBe('/demo/menu-library');
    expect(facts('skipped')['Type and action']).toBe('Schedule · run_of_show.item_skipped');
    expect(facts('dish').On).toBe('Jollof rice');
    for (const one of ENTRIES.filter((each) => each.type !== 'Sign-in and security')) {
      expect(one.address).toBeUndefined();
      expect(one.device).toBeUndefined();
    }
    expect(
      factsOf(entry('skipped'), LOCALE, LAGOS, 'fr').find(
        (fact) => fact.label === 'Type and action',
      )?.value,
    ).toBe('Programme · run_of_show.item_skipped');
  });

  it('links every state from the demo’s home', () => {
    const linked = DATA_CONTROL_PAGES.flatMap((one) => one.states.map((state) => state.to));

    for (const state of AUDIT_STATES)
      expect(linked).toContain(`/demo/settings/data-and-control/audit-log?state=${state}`);
  });
});
