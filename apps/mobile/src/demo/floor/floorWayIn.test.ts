import { describe, expect, it } from 'vitest';

import {
  checkInOf,
  movedOffSection,
  movedOntoSection,
  moved,
  nightOf,
  openFloorOf,
  openOf,
  whosHereOf,
} from '../myNight/myNightModel.ts';
import { FL, floorLine, openFloorButton, opensFloor } from './floorWayIn.ts';
import { type FloorWayInState, floorOverviewOf } from './floorWayInBoards.ts';

describe('who opens the floor (sc-4002)', () => {
  it('lets the floor levels and the organiser’s roles in', () => {
    for (const access of [
      'Can work the floor',
      'Can run the floor',
      'Owner',
      'Admin',
      'Lead',
      'Can edit',
    ] as const) {
      expect(opensFloor(access)).toBe(true);
    }
  });

  it('keeps the pass, viewers and the door out', () => {
    for (const access of ['Can work the pass', 'Can view', 'Can check guests in'] as const) {
      expect(opensFloor(access)).toBe(false);
    }
  });
});

describe('the Floor row’s line (sc-98893)', () => {
  const one = { sections: ['Section B'], manages: false, course: 'Main' };

  it('names one section and the latest fired course, or the section alone before a fire', () => {
    expect(floorLine(one, 'en')).toBe('Section B · Main');
    expect(floorLine({ ...one, course: null }, 'en')).toBe('Section B');
  });

  it('lists two sections in order from CLDR, in the person’s language', () => {
    const two = { ...one, sections: ['Section B', 'Section D'] };

    expect(floorLine(two, 'en')).toBe('Section B and Section D · Main');
    expect(floorLine(two, 'fr')).toBe('Section B et Section D · Main');
  });

  it('reads All tables for service.manage on no section, and No section yet for anyone else', () => {
    expect(floorLine({ sections: [], manages: true, course: 'Main' }, 'en')).toBe(
      'All tables · Main',
    );
    expect(floorLine({ sections: [], manages: true, course: null }, 'en')).toBe('All tables');
    expect(floorLine({ sections: [], manages: false, course: 'Main' }, 'en')).toBe(FL.noSection);
  });

  it('is read as one button with its line', () => {
    expect(FL.label('Section B · Main')).toBe('Floor, Section B · Main');
  });
});

describe('the Floor row on Overview (sc-98893)', () => {
  const rows = (state: FloorWayInState) => {
    const shown = floorOverviewOf(state);

    return [shown.rostered, shown.station != null, shown.floor?.line ?? null];
  };

  it('sits under Your night, and under Kitchen station where that shows', () => {
    expect(rows('one_section')).toEqual([true, false, 'Section B · Mains']);
    expect(rows('all_tables')).toEqual([false, true, 'All tables · Mains']);
    expect(rows('org_lead')).toEqual([true, true, 'All tables · Mains']);
    expect(rows('org_admin')).toEqual([false, true, 'All tables · Mains']);
    expect(rows('org_waiter')).toEqual([true, false, 'Section B · Mains']);
  });

  it('is the first row for an account with neither Your night nor Kitchen station', () => {
    expect(rows('no_section')).toEqual([false, false, 'No section yet']);
  });

  it('opens Floor over Overview, its ‹ reading Overview', () => {
    expect(floorOverviewOf('one_section').floor?.href).toBe(
      '/demo/floor?state=yours&from=overview',
    );
  });

  it('shows from 00:00 on the day in the event’s zone, past midnight, and not once Finished', () => {
    expect(rows('day_before')[2]).toBe(null);
    expect(rows('past_midnight')[2]).toBe('Section B · Mains');
    expect(rows('finished')[2]).toBe(null);
    expect(rows('org_day_before')[2]).toBe(null);
  });

  it('shows no row for the pass, viewers and the door', () => {
    expect(rows('pass')).toEqual([true, true, null]);
    expect(rows('view')[2]).toBe(null);
    expect(rows('check_in')[2]).toBe(null);
  });

  it('changes its line when the floor lead moves the person', () => {
    expect(floorOverviewOf('moving').floor?.moves?.line).toBe('Section D · Mains');
  });
});

describe('Open Floor on Your night (sc-98893)', () => {
  it('shows on a section station whose access opens the floor, in a browser and in the app', () => {
    for (const state of ['night', 'section_app', 'before_doors', 'station_lead'] as const) {
      expect(openFloorOf(nightOf(state))?.label).toBe('Open Floor');
    }
    expect(openFloorOf(nightOf('night'))).toEqual({
      label: 'Open Floor',
      href: '/demo/floor?state=yours&from=night',
      primary: true,
    });
  });

  it('is the secondary under Check-in when the job checks in too', () => {
    const night = nightOf('section_checkin');

    expect([checkInOf(night)?.label, openFloorOf(night)?.primary]).toEqual(['Check-in', false]);
  });

  it('puts Who’s here after it, as the secondary', () => {
    expect(whosHereOf(nightOf('station_lead'))?.primary).toBe(false);
  });

  it('is never beside Open {station}: a kitchen station gets its own button', () => {
    expect(openFloorOf(nightOf('kitchen'))).toBe(null);
    expect(openOf(nightOf('kitchen'))?.label).toBe('Open Fryer');
  });

  it('shows no button for no station, or a section at a level that does not open the floor', () => {
    for (const state of ['no_station', 'section_pass', 'section_view', 'section_door'] as const) {
      expect(openFloorOf(nightOf(state))).toBe(null);
    }
    expect(checkInOf(nightOf('section_door'))?.label).toBe('Check-in');
  });

  it('comes and goes with Your shift', () => {
    expect(openFloorOf(movedOntoSection(nightOf('no_station')))?.label).toBe(FL.open);
    expect(openFloorOf(movedOffSection(nightOf('section_app')))).toBe(null);
    expect(openFloorOf(moved(nightOf('night')))?.label).toBe(FL.open);
  });

  it('needs both a section station and the access', () => {
    expect(openFloorButton({ kind: 'section', name: 'Section B' }, 'Can work the floor')).toBe(
      FL.open,
    );
    expect(openFloorButton({ kind: 'kitchen', name: 'Grill', dishes: 2 }, 'Lead')).toBe(null);
    expect(openFloorButton(null, 'Lead')).toBe(null);
  });
});
