import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  type EventDraft,
  draftOf,
  eventChanges,
  eventNameLength,
  eventProblems,
  filledEndDate,
  savedWallClock,
  skippedTime,
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
    expect(eventProblems(DRAFT, '')).toEqual([]);
  });

  it('refuses a blank name, spaces included', () => {
    expect(eventProblems({ ...DRAFT, name: '   ' }, '')).toEqual([
      { field: 'name', problem: 'nameBlank' },
    ]);
  });

  it('counts the name after trimming, up to 120 characters', () => {
    expect(eventProblems({ ...DRAFT, name: ` ${'x'.repeat(120)} ` }, '')).toEqual([]);
    expect(eventProblems({ ...DRAFT, name: 'x'.repeat(121) }, '')).toEqual([
      { field: 'name', problem: 'nameTooLong' },
    ]);
    expect(eventNameLength('  Ìrè 🎉  ')).toBe(5);
  });

  it('says which of the start and the end is missing, a date or a time alone included', () => {
    expect(eventProblems({ ...DRAFT, startTime: '' }, '')).toEqual([
      { field: 'startsAt', problem: 'startMissing' },
    ]);
    expect(eventProblems({ ...DRAFT, endDate: '' }, '')).toEqual([
      { field: 'endsAt', problem: 'endMissing' },
    ]);
  });

  it('refuses an end before the start and accepts one equal to it', () => {
    expect(eventProblems({ ...DRAFT, endDate: '2026-11-14', endTime: '15:59' }, '')).toEqual([
      { field: 'endsAt', problem: 'endBeforeStart' },
    ]);
    expect(eventProblems({ ...DRAFT, endDate: '2026-11-14', endTime: '16:00' }, '')).toEqual([]);
  });

  it('lists every problem at once, in the order of the fields', () => {
    expect(
      eventProblems({ name: '', startDate: '', startTime: '', endDate: '', endTime: '' }, '').map(
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

describe('a time the clocks skip (sc-10638)', () => {
  const PARIS = 'Europe/Paris';

  it('names the time a skipped start is saved as, later by the gap', () => {
    expect(skippedTime('2027-03-28', '02:00', PARIS)).toEqual({ savedAs: '2027-03-28T03:00' });
    expect(skippedTime('2027-03-28', '02:30', PARIS)).toEqual({ savedAs: '2027-03-28T03:30' });
    expect(skippedTime('2027-03-28', '02:59', PARIS)).toEqual({ savedAs: '2027-03-28T03:59' });
  });

  it('moves by a gap that is not an hour long', () => {
    expect(skippedTime('2027-10-03', '02:15', 'Australia/Lord_Howe')).toEqual({
      savedAs: '2027-10-03T02:45',
    });
  });

  it('names the next day when the gap carries the time past midnight', () => {
    expect(skippedTime('2027-03-27', '23:30', 'America/Scoresbysund')).toEqual({
      savedAs: '2027-03-28T00:30',
    });
  });

  it("names the time the API's LocalTimeResolver saves", () => {
    const table: Record<string, { zone: string; typed: string; saved: string }> = JSON.parse(
      readFileSync(
        new URL(
          '../../../services/api/tests/Fixtures/LocalTime/wall-clock-times.json',
          import.meta.url,
        ),
        'utf8',
      ),
    );

    for (const [name, { zone, typed, saved }] of Object.entries(table)) {
      const [date, time] = [typed.slice(0, 10), typed.slice(11)];
      const wallClock = saved.slice(0, 16);

      expect(savedWallClock(date, time, zone), name).toBe(wallClock);
      expect(skippedTime(date, time, zone), name).toEqual(
        wallClock === typed ? null : { savedAs: wallClock },
      );
    }
  });

  it('says nothing either side of the gap', () => {
    expect(skippedTime('2027-03-28', '01:59', PARIS)).toBeNull();
    expect(skippedTime('2027-03-28', '03:00', PARIS)).toBeNull();
    expect(skippedTime('2027-03-27', '02:30', PARIS)).toBeNull();
  });

  it('says nothing in the hour the clocks repeat, which is saved as typed', () => {
    expect(skippedTime('2027-10-31', '02:30', PARIS)).toBeNull();
    expect(savedWallClock('2027-10-31', '02:30', PARIS)).toBe('2027-10-31T02:30');
  });

  it('says nothing without a zone, a date or a time', () => {
    expect(skippedTime('2027-03-28', '02:30', '')).toBeNull();
    expect(skippedTime('', '02:30', PARIS)).toBeNull();
    expect(skippedTime('2027-03-28', '', PARIS)).toBeNull();
    expect(skippedTime('2027-03-28', '02:30', 'Not/AZone')).toBeNull();
  });

  it('refuses a start the gap moves past the end', () => {
    const draft = {
      ...DRAFT,
      startDate: '2027-03-28',
      startTime: '02:30',
      endDate: '2027-03-28',
      endTime: '03:15',
    };

    expect(eventProblems(draft, PARIS)).toEqual([{ field: 'endsAt', problem: 'endBeforeStart' }]);
    expect(eventProblems(draft, 'Africa/Lagos')).toEqual([]);
  });
});
