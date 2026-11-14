import { describe, expect, it } from 'vitest';

import {
  PASS,
  STATIONS_PAGES,
  STATIONS_STATES,
  checkName,
  dishedAt,
  dishesLine,
  itemsAt,
  moveStop,
  placesOf,
  removeLine,
  removePlace,
  sectionLabel,
  setDishedAt,
  stationsStart,
  toggle,
} from './stations.ts';

const populated = () => stationsStart('populated').state;

describe('stations (sc-3910)', () => {
  it('names a section with its table count', () => {
    expect(sectionLabel({ name: 'Section A', tables: 6 })).toBe('Section A · 6 tables');
    expect(sectionLabel({ name: 'Section B', tables: 1 })).toBe('Section B · 1 table');
    expect(sectionLabel({ name: 'Section C', tables: 0 })).toBe('Section C · No tables yet');
  });

  it('puts the Pass first among places', () => {
    expect(placesOf(populated())[0]?.name).toBe('Pass');
  });

  it('lists a course’s items in the menu’s order, each option and variant its own, Served with this course last', () => {
    const main = populated().courses.find((one) => one.id === 'c2');
    expect(main?.items).toEqual([
      'Rice',
      'Chicken',
      'Plantain',
      'Salad',
      'Moi moi',
      'Croaker',
      'Tilapia',
      'Pepper sauce',
      'Yam chips',
      'Bread roll',
    ]);
  });

  it('dishes an item nobody has given a station at the Pass', () => {
    expect(dishedAt(populated(), 'c2', 'Salad')).toBe(PASS);
    expect(itemsAt(populated(), PASS)).toBe(4);
    expect(itemsAt(populated(), 'grill')).toBe(3);
  });

  it('says how many items a place dishes, and nothing for none', () => {
    expect(dishesLine(3)).toBe('Dishes 3 items');
    expect(dishesLine(1)).toBe('Dishes 1 item');
    expect(dishesLine(0)).toBeNull();
  });

  it('adds a place to the walking order’s end on its first item, and drops it on its last', () => {
    const joined = setDishedAt(populated(), 'c2', 'Salad', 'bar');
    expect(joined.state.walk).toEqual(['kitchen', 'grill', 'pastry', 'bar']);
    expect(joined.said).toBe('Salad is dished at Bar. Bar joins the walking order at stop 5.');

    const left = setDishedAt(populated(), 'c3', 'Ice cream', PASS);
    expect(left.state.walk).toEqual(['kitchen', 'grill']);
    expect(left.said).toBe('Ice cream is dished at Pass. Pastry leaves the walking order.');

    const back = setDishedAt(left.state, 'c3', 'Wafer', 'pastry');
    expect(back.state.walk).toEqual(['kitchen', 'grill', 'pastry']);
  });

  it('moves a stop and announces it, never past the ends', () => {
    const moved = moveStop(populated(), 'grill', -1);
    expect(moved?.state.walk).toEqual(['grill', 'kitchen', 'pastry']);
    expect(moved?.said).toBe('Grill moved to stop 2 of 4');
    expect(moveStop(populated(), 'kitchen', -1)).toBeNull();
    expect(moveStop(populated(), 'pastry', 1)).toBeNull();
  });

  it('asks before removing a place, naming each thing that goes with it', () => {
    expect(removeLine(populated(), 'grill')).toBe(
      'Remove Grill? 2 people lose their station, and its 3 items go to the Pass.',
    );
    expect(removeLine(populated(), 'bar')).toBe('Remove Bar? 2 people lose their station.');
    expect(removeLine(populated(), 'pastry')).toBe('Remove Pastry? Its 1 item goes to the Pass.');
    expect(removeLine(populated(), 'stage')).toBe('Remove Stage?');
  });

  it('leaves a removed place’s people with no station and its items at the Pass', () => {
    const gone = removePlace(populated(), 'grill');
    expect(gone.state.stations.some((one) => one.id === 'grill')).toBe(false);
    expect(dishedAt(gone.state, 'c2', 'Chicken')).toBe(PASS);
    expect(gone.state.walk).toEqual(['kitchen', 'pastry']);
    expect(gone.said).toBe('Grill removed. 2 people have no station now.');
  });

  it('checks a place’s name before it is sent', () => {
    const state = populated();
    expect(checkName(state, '  ', null)).toBe('Enter a name for the station.');
    expect(checkName(state, 'x'.repeat(61), null)).toBe('Keep the name to 60 characters or fewer.');
    expect(checkName(state, 'BAR', null)).toBe('This event already has a place called Bar.');
    expect(checkName(state, 'section a', null)).toBe(
      'Section A is a seating section on this event. Give the place another name.',
    );
    expect(checkName(state, 'Grill', 'grill')).toBeNull();
    expect(checkName(state, 'Cloakroom', null)).toBeNull();
  });

  it('ignores accents when it compares names', () => {
    const state = { ...populated(), stations: [...populated().stations] };
    const renamed = {
      ...state,
      stations: state.stations.map((one) => (one.id === 'stage' ? { ...one, name: 'Café' } : one)),
    };
    expect(checkName(renamed, 'cafe', null)).toBe('This event already has a place called Café.');
  });

  it('keeps one station per person, and clears a lead who leaves', () => {
    const moved = toggle(populated(), 'tayo', 'kitchen');
    expect(moved.state.stations.find((one) => one.id === 'grill')?.lead).toBeNull();
    expect(moved.said).toBe('Tayo Bamidele moved from Grill to Kitchen. Grill has no lead now.');
    expect(moved.state.stations.filter((one) => one.people.includes('tayo'))).toHaveLength(1);
  });

  it('links every state from the demo’s home', () => {
    const linked = STATIONS_PAGES.flatMap((page) => page.states.map((one) => one.to));
    for (const state of STATIONS_STATES)
      expect(linked).toContain(`/demo/events/evt-wed-4/staff?state=${state}`);
  });
});
