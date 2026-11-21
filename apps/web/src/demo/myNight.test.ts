import { describe, expect, it } from 'vitest';

import {
  MN,
  MY_NIGHT_PAGES,
  MY_NIGHT_STATES,
  guestCount,
  headingOf,
  moved,
  myNightStateOf,
  nightOf,
  yoursAlone,
} from './myNight.ts';
import { clockOf } from './doorCode.ts';

describe('a staff member’s night (sc-3915)', () => {
  it('links every state from the demo’s home, and reads an unknown one as tonight', () => {
    expect(MY_NIGHT_PAGES[0]?.states.map((state) => state.to)).toEqual(
      MY_NIGHT_STATES.map((state) => `/demo/my-night?state=${state}`),
    );
    expect(myNightStateOf('nonsense')).toBe('night');
    expect(myNightStateOf(null)).toBe('night');
  });

  it('heads with the station, or the job when there is none', () => {
    expect(headingOf(nightOf('night'))).toBe('Section B');
    expect(headingOf(nightOf('no_station'))).toBe('Waiter');
  });

  it('names one ending: the link’s, in the header and the sign-out line', () => {
    const night = nightOf('night');

    expect(MN.only(clockOf(night.linkEndsAt))).toBe('Tonight only · ends 02:00');
    expect(yoursAlone(night)).toBe(
      'This link is yours alone. You’ll be signed out at Sunday 02:00, and nothing stays on this phone.',
    );
  });

  it('stands the floor lead in, with Call, and says No lead named yet only with neither', () => {
    const floor = nightOf('no_lead').lead;

    expect(floor?.floor).toBe(true);
    expect(floor != null && MN.callLabel(floor)).toBe('Call Kemi Adeyinka, floor lead');
    expect(nightOf('no_station').lead?.floor).toBe(true);
    expect(nightOf('no_lead_none').lead).toBeNull();
    expect(nightOf('sparse').lead?.phone).toBeNull();
  });

  it('counts each table’s guests from the names it shows', () => {
    const tables = nightOf('night').tables ?? [];

    expect(tables.map(guestCount)).toEqual(['4 guests', '3 guests']);
    expect(guestCount({ name: 'Table 1', guests: [{ name: 'Ada Obi', diet: null }] })).toBe(
      '1 guest',
    );
  });

  it('holds the tables until doors, and says when clocking in opens before its window', () => {
    expect(nightOf('before_doors').doorsOpen).toBe(false);
    expect(nightOf('before_doors').clock.phase).toBe('ready');
    expect(nightOf('early').clock.phase).toBe('before');
    expect(nightOf('two_shifts').clock.end).toBe(23 * 60);
    expect(nightOf('no_station').tables).toBeNull();
  });

  it('changes the heading, the lead and the tables when the organiser moves the person', () => {
    const now = moved(nightOf('night'));

    expect(now.updated).toBe('Section C');
    expect(headingOf(now)).toBe('Section C');
    expect(now.lead?.name).toBe('Ifeanyi Obi');
    expect(now.tables?.map((table) => table.name)).toEqual(['Table 11']);
  });

  it('shows nothing the endpoint does not send in the sparse night', () => {
    const sparse = nightOf('sparse');

    expect(sparse.rules).toBeNull();
    expect(sparse.timing).toBeNull();
    expect(
      sparse.tables?.flatMap((table) => table.guests).every((guest) => guest.diet == null),
    ).toBe(true);
  });
});
