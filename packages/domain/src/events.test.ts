import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  EVENT_TYPES,
  type EventDraft,
  draftOf,
  type VenueDraft,
  eventChanges,
  eventNameLength,
  eventProblems,
  eventsInOrder,
  filledEndDate,
  isEventType,
  venueDraftOf,
  venueProblems,
  venueSent,
  savedWallClock,
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

describe('the order events are listed in (sc-1593)', () => {
  const at = (name: string, startsAt: string) => ({ name, startsAt });

  it('puts the soonest start first, whatever the offset it is written with', () => {
    const lagos = at('Lagos', '2026-11-14T16:00:00+01:00');
    const london = at('London', '2026-11-14T15:30:00+00:00');

    expect(eventsInOrder([london, lagos], 'en').map((e) => e.name)).toEqual(['Lagos', 'London']);
  });

  it("sorts the same start by name in the reader's collation, not by code point", () => {
    const start = '2026-11-14T16:00:00+01:00';
    const names = ['Zebra', 'école', 'Ball', 'apéro'].map((name) => at(name, start));

    expect(eventsInOrder(names, 'fr').map((e) => e.name)).toEqual([
      'apéro',
      'Ball',
      'école',
      'Zebra',
    ]);
  });

  it('leaves the list it was given as it was', () => {
    const given = [at('B', '2026-11-15T10:00:00Z'), at('A', '2026-11-14T10:00:00Z')];

    eventsInOrder(given, 'en');

    expect(given.map((e) => e.name)).toEqual(['B', 'A']);
  });
});
