import { describe, expect, it } from 'vitest';

import {
  headlineLine,
  headlineOf,
  insetWords,
  jobCost,
  rateProblem,
  ratesSample,
  sourceLine,
  flatLine,
  whoCanHaveOwn,
} from './staffRates.ts';

describe('Staff rates (sc-101)', () => {
  it('adds each job’s cost into one headline, and says which hours are not counted', () => {
    const sample = ratesSample();
    const head = headlineOf(sample);

    expect(head.total).toBe(150200);
    expect(headlineLine(sample, head)).toBe(
      'From 91 h 30 min of 102 h 15 min scheduled. Bar’s 10 h 45 min not counted until it has a rate.',
    );
    expect(headlineLine(ratesSample('staff_rates_no_rate'))).toBe(
      'From 77 h 30 min of 102 h 15 min scheduled. Runner’s 14 h and Bar’s 10 h 45 min not counted until they have a rate.',
    );
  });

  it('counts an hourly job by each place, a person on their own rate at theirs', () => {
    const sample = ratesSample();

    expect(jobCost(sample, 'waiter', sample.rates.waiter ?? null)).toBe(51800);
    expect(sourceLine(sample, 'waiter')).toBe('36 h from 2 shifts · 2 places not filled yet');
    expect(insetWords(sample, 'waiter', { kind: 'hourly', minor: 1500 })).toBe(
      '29 h × £15 = £435. Kunle Ajayi keeps their own rate.',
    );
  });

  it('pays a flat fee once for each person, however many shifts, and once for each open place', () => {
    const sample = ratesSample();

    expect(jobCost(sample, 'door', sample.rates.door ?? null)).toBe(12000);
    expect(flatLine(sample, 'door')).toBe('7 h 30 min from 2 shifts · 1 person');
    expect(insetWords(sample, 'door', { kind: 'flat', minor: 12000 })).toBe(
      '1 fee × £120 = £120. Tolu Bello works more than one shift and is paid once.',
    );
    expect(insetWords(sample, 'mc', { kind: 'flat', minor: 15000 })).toBe(
      '1 fee × £150 = £150. A place nobody has taken yet counts as one more fee until somebody takes it.',
    );
  });

  it('keeps a job’s rate with no shifts, at 0 h', () => {
    const sample = ratesSample();

    expect(jobCost(sample, 'security', sample.rates.security ?? null)).toBe(0);
    expect(sourceLine(sample, 'security')).toBe('0 h · No shifts yet');
  });

  it('checks a rate before sending, and takes 0', () => {
    expect(rateProblem('', 'hourly')).toBe('Enter the rate an hour.');
    expect(rateProblem(' ', 'flat')).toBe('Enter the fee for each person.');
    expect(rateProblem('-14', 'hourly')).toBe('The rate cannot be below 0. Enter 0 or more.');
    expect(rateProblem('14.505', 'hourly')).toBe(
      'That has too many decimal places for this event’s currency. Enter the rate like 12.50.',
    );
    expect(rateProblem('0', 'hourly')).toBeNull();
  });

  it('offers an own rate to people on this event’s shifts only, not one already on theirs', () => {
    const who = whoCanHaveOwn(ratesSample()).map((one) => one.words);

    expect(who).toContain('Amina Yusuf · Waiter');
    expect(who).not.toContain('Kunle Ajayi · Waiter');
    expect(who.some((one) => one.startsWith('Chinedu Eze'))).toBe(false);
  });
});
