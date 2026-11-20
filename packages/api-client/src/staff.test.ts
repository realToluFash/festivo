import { describe, expect, it } from 'vitest';

import { asStaffPlan } from './staff.ts';

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
  contactsErased: false,
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
};

describe('asStaffPlan', () => {
  it('reads the roster with its jobs and shifts', () => {
    expect(asStaffPlan(plan)).toEqual(plan);
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
