import { describe, expect, it } from 'vitest';

import { checkInOf, movedToGrill, nightOf, openOf } from '../myNight/myNightModel.ts';
import { type Access, KS, openButton, opensStations, rowLine, rowShows } from './wayIn.ts';
import { KITCHEN_WAY_IN_BOARDS, WAY_IN_STATES, overviewOf } from './wayInBoards.ts';
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
      WAY_IN_STATES.map((state) => [state, overviewOf(state).station?.line ?? null]),
    );

    expect(lines).toEqual({
      own_course: 'Fryer · Mains',
      own_before: 'Fryer',
      past_midnight: 'Fryer · Mains',
      last_pick: 'Grill · Mains',
      pick: 'Pick a station',
      day_before: null,
      finished: null,
      floor: null,
      view: null,
      org_night: 'Pass · Mains',
      org_no_night: 'Grill · Mains',
      org_day_before: null,
    });
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
