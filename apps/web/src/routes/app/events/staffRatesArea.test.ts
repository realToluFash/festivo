import { type StaffHeadline, type StaffRateJob } from '@soirely/api-client';
import i18next from 'i18next';
import { describe, expect, it } from 'vitest';

import '../../../i18n/index.ts';
import {
  changedWords,
  flatLine,
  headlineLine,
  insetWords,
  ownInset,
  ownLines,
  rateProblem,
  sourceLine,
  typedOf,
} from './staffRatesArea.ts';

const t = i18next.getFixedT('en');
const EN = 'en-GB';

function job(fields: Partial<StaffRateJob> = {}): StaffRateJob {
  return {
    id: 'waiter',
    name: 'Waiter',
    rate: { kind: 'hourly', amount: '14.00' },
    changed: null,
    scheduledMinutes: 2160,
    shifts: 2,
    openPlaces: 2,
    people: 4,
    cost: '518.00',
    rateMinutes: 1740,
    fees: 0,
    paidOnce: [],
    keepOwn: ['Kunle Ajayi'],
    ...fields,
  };
}

const HEAD: StaffHeadline = {
  total: '1502.00',
  countedMinutes: 5490,
  scheduledMinutes: 6135,
  unrated: [{ job: { id: 'bar', name: 'Bar' }, minutes: 645 }],
};

describe('Staff rates’ words (sc-101)', () => {
  it('heads the page with the hours counted, scheduled and left out', () => {
    expect(headlineLine(t, HEAD, EN)).toBe(
      'From 91 h 30 min of 102 h 15 min scheduled. Bar’s 10 h 45 min not counted until it has a rate.',
    );
    expect(
      headlineLine(
        t,
        {
          ...HEAD,
          unrated: [{ job: { id: 'runner', name: 'Runner' }, minutes: 840 }, ...HEAD.unrated],
        },
        EN,
      ),
    ).toContain('Runner’s 14 h and Bar’s 10 h 45 min not counted until they have a rate.');
  });

  it('says where a job’s hours come from, and a job with no shifts', () => {
    expect(sourceLine(t, job())).toBe('36 h from 2 shifts · 2 places not filled yet');
    expect(sourceLine(t, job({ shifts: 0, scheduledMinutes: 0 }))).toBe('0 h · No shifts yet');
    expect(
      flatLine(
        t,
        job({
          rate: { kind: 'flat', amount: '120.00' },
          scheduledMinutes: 450,
          openPlaces: 0,
          people: 1,
        }),
      ),
    ).toBe('7 h 30 min from 2 shifts · 1 person');
  });

  it('sums the rate as it is typed, by the hour and as a flat fee', () => {
    expect(insetWords(t, job(), 'hourly', 1500, 'GBP', EN)).toBe(
      '29 h × £15 = £435. Kunle Ajayi keeps their own rate.',
    );
    expect(
      insetWords(
        t,
        job({ fees: 1, paidOnce: ['Tolu Bello'], openPlaces: 0, keepOwn: [] }),
        'flat',
        12000,
        'GBP',
        EN,
      ),
    ).toBe('1 fee × £120 = £120. Tolu Bello works more than one shift and is paid once.');
    expect(
      insetWords(t, job({ fees: 1, openPlaces: 1, keepOwn: [] }), 'flat', 15000, 'GBP', EN),
    ).toBe(
      '1 fee × £150 = £150. A place nobody has taken yet counts as one more fee until somebody takes it.',
    );
    expect(ownInset(t, 420, 'hourly', 1600, 'GBP', EN)).toBe('7 h × £16 = £112.');
  });

  it('checks a rate before sending, and takes 0', () => {
    expect(rateProblem(t, '', 'hourly', 'en', 'GBP')).toBe('Enter the rate an hour.');
    expect(rateProblem(t, ' ', 'flat', 'en', 'GBP')).toBe('Enter the fee for each person.');
    expect(rateProblem(t, '-14', 'hourly', 'en', 'GBP')).toBe(
      'The rate cannot be below 0. Enter 0 or more.',
    );
    expect(rateProblem(t, '14.505', 'hourly', 'en', 'GBP')).toBe(
      'That has too many decimal places for this event’s currency. Enter the rate like 12.50.',
    );
    expect(rateProblem(t, 'fourteen', 'hourly', 'en', 'GBP')).toBe(
      'Enter the rate in numbers only.',
    );
    expect(rateProblem(t, '0', 'hourly', 'en', 'GBP')).toBeNull();
  });

  it('says who set a rate, or what this tab changed it from', () => {
    expect(
      changedWords(
        t,
        { by: 'Julien Moreau', at: '2026-10-16T10:00:00+00:00' },
        undefined,
        'GBP',
        'en-US',
      ),
    ).toBe('Set by Julien Moreau on Friday, Oct 16');
    expect(
      changedWords(
        t,
        null,
        { was: { kind: 'hourly', amount: '14.00' }, removed: false },
        'GBP',
        EN,
      ),
    ).toBe('Changed by you just now. Was £14 an hour.');
  });

  it('writes a rate back to be typed, without pence it does not have', () => {
    expect(typedOf({ kind: 'hourly', amount: '14.00' }, 'en', 'GBP')).toBe('14');
    expect(typedOf({ kind: 'hourly', amount: '12.50' }, 'fr', 'EUR')).toBe('12,50');
    expect(typedOf({ kind: 'flat', amount: '1200' }, 'en', 'JPY')).toBe('1,200');
  });

  it('lists a person on their own rate with no shifts at no hours, so it can still be removed', () => {
    expect(
      ownLines(
        t,
        {
          member: { id: 'kunle', name: 'Kunle Ajayi' },
          job: { id: 'waiter', name: 'Waiter' },
          rate: { kind: 'hourly', amount: '16.00' },
          changed: null,
          minutes: 0,
          cost: '0.00',
        },
        null,
        'GBP',
        EN,
      ),
    ).toEqual(['£16 an hour · Instead of Waiter’s No rate yet', '0 h as Waiter']);
  });
});
