import { describe, expect, it } from 'vitest';

import {
  CATALOGUE,
  ENTERPRISE_METER,
  FREE_METER,
  TALK_WINDOW_MS,
  answerTalk,
  catalogueOf,
  changesFor,
  limitCell,
  priceLines,
  seesPlans,
  stepOf,
  yearlyDue,
} from './comparePlans.ts';

describe('Compare plans › the catalogue and what changes (sc-3935)', () => {
  it('offers Talk to us on a contract plan and Upgrade only on a self-serve one', () => {
    expect(stepOf(catalogueOf(false).enterprise, 'free')).toBe('talk');
    expect(stepOf(catalogueOf(true).enterprise, 'free')).toBe('upgrade');
    expect(stepOf(CATALOGUE.free, 'enterprise')).toBe('downgrade');
    expect(stepOf(CATALOGUE.free, 'free')).toBe('current');
  });

  it('reads Enterprise as sold by contract with or without its From line, in the account’s currency', () => {
    expect(priceLines(catalogueOf(false).enterprise, 'GBP', 'en-GB', 'en')).toEqual({
      main: 'From £199 a month',
      under: 'Sold by contract',
    });
    expect(priceLines(catalogueOf(false, false).enterprise, 'USD', 'en-US', 'en')).toEqual({
      main: 'Sold by contract',
      under: null,
    });
    expect(priceLines(catalogueOf(true).enterprise, 'EUR', 'en-GB', 'en').under).toBe(
      'or €2,290 a year',
    );
  });

  it('writes Unlimited as a word, never a number', () => {
    expect(limitCell(CATALOGUE.enterprise, 'liveEvents', 'en-US', 'en')).toBe('Unlimited');
    expect(limitCell(CATALOGUE.enterprise, 'seats', 'fr-FR', 'fr')).toBe('Illimité');
    expect(limitCell(CATALOGUE.free, 'storageGb', 'en-US', 'en')).toBe('2 GB');
  });

  it('says nothing changes under the plan the organisation is on', () => {
    expect(changesFor(CATALOGUE.free, CATALOGUE.free, FREE_METER, 'en-US', 'en')).toEqual([
      'Nothing. This is the plan Ire Events is on.',
    ]);
  });

  it('names a downgrade’s effects in the organisation’s numbers, and deletes nothing', () => {
    const lines = changesFor(CATALOGUE.free, CATALOGUE.enterprise, ENTERPRISE_METER, 'en-US', 'en');
    expect(lines[0]).toMatch(/^You have 7 live events; this plan allows 2\./u);
    expect(lines[1]).toBe(
      '3 of your events have more than 100 people. They keep every guest; you can’t add more to them.',
    );
    expect(lines).toContain(
      'These Enterprise settings switch off and keep their values: Email domains.',
    );
  });

  it('gives the people line only when an event is over 100', () => {
    const lines = changesFor(
      CATALOGUE.free,
      CATALOGUE.enterprise,
      { ...ENTERPRISE_METER, overPeople: 0 },
      'en-US',
      'en',
    );
    expect(lines.join(' ')).not.toMatch(/more than 100 people/u);
  });

  it('sends one Talk to us in 24 hours and gives the first one’s time to a repeat', () => {
    const first = 1_000_000;
    expect(answerTalk(null, first)).toEqual({ sent: first });
    expect(answerTalk(first, first + 60_000)).toEqual({ already: first });
    expect(answerTalk(first, first + TALK_WINDOW_MS)).toEqual({ sent: first + TALK_WINDOW_MS });
  });

  it('prices a switch to yearly as the year less what is left of the month', () => {
    expect(yearlyDue(CATALOGUE.enterprise, 'USD', '2026-12-02')).toBe(2456.8);
    expect(yearlyDue(CATALOGUE.enterprise, 'USD', '2026-12-28')).toBe(2241);
  });

  it('gives See plans to billing.manage alone', () => {
    expect(seesPlans(null, null)).toBe(true);
    expect(seesPlans('julien', null)).toBe(false);
    expect(seesPlans(null, 'lead')).toBe(false);
  });
});
