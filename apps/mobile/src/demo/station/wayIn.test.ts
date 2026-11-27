import { describe, expect, it } from 'vitest';

import { checkInOf, movedToGrill, nightOf, openOf } from '../myNight/myNightModel.ts';
import { type Access, KS, openButton, opensStations, readAt, rowLine, rowShows } from './wayIn.ts';
import {
  KITCHEN_WAY_IN_BOARDS,
  WAY_IN_STATES,
  type WayInState,
  overviewOf,
} from './wayInBoards.ts';
import { READ_ANSWERS_IN } from './wayInShown.ts';
import { stationIdOf, wayBackOf } from './wayInRoute.ts';

const SAO_PAULO = {
  startDay: '2026-11-28',
  timeZone: 'America/Sao_Paulo',
  finished: false,
  calledOff: false,
};

describe('the way in to Kitchen station (sc-95382)', () => {
  it.each<Access>(['Can work the pass', 'Can run the floor', 'Owner', 'Admin', 'Lead', 'Can edit'])(
    'shows the row for %s',
    (access) => {
      expect(opensStations(access)).toBe(true);
    },
  );

  it.each<Access>(['Can work the floor', 'Can view', 'Can check guests in'])(
    'shows no row for %s',
    (access) => {
      expect(opensStations(access)).toBe(false);
    },
  );

  it('shows from 00:00 on the first day in the event’s zone, not the server’s', () => {
    expect(rowShows(SAO_PAULO, new Date('2026-11-28T02:59:00Z'))).toBe(false);
    expect(rowShows(SAO_PAULO, new Date('2026-11-28T03:00:00Z'))).toBe(true);
  });

  it('keeps the row past midnight until the event is Finished', () => {
    expect(rowShows(SAO_PAULO, new Date('2026-11-29T04:30:00Z'))).toBe(true);
    expect(rowShows({ ...SAO_PAULO, finished: true }, new Date('2026-11-29T04:30:00Z'))).toBe(
      false,
    );
  });

  it('never shows the row for an event called off', () => {
    expect(rowShows({ ...SAO_PAULO, calledOff: true }, new Date('2026-11-28T20:00:00Z'))).toBe(
      false,
    );
  });

  it('names the station the screen opens on, with the latest fired course', () => {
    expect(rowLine({ own: 'Grill', lastPick: 'Fryer', course: 'Mains' })).toBe('Grill · Mains');
    expect(rowLine({ own: 'Grill', lastPick: null, course: null })).toBe('Grill');
    expect(rowLine({ own: null, lastPick: 'Fryer', course: 'Starter' })).toBe('Fryer · Starter');
    expect(rowLine({ own: null, lastPick: null, course: 'Mains' })).toBe(KS.pick);
  });

  it('offers Open {station} on a station that dishes, the Pass included', () => {
    const grill = { kind: 'kitchen', name: 'Grill', dishes: 2 } as const;
    const pass = { kind: 'kitchen', name: 'Pass', dishes: 1 } as const;

    expect(openButton(grill, 'Can work the pass', true)).toBe('Open Grill');
    expect(openButton(pass, 'Can work the pass', true)).toBe('Open Pass');
  });

  it('offers no button where the station cannot open', () => {
    const grill = { kind: 'kitchen', name: 'Grill', dishes: 2 } as const;

    expect(openButton({ kind: 'kitchen', name: 'Bar', dishes: 0 }, 'Can work the pass', true)).toBe(
      null,
    );
    expect(openButton({ kind: 'section', name: 'Section B' }, 'Can work the pass', true)).toBe(
      null,
    );
    expect(openButton(null, 'Can work the pass', true)).toBe(null);
    expect(openButton(grill, 'Can work the floor', true)).toBe(null);
    expect(openButton(grill, 'Can work the pass', false)).toBe(null);
  });
});

describe('the way in’s demo states (sc-95382)', () => {
  it('links every state from the demo’s list', () => {
    expect(KITCHEN_WAY_IN_BOARDS.map((board) => board.href)).toEqual(
      WAY_IN_STATES.map((state) => `/demo/kitchen-way-in?state=${state}`),
    );
  });

  it('draws the row only where the rules show it', () => {
    const lines = Object.fromEntries(
      WAY_IN_STATES.map((state) => [
        state,
        overviewOf(state, 'Africa/Lagos').station?.line ?? null,
      ]),
    );

    expect(lines).toEqual({
      own_course: 'Fryer · Mains',
      own_before: 'Fryer',
      answering: 'Fryer · Mains',
      offline: 'Fryer · Mains · as of 19:38',
      past_midnight: 'Fryer · Mains',
      last_pick: 'Grill · Mains',
      pick: 'Pick a station',
      day_before: null,
      finished: null,
      floor: null,
      view: null,
      floor_alone: null,
      pass_alone: null,
      run_floor: 'Grill · Mains',
      run_floor_alone: null,
      org_night: 'Pass · Mains',
      org_no_night: 'Grill · Mains',
      org_day_before: null,
    });
  });

  it('holds the row until the stations read answers, and keeps the last line with no connection', () => {
    expect(overviewOf('answering').station?.answersIn).toBe(READ_ANSWERS_IN);
    expect(overviewOf('own_course').station?.answersIn).toBe(undefined);
    expect(overviewOf('offline').station?.answersIn).toBe(undefined);
    expect(readAt(new Date('2026-11-28T23:05:00Z'), 'Africa/Lagos')).toBe('00:05');
  });

  it('reads "as of" in the device’s zone, as the Floor row does', () => {
    expect(overviewOf('offline', 'Europe/London').station?.line).toBe(
      'Fryer · Mains · as of 18:38',
    );
  });

  it('draws the organiser’s Overview under Your night, or in its place with no shift', () => {
    const night = overviewOf('org_night');
    const none = overviewOf('org_no_night');

    expect([night.page, night.rostered, night.station?.href]).toEqual([
      'organiser',
      true,
      '/demo/kitchen-station?state=here&from=overview&on=pass',
    ]);
    expect([none.page, none.rostered, none.station?.href]).toEqual([
      'organiser',
      false,
      '/demo/kitchen-station?state=here&from=overview&on=picked-grill',
    ]);
    expect(overviewOf('org_day_before').rostered).toBe(true);
  });

  it('opens the station on the station the row names, its ‹ reading Overview', () => {
    expect(overviewOf('own_course').station?.href).toBe(
      '/demo/kitchen-station?state=here&from=overview&on=fryer',
    );
    expect(overviewOf('pick').station?.href).toBe(
      '/demo/kitchen-station?state=here&from=overview&on=none',
    );
    expect(wayBackOf('overview')).toBe('Overview');
    expect(wayBackOf('night')).toBe('Your night');
    expect(wayBackOf(undefined)).toBe(null);
  });

  it('opens a last pick as the person who picked it, not the station’s rostered cook', () => {
    expect(stationIdOf('picked-grill')).toEqual({ station: 'grill', you: 'Ada Nnaji' });
    expect(stationIdOf('nowhere')).toBe(null);
  });
});

describe('Open {station} on Your night (sc-95382)', () => {
  it('offers the button on a kitchen station and the Pass, in the app', () => {
    expect(openOf(nightOf('kitchen'))?.label).toBe('Open Fryer');
    expect(openOf(nightOf('kitchen_pass'))?.label).toBe('Open Pass');
  });

  it('is the one primary button alone, and the secondary under Check-in when the job checks in', () => {
    expect([checkInOf(nightOf('kitchen_pass')), openOf(nightOf('kitchen_pass'))?.primary]).toEqual([
      null,
      true,
    ]);
    expect([
      checkInOf(nightOf('kitchen_checkin'))?.label,
      openOf(nightOf('kitchen_checkin')),
    ]).toEqual([
      'Check-in',
      { label: 'Open Pass', href: '/demo/kitchen-station?from=night&on=pass', primary: false },
    ]);
  });

  it('opens Check-in with its way back to Your night (qa3, #97368)', () => {
    expect(checkInOf(nightOf('kitchen_checkin'))?.href).toBe(
      '/demo/guests/check-in?state=door&from=night',
    );
  });

  it('leaves Your night as it is for a section, no station, the floor, nothing dished, and a browser', () => {
    for (const state of [
      'app',
      'no_station',
      'kitchen_floor',
      'kitchen_dishes_none',
      'kitchen_browser',
    ] as const) {
      expect(openOf(nightOf(state))).toBe(null);
    }
  });

  it('follows Your shift when Team moves the person', () => {
    expect(openOf(movedToGrill(nightOf('kitchen')))).toEqual({
      label: 'Open Grill',
      href: '/demo/kitchen-station?from=night&on=grill',
      primary: true,
    });
  });
});

describe('a service level’s Overview (sc-96279)', () => {
  const rows = (state: WayInState) => {
    const shown = overviewOf(state);

    return shown.page === 'rows'
      ? [shown.role, shown.rostered, shown.night, shown.station != null]
      : null;
  };

  it('draws the card alone with no shift and no station that day', () => {
    expect(rows('floor_alone')).toEqual(['Can work the floor', false, 'night', false]);
    expect(rows('pass_alone')).toEqual(['Can work the pass', false, 'kitchen', false]);
    expect(rows('run_floor_alone')).toEqual(['Can run the floor', false, 'kitchen', false]);
  });

  it('gives Can run the floor with no shift its Kitchen station on the day', () => {
    expect(rows('run_floor')).toEqual(['Can run the floor', false, 'kitchen', true]);
  });

  it('opens a waiter’s night for Can work the floor on the roster', () => {
    expect(rows('floor')).toEqual(['Can work the floor', true, 'night', false]);
  });
});

describe('Floor on the same Overview (sc-98893)', () => {
  it('shows the Floor row for every account whose access opens the floor, on the event’s day', () => {
    const lines = Object.fromEntries(
      WAY_IN_STATES.map((state) => [state, overviewOf(state).floor?.line ?? null]),
    );

    expect(lines).toEqual({
      own_course: null,
      own_before: null,
      answering: null,
      offline: null,
      past_midnight: null,
      last_pick: null,
      pick: null,
      day_before: null,
      finished: null,
      floor: 'No section yet',
      view: null,
      floor_alone: 'No section yet',
      pass_alone: null,
      run_floor: 'All tables · Mains',
      run_floor_alone: null,
      org_night: 'All tables · Mains',
      org_no_night: 'All tables · Mains',
      org_day_before: null,
    });
  });

  it('opens Floor over Overview, its ‹ reading Overview', () => {
    expect(overviewOf('floor_alone').floor?.href).toBe('/demo/floor?state=noSection&from=overview');
    expect(overviewOf('run_floor').floor?.href).toBe('/demo/floor?state=manage&from=overview');
  });
});
