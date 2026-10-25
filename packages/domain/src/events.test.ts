import { describe, expect, it } from 'vitest';

import {
  type EventDraft,
  draftOf,
  eventChanges,
  eventNameLength,
  eventProblems,
  filledEndDate,
} from './events.ts';

const DRAFT: EventDraft = {
  name: 'Adaeze and Tunde',
  startDate: '2026-11-14',
  startTime: '16:00',
  endDate: '2026-11-15',
  endTime: '02:00',
};

describe('the new event form', () => {
  it('accepts a named event that ends after it starts', () => {
    expect(eventProblems(DRAFT)).toEqual([]);
  });

  it('refuses a blank name, spaces included', () => {
    expect(eventProblems({ ...DRAFT, name: '   ' })).toEqual([
      { field: 'name', problem: 'nameBlank' },
    ]);
  });

  it('counts the name after trimming, up to 120 characters', () => {
    expect(eventProblems({ ...DRAFT, name: ` ${'x'.repeat(120)} ` })).toEqual([]);
    expect(eventProblems({ ...DRAFT, name: 'x'.repeat(121) })).toEqual([
      { field: 'name', problem: 'nameTooLong' },
    ]);
    expect(eventNameLength('  Ìrè 🎉  ')).toBe(5);
  });

  it('says which of the start and the end is missing, a date or a time alone included', () => {
    expect(eventProblems({ ...DRAFT, startTime: '' })).toEqual([
      { field: 'startsAt', problem: 'startMissing' },
    ]);
    expect(eventProblems({ ...DRAFT, endDate: '' })).toEqual([
      { field: 'endsAt', problem: 'endMissing' },
    ]);
  });

  it('refuses an end before the start and accepts one equal to it', () => {
    expect(eventProblems({ ...DRAFT, endDate: '2026-11-14', endTime: '15:59' })).toEqual([
      { field: 'endsAt', problem: 'endBeforeStart' },
    ]);
    expect(eventProblems({ ...DRAFT, endDate: '2026-11-14', endTime: '16:00' })).toEqual([]);
  });

  it('lists every problem at once, in the order of the fields', () => {
    expect(
      eventProblems({ name: '', startDate: '', startTime: '', endDate: '', endTime: '' }).map(
        ({ field }) => field,
      ),
    ).toEqual(['name', 'startsAt', 'endsAt']);
  });
});

describe('the end date', () => {
  it('follows the start date until the host chooses one, then keeps it', () => {
    expect(filledEndDate('2026-11-14', '', false)).toBe('2026-11-14');
    expect(filledEndDate('2026-11-14', '0002-11-14', false)).toBe('2026-11-14');
    expect(filledEndDate('2026-11-14', '2026-11-16', true)).toBe('2026-11-16');
  });
});

describe('editing an event (sc-3587)', () => {
  const saved = {
    name: 'Owambe',
    startsAt: '2026-03-28T19:00:00+00:00',
    endsAt: '2026-03-29T19:00:00+01:00',
    timeZone: 'Europe/London',
    currency: 'GBP',
  };

  it('opens with the wall-clock times as saved, whatever their offsets', () => {
    expect(draftOf(saved)).toEqual({
      name: 'Owambe',
      startDate: '2026-03-28',
      startTime: '19:00',
      endDate: '2026-03-29',
      endTime: '19:00',
    });
  });

  it('sends nothing when nothing changed, a trimmed name included', () => {
    const draft = { ...draftOf(saved), name: '  Owambe ' };

    expect(eventChanges(saved, { draft, timeZone: 'Europe/London', currency: 'GBP' })).toEqual({});
  });

  it('sends only what changed, and a new zone alone keeps the times as typed', () => {
    expect(
      eventChanges(saved, { draft: draftOf(saved), timeZone: 'Europe/Paris', currency: 'GBP' }),
    ).toEqual({ timeZone: 'Europe/Paris' });
    expect(
      eventChanges(saved, {
        draft: { ...draftOf(saved), name: 'Owambe at night', endTime: '23:30' },
        timeZone: 'Europe/London',
        currency: 'EUR',
      }),
    ).toEqual({ name: 'Owambe at night', endsAt: '2026-03-29T23:30', currency: 'EUR' });
  });
});
