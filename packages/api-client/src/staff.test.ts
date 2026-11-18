import { describe, expect, it } from 'vitest';

import { asStaffPlan } from './staff.ts';

const entry = {
  id: 's1',
  fullName: 'Sade Lawal',
  mobile: null,
  email: null,
  job: { id: 'j1', name: 'Bar' },
  station: null,
  shifts: [
    { id: 'h1', startsAt: '2026-11-07T16:00:00+01:00', endsAt: '2026-11-08T01:00:00+01:00' },
  ],
  link: 'no_mobile',
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
});
