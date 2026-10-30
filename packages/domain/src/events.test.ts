import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  EVENT_TYPES,
  type EventDraft,
  clockMinutes,
  copiedEnd,
  draftLength,
  draftOf,
  type VenueDraft,
  eventChanges,
  eventFormProblems,
  eventNameLength,
  eventProblems,
  filledEndDate,
  isEventType,
  venueDraftOf,
  venueProblems,
  venueSent,
  savedWallClock,
  scheduleKept,
  startMoved,
  skippedTime,
} from './events.ts';

const DRAFT: EventDraft = {
  name: 'Adaeze and Tunde',
  type: 'wedding',
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

  it('refuses a new event with no type chosen (sc-3588)', () => {
    expect(eventProblems({ ...DRAFT, type: '' }, '')).toEqual([
      { field: 'type', problem: 'typeMissing' },
    ]);
  });

  it('lists every problem at once, in the order of the fields', () => {
    expect(
      eventProblems(
        { name: '', type: '', startDate: '', startTime: '', endDate: '', endTime: '' },
        '',
      ).map(({ field }) => field),
    ).toEqual(['name', 'type', 'startsAt', 'endsAt']);
  });
});

describe('the whole form, as both clients check it (sc-3595)', () => {
  const venue: VenueDraft = { name: '', address: '', addressId: null };

  it('passes a filled form', () => {
    expect(
      eventFormProblems({ draft: DRAFT, venue, timeZone: 'Africa/Lagos', currency: 'NGN' }),
    ).toEqual([]);
  });

  it('names every refused field once, in the order the form shows them', () => {
    expect(
      eventFormProblems({
        draft: { ...DRAFT, name: ' ', type: '', endDate: '2026-11-13' },
        venue: { ...venue, address: 'a'.repeat(301) },
        timeZone: 'Africa/Lagos',
        currency: '',
      }),
    ).toEqual([
      { field: 'name', problem: 'nameBlank' },
      { field: 'type', problem: 'typeMissing' },
      { field: 'endsAt', problem: 'endBeforeStart' },
      { field: 'venueAddress', problem: 'venueAddressTooLong' },
      { field: 'currency', problem: 'currencyBlank' },
    ]);
  });
});

describe('the end date', () => {
  it('follows the start date until the host chooses one, then keeps it', () => {
    expect(filledEndDate('2026-11-14', '', false)).toBe('2026-11-14');
    expect(filledEndDate('2026-11-14', '0002-11-14', false)).toBe('2026-11-14');
    expect(filledEndDate('2026-11-14', '2026-11-16', true)).toBe('2026-11-16');
  });
});

describe('a start that moves the end with it (sc-22144)', () => {
  const MADRID = 'Europe/Madrid';
  const night: EventDraft = {
    ...DRAFT,
    startDate: '2027-07-17',
    startTime: '20:00',
    endDate: '2027-07-18',
    endTime: '08:00',
  };
  const endOf = (draft: EventDraft) => `${draft.endDate}T${draft.endTime}`;

  it('keeps the length when the start time moves', () => {
    expect(endOf(startMoved(night, { startTime: '21:00' }, true, MADRID))).toBe('2027-07-18T09:00');
  });

  it('keeps the length on the clock across the night the clocks go forward', () => {
    const moved = startMoved(night, { startDate: '2027-03-27' }, true, MADRID);

    expect(endOf(moved)).toBe('2027-03-28T08:00');
    expect(savedWallClock(moved.endDate, moved.endTime, 'Europe/Madrid')).toBe('2027-03-28T08:00');
  });

  it('keeps the length on the clock across the night the clocks go back', () => {
    expect(endOf(startMoved(night, { startDate: '2027-10-30' }, true, MADRID))).toBe(
      '2027-10-31T08:00',
    );
  });

  it('ends a carried end in a skipped hour where it will be saved', () => {
    const skipped = startMoved(
      night,
      { startDate: '2027-03-27', startTime: '14:30' },
      true,
      MADRID,
    );
    const repeated = startMoved(
      night,
      { startDate: '2027-10-30', startTime: '14:30' },
      true,
      MADRID,
    );

    expect(endOf(skipped)).toBe('2027-03-28T03:30');
    expect(endOf(repeated)).toBe('2027-10-31T02:30');
  });

  it('keeps the length after a start the clocks skip, as a copy does', () => {
    const moved = startMoved(night, { startDate: '2027-03-28', startTime: '02:30' }, true, MADRID);

    expect(endOf(moved)).toBe('2027-03-28T15:30');
    expect(
      copiedEnd('2027-03-28', '02:30', MADRID, {
        startsAt: '2027-07-17T20:00:00+02:00',
        endsAt: '2027-07-18T08:00:00+02:00',
      }),
    ).toEqual(new Date('2027-03-28T13:30:00Z'));
  });

  it('keeps the length an end change made, not the one before it', () => {
    const shortened = { ...night, endDate: '2027-07-17', endTime: '23:00' };

    expect(endOf(startMoved(shortened, { startTime: '19:00' }, true, MADRID))).toBe(
      '2027-07-17T22:00',
    );
  });

  it('follows the start date on a new event before an end is chosen', () => {
    const fresh = {
      ...DRAFT,
      startDate: '2026-11-14',
      startTime: '',
      endDate: '2026-11-14',
      endTime: '',
    };

    expect(startMoved(fresh, { startDate: '2026-11-20' }, false, MADRID)).toMatchObject({
      startDate: '2026-11-20',
      endDate: '2026-11-20',
      endTime: '',
    });
    expect(
      startMoved({ ...fresh, endTime: '' }, { startTime: '18:00' }, false, MADRID),
    ).toMatchObject({
      endDate: '2026-11-14',
      endTime: '',
    });
  });

  it('leaves a set end alone while the start is incomplete', () => {
    expect(startMoved(night, { startDate: '' }, true, MADRID)).toMatchObject({
      startDate: '',
      endDate: '2027-07-18',
      endTime: '08:00',
    });
  });

  it('carries the end by the length it was given once a cleared start is typed again', () => {
    const cleared = startMoved(night, { startDate: '' }, true, MADRID);
    const length = draftLength(night, MADRID);

    expect(length).toBe(720);
    expect(draftLength(cleared, MADRID)).toBeNull();
    expect(endOf(startMoved(cleared, { startDate: '2027-07-24' }, true, MADRID, length))).toBe(
      '2027-07-25T08:00',
    );
  });
});

describe('editing an event (sc-3587)', () => {
  const saved = {
    name: 'Owambe',
    type: 'birthday' as const,
    startsAt: '2026-03-28T19:00:00+00:00',
    endsAt: '2026-03-29T19:00:00+01:00',
    timeZone: 'Europe/London',
    currency: 'GBP',
    venue: null,
  };
  const venue = venueDraftOf(null);

  it('opens with the wall-clock times as saved, whatever their offsets', () => {
    expect(draftOf(saved)).toEqual({
      name: 'Owambe',
      type: 'birthday',
      startDate: '2026-03-28',
      startTime: '19:00',
      endDate: '2026-03-29',
      endTime: '19:00',
    });
  });

  it('sends nothing when nothing changed, a trimmed name included', () => {
    const draft = { ...draftOf(saved), name: '  Owambe ' };

    expect(
      eventChanges(saved, { draft, timeZone: 'Europe/London', currency: 'GBP', venue }),
    ).toEqual({});
  });

  it('sends only what changed, and a new zone alone keeps the times as typed', () => {
    expect(
      eventChanges(saved, {
        draft: draftOf(saved),
        timeZone: 'Europe/Paris',
        currency: 'GBP',
        venue,
      }),
    ).toEqual({ timeZone: 'Europe/Paris' });
    expect(
      eventChanges(saved, {
        draft: { ...draftOf(saved), name: 'Owambe at night', endTime: '23:30' },
        timeZone: 'Europe/London',
        currency: 'EUR',
        venue,
      }),
    ).toEqual({ name: 'Owambe at night', endsAt: '2026-03-29T23:30', currency: 'EUR' });
    expect(
      eventChanges(saved, {
        draft: { ...draftOf(saved), type: 'party' },
        timeZone: 'Europe/London',
        currency: 'GBP',
        venue,
      }),
    ).toEqual({ type: 'party' });
  });

  it("puts a Finished event's schedule back as saved and keeps the rest as typed (sc-3585)", () => {
    const typed = {
      draft: { ...draftOf(saved), name: 'Owambe at night', endTime: '23:30' },
      timeZone: 'Europe/Paris',
      currency: 'EUR',
      venue,
    };
    const kept = scheduleKept(typed, { draft: draftOf(saved), timeZone: saved.timeZone });

    expect(eventChanges(saved, kept)).toEqual({ name: 'Owambe at night', currency: 'EUR' });
  });
});

describe('the type of an event (sc-3588)', () => {
  it("is the API's EventType, case for case and in its order", () => {
    const source = readFileSync(
      new URL('../../../services/api/src/Enum/EventType.php', import.meta.url),
      'utf8',
    );

    expect(Array.from(source.matchAll(/case \w+ = '([a-z_]+)';/g), ([, value]) => value)).toEqual([
      ...EVENT_TYPES,
    ]);
  });

  it('knows only the fourteen', () => {
    expect(EVENT_TYPES).toHaveLength(14);
    expect(EVENT_TYPES.at(-1)).toBe('other');
    expect(isEventType('memorial')).toBe(true);
    expect(isEventType('burial')).toBe(false);
    expect(isEventType('Wedding')).toBe(false);
  });
});

describe("an event's venue (sc-3589)", () => {
  const saved = {
    name: 'Owambe',
    type: 'wedding' as const,
    startsAt: '2026-11-14T16:00:00+01:00',
    endsAt: '2026-11-14T23:00:00+01:00',
    timeZone: 'Africa/Lagos',
    currency: 'NGN',
    venue: { name: 'The Civic Centre', address: { formatted: 'Ozumba Mbadiwe Avenue, Lagos' } },
  };

  function changes(venue: Partial<VenueDraft>) {
    return eventChanges(saved, {
      draft: draftOf(saved),
      timeZone: saved.timeZone,
      currency: saved.currency,
      venue: { ...venueDraftOf(saved.venue), ...venue },
    });
  }

  it('opens with the saved name and address, and sends nothing while they stay', () => {
    expect(venueDraftOf(saved.venue)).toEqual({
      name: 'The Civic Centre',
      address: 'Ozumba Mbadiwe Avenue, Lagos',
      addressId: null,
    });
    expect(changes({ name: ' The Civic Centre ' })).toEqual({});
  });

  it('sends a picked address with the suggestion it came from', () => {
    expect(changes({ address: 'Eko Hotel, Lagos', addressId: 'node:7' })).toEqual({
      venue: { name: 'The Civic Centre', address: 'Eko Hotel, Lagos', addressId: 'node:7' },
    });
  });

  it('sends a typed address on its own', () => {
    expect(changes({ address: '12 Bode Thomas Street' })).toEqual({
      venue: { name: 'The Civic Centre', address: '12 Bode Thomas Street' },
    });
  });

  it('sends null when both fields are cleared', () => {
    expect(changes({ name: ' ', address: '' })).toEqual({ venue: null });
  });

  it('refuses what the API refuses, after trimming', () => {
    expect(venueProblems({ name: ` ${'a'.repeat(120)} `, address: '', addressId: null })).toEqual(
      [],
    );
    expect(
      venueProblems({ name: 'a'.repeat(121), address: 'b'.repeat(301), addressId: null }),
    ).toEqual([
      { field: 'venueName', problem: 'venueNameTooLong' },
      { field: 'venueAddress', problem: 'venueAddressTooLong' },
    ]);
  });

  it('is null for a new event with neither field', () => {
    expect(venueSent(venueDraftOf(null))).toBeNull();
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

describe('a copy of an event (sc-3593)', () => {
  const lagos = { startsAt: '2026-11-14T16:00:00+01:00', endsAt: '2026-11-15T02:00:00+01:00' };
  const acrossTheChange = {
    startsAt: '2027-03-27T20:00:00+01:00',
    endsAt: '2027-03-28T08:00:00+02:00',
  };
  const inJuly = { startsAt: '2027-07-17T20:00:00+02:00', endsAt: '2027-07-18T08:00:00+02:00' };

  it('ends as long after its new start as the original did', () => {
    expect(copiedEnd('2027-05-15', '16:00', 'Africa/Lagos', lagos)).toEqual(
      new Date('2027-05-16T01:00:00Z'),
    );
    expect(clockMinutes(lagos, 'Africa/Lagos')).toBe(600);
  });

  it('keeps the length on the clock when the original crosses a change of clocks', () => {
    expect(copiedEnd('2027-07-17', '20:00', 'Europe/Madrid', acrossTheChange)).toEqual(
      new Date('2027-07-18T08:00:00+02:00'),
    );
    expect(copiedEnd('2027-07-17', '21:00', 'Europe/Madrid', acrossTheChange)).toEqual(
      new Date('2027-07-18T09:00:00+02:00'),
    );
    expect(clockMinutes(acrossTheChange, 'Europe/Madrid')).toBe(720);
  });

  it('keeps the length on the clock when the copy crosses one', () => {
    expect(copiedEnd('2027-03-27', '20:00', 'Europe/Madrid', inJuly)).toEqual(
      new Date('2027-03-28T08:00:00+02:00'),
    );
    expect(copiedEnd('2027-03-27', '21:00', 'Europe/Madrid', inJuly)).toEqual(
      new Date('2027-03-28T09:00:00+02:00'),
    );
  });

  it('saves an end the clocks skip later by the gap, and a repeated one at its earlier offset', () => {
    const tenAndAHalf = { ...inJuly, endsAt: '2027-07-18T06:30:00+02:00' };
    const sixAndAHalf = { ...inJuly, endsAt: '2027-07-18T02:30:00+02:00' };

    expect(copiedEnd('2027-03-27', '16:00', 'Europe/Madrid', tenAndAHalf)).toEqual(
      new Date('2027-03-28T03:30:00+02:00'),
    );
    expect(copiedEnd('2027-10-30', '20:00', 'Europe/Madrid', sixAndAHalf)).toEqual(
      new Date('2027-10-31T02:30:00+02:00'),
    );
  });

  it('has no end until the start has a date and a time', () => {
    expect(copiedEnd('2027-05-15', '', 'Africa/Lagos', lagos)).toBeNull();
    expect(copiedEnd('', '16:00', 'Africa/Lagos', lagos)).toBeNull();
  });
});
