import { describe, expect, it } from 'vitest';

import {
  MN,
  MY_NIGHT_BOARDS,
  MY_NIGHT_STATES,
  guestCount,
  headingOf,
  moved,
  myNightStateOf,
  nightOf,
  rowLineOf,
  signedInUntil,
} from './myNightModel.ts';

describe('a staff member’s night (sc-3915)', () => {
  it('links every state from the demo’s list, and reads an unknown one as tonight', () => {
    expect(MY_NIGHT_BOARDS.map((board) => board.href)).toEqual(
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

    expect(MN.only(night.linkEnds)).toBe('Tonight only · ends 02:00');
    expect(MN.yoursAlone(signedInUntil(night))).toBe(
      'This link is yours alone. You are signed in until Sun, Nov 29, 02:00. Nothing stays on this device.',
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

  it('names where they are and the shift on the event’s Your night row, the job with no station', () => {
    expect(rowLineOf(nightOf('app_event'))).toBe('Section B · 17:00 to 01:00');
    expect(rowLineOf({ ...nightOf('app_event'), station: null })).toBe('Waiter · 17:00 to 01:00');
    expect(nightOf('app_event').inApp).toBe(true);
  });
});
