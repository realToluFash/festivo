import { describe, expect, it } from 'vitest';

import { asStaffLinkWindow, asStaffPlan, asStaffReminder } from './staff.ts';

const tablesOf = (count: number) =>
  Array.from({ length: count }, (_, n) => ({ id: `t${n + 1}`, name: `T${n + 1}` }));

const entry = {
  id: 's1',
  fullName: 'Sade Lawal',
  mobile: null,
  email: null,
  job: { id: 'j1', name: 'Bar' },
  station: null,
  stations: [],
  stationRemoved: null,
  leads: false,
  floorLead: false,
  shifts: [
    { id: 'h1', startsAt: '2026-11-07T16:00:00+01:00', endsAt: '2026-11-08T01:00:00+01:00' },
  ],
  link: 'no_mobile',
  linkBy: null,
  linkAt: null,
  briefing: 'none',
  briefingCopy: null,
  contactsErased: false,
  notice: null,
  inApp: false,
};

const plan = {
  staff: [entry],
  jobs: [{ id: 'j1', name: 'Bar', access: 'view' }],
  shifts: [
    {
      id: 'h1',
      job: 'j1',
      startsAt: '2026-11-07T16:00:00+01:00',
      endsAt: '2026-11-08T01:00:00+01:00',
      needed: 1,
      people: ['s1'],
    },
  ],
  stations: {
    places: [{ id: 'pass', name: 'Pass', pass: true, people: [], lead: null, dishes: 0 }],
    sections: [],
    floorLead: null,
    courses: [],
    walk: [],
  },
  rules: null,
};

describe('asStaffPlan', () => {
  it('reads the roster with its jobs and shifts', () => {
    expect(asStaffPlan(plan)).toEqual(plan);
  });

  it('reads the house rules, and a briefing copied and marked as sent (sc-3917)', () => {
    const briefed = {
      ...entry,
      briefing: 'sent',
      briefingCopy: { by: 'Ifeoma Nduka', at: '2026-11-01T11:00:00+01:00', marked: true },
    };
    const read = { ...plan, staff: [briefed], rules: 'Black shirts.' };

    expect(asStaffPlan(read)).toEqual(read);
  });

  it('reads a change notice waiting to go, told, and nobody to reach (sc-4333)', () => {
    const waiting = {
      ...entry,
      briefing: 'sent',
      notice: {
        state: 'waiting',
        goesAt: '2026-11-01T11:15:00+01:00',
        changes: [
          {
            kind: 'start_time',
            start: '2026-11-07T15:00:00+01:00',
            end: null,
            oldStart: '2026-11-07T16:00:00+01:00',
            oldEnd: null,
            new: null,
            old: null,
            count: 0,
            on: '2026-11-07T15:00:00+01:00',
            dated: false,
          },
        ],
      },
    };
    const told = {
      ...entry,
      notice: { state: 'told', at: '2026-11-01T11:15:00+01:00', channel: 'push', ending: null },
    };
    const calledOff = {
      ...entry,
      id: 'c',
      notice: {
        state: 'told',
        at: '2026-11-01T11:15:00+01:00',
        channel: 'push',
        ending: 'called_off',
      },
    };
    const read = { ...plan, staff: [waiting, told, calledOff] };

    expect(asStaffPlan(read)).toEqual(read);
  });

  it('reads a change without the day its times need not name as none, undated', () => {
    const change = {
      kind: 'job',
      start: null,
      end: null,
      oldStart: null,
      oldEnd: null,
      new: 'Bar',
      old: 'Floor',
      count: 0,
    };
    const notice = { state: 'waiting', goesAt: '2026-11-01T11:15:00+01:00', changes: [change] };

    expect(asStaffPlan({ ...plan, staff: [{ ...entry, notice }] })?.staff[0]?.notice).toEqual({
      ...notice,
      changes: [{ ...change, on: null, dated: false }],
    });
  });

  it('reads a told notice without its ending as none, and refuses an ending it does not know', () => {
    const told = { state: 'told', at: '2026-11-01T11:15:00+01:00', channel: 'push' };

    expect(asStaffPlan({ ...plan, staff: [{ ...entry, notice: told }] })?.staff[0]?.notice).toEqual(
      { ...told, ending: null },
    );
    expect(
      asStaffPlan({ ...plan, staff: [{ ...entry, notice: { ...told, ending: 'paused' } }] }),
    ).toBeNull();
  });

  it('refuses a change notice of a state or kind it does not know', () => {
    expect(asStaffPlan({ ...plan, staff: [{ ...entry, notice: { state: 'held' } }] })).toBeNull();
    expect(
      asStaffPlan({ ...plan, staff: [{ ...entry, notice: { state: 'unreachable' } }] }),
    ).toBeNull();
    expect(
      asStaffPlan({
        ...plan,
        staff: [
          {
            ...entry,
            notice: {
              state: 'waiting',
              goesAt: '2026-11-01T11:15:00+01:00',
              changes: [{ kind: 'pay' }],
            },
          },
        ],
      }),
    ).toBeNull();
  });

  it('refuses a briefing state it does not know, and a plan without its rules', () => {
    const { rules: _, ...withoutRules } = plan;

    expect(asStaffPlan({ ...plan, staff: [{ ...entry, briefing: 'held' }] })).toBeNull();
    expect(asStaffPlan(withoutRules)).toBeNull();
  });

  it('reads someone with no job and no shifts', () => {
    const none = { ...entry, job: null, shifts: [] };

    expect(asStaffPlan({ ...plan, staff: [none] })?.staff).toEqual([none]);
  });

  it('refuses an access level it does not know, and a row of another shape', () => {
    expect(asStaffPlan({ ...plan, jobs: [{ id: 'j1', name: 'Bar', access: 'edit' }] })).toBeNull();
    expect(asStaffPlan({ ...plan, staff: [{ ...entry, shift: 'Bar' }] })).not.toBeNull();
    expect(asStaffPlan({ ...plan, staff: [{ ...entry, job: 'Bar' }] })).toBeNull();
    expect(asStaffPlan({ staff: [entry], jobs: [] })).toBeNull();
  });

  it('reads stations, and a person on a section who leads it (sc-3910)', () => {
    const section = { id: 'sa', name: 'Section A', kind: 'section', tables: tablesOf(6) };
    const onIt = { ...entry, station: section, stations: [section], leads: true };
    const stations = {
      places: [
        { id: 'pass', name: 'Pass', pass: true, people: [], lead: null, dishes: 1 },
        { id: 'grill', name: 'Grill', pass: false, people: [], lead: null, dishes: 1 },
      ],
      sections: [{ id: 'sa', name: 'Section A', tables: tablesOf(6), people: ['s1'], lead: 's1' }],
      floorLead: 's1',
      courses: [
        {
          id: 'c1',
          name: 'Main',
          items: [
            { name: 'Rice', dishedAt: 'pass' },
            { name: 'Chicken', dishedAt: 'grill' },
          ],
        },
      ],
      walk: ['grill'],
    };

    expect(asStaffPlan({ ...plan, staff: [onIt], stations })).toEqual({
      ...plan,
      staff: [onIt],
      stations,
    });
  });

  it('refuses a plan without stations, and a station of a kind it does not know', () => {
    const { stations: _, ...withoutStations } = plan;
    const odd = { ...entry, station: { id: 'x', name: 'X', kind: 'zone', tables: [] } };

    expect(asStaffPlan(withoutStations)).toBeNull();
    expect(asStaffPlan({ ...plan, staff: [odd] })).toBeNull();
  });
});

describe('asStaffLinkWindow', () => {
  it('an open link shows the event, the job and the masked number, and a name only to another account', () => {
    expect(
      asStaffLinkWindow({
        state: 'open',
        event: { name: 'Owambe' },
        job: 'Bar',
        mobile: { countryCode: 'NG', lastDigits: '4512' },
        reader: 'other',
        name: 'Ada Obi',
      }),
    ).toEqual({
      state: 'open',
      event: 'Owambe',
      job: 'Bar',
      mobile: { countryCode: 'NG', lastDigits: '4512' },
      reader: 'other',
      name: 'Ada Obi',
      pastAccess: false,
      signedOutAt: null,
      timeZone: null,
    });
    expect(
      asStaffLinkWindow({
        state: 'open',
        event: { name: 'Owambe' },
        job: 'Bar',
        mobile: null,
        reader: 'yours',
        name: null,
        signedOutAt: '2027-03-07T02:00:00+01:00',
        timeZone: 'Africa/Lagos',
      }),
    ).toMatchObject({ signedOutAt: '2027-03-07T02:00:00+01:00', timeZone: 'Africa/Lagos' });
    expect(
      asStaffLinkWindow({
        state: 'open',
        event: { name: 'Owambe' },
        job: null,
        mobile: null,
        reader: null,
        name: 'Ada',
      }),
    ).toMatchObject({ reader: null, name: null, mobile: null });
    expect(asStaffLinkWindow({ state: 'open' })).toBeNull();
  });

  it('reads a link not open yet with no time as one for someone with no shift', () => {
    expect(asStaffLinkWindow({ state: 'not_yet' })).toEqual({ state: 'not_yet', from: null });
    expect(asStaffLinkWindow({ state: 'not_yet', from: '2026-10-24T05:00:00+01:00' })).toEqual({
      state: 'not_yet',
      from: '2026-10-24T05:00:00+01:00',
    });
    expect(asStaffLinkWindow({ state: 'not_yet', from: 5 })).toBeNull();
  });
});

describe('asStaffReminder', () => {
  const card = {
    on: true,
    time: '10:00',
    next: { date: '2026-10-16', count: 3 },
    notBriefed: 1,
    unreachable: 2,
    sent: null,
    concluded: null,
  };

  it('reads the card (sc-4333)', () => {
    expect(asStaffReminder(card)).toEqual(card);
    expect(
      asStaffReminder({
        ...card,
        next: null,
        sent: { date: '2026-10-16', count: 5 },
        concluded: 'called_off',
      }),
    ).toEqual({
      ...card,
      next: null,
      sent: { date: '2026-10-16', count: 5 },
      concluded: 'called_off',
    });
  });

  it('refuses a shape it does not know', () => {
    expect(asStaffReminder({ ...card, concluded: 'paused' })).toBeNull();
    expect(asStaffReminder({ ...card, next: { date: '2026-10-16' } })).toBeNull();
    expect(asStaffReminder({ ...card, unreachable: undefined })).toBeNull();
  });
});
