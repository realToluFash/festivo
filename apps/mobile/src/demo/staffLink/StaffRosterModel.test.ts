import { describe, expect, it } from 'vitest';

import {
  acts,
  offersMarkSent,
  offersReplace,
  removedNow,
  seed,
  statusWord,
} from './StaffLinkModel.ts';
import {
  LIVE_CHANGE,
  keep,
  personOf,
  removeKept,
  resetKept,
  rosterOrder,
  rosterStateOf,
  rowLine,
  sampleRoster,
  shownOf,
  withKept,
} from './StaffRosterModel.ts';

describe('the event’s Staff in the app (sc-77903)', () => {
  it('lists the roster by shift start, then name, with people on no shift last', () => {
    const names = rosterOrder(sampleRoster()).map((one) => one.name);
    expect(names.slice(0, 3)).toEqual(['Ada Nnaji', 'Bisi Okon', 'Tayo Bamidele']);
    expect(names.indexOf('Ifeoma Nduka')).toBeLessThan(names.indexOf('Tolu Bello'));
    expect(names.at(-2)).toBe('Emeka Obi');
    expect(names.at(-1)).toBe('Chinedu Eze');
  });

  it('reads a person with no number as Add a mobile number, and everyone after the erasure as removed', () => {
    const ada = sampleRoster().find((one) => one.id === 'ada');
    const kunle = sampleRoster().find((one) => one.id === 'kunle');
    if (ada == null || kunle == null) throw new Error('sample');
    expect(shownOf(ada, false)).toBe('noMobile');
    expect(shownOf(kunle, false)).toBe('shared');
    expect(shownOf(kunle, true)).toBe('erased');
  });

  it('gives a missing job, station or shift its own words', () => {
    const chinedu = sampleRoster().find((one) => one.id === 'chinedu');
    if (chinedu == null) throw new Error('sample');
    expect(rowLine(chinedu)).toBe('No job yet · No station yet · Not on a shift yet');
  });

  it('reads what a link screen changed, and leaves out someone removed', () => {
    resetKept();
    keep(LIVE_CHANGE.id, LIVE_CHANGE.status, LIVE_CHANGE.trail);
    removeKept('emeka');
    const now = withKept(sampleRoster());
    expect(now.find((one) => one.id === 'amina')?.status).toBe('sent');
    expect(now.some((one) => one.id === 'emeka')).toBe(false);
    expect(personOf('emeka')).toBeNull();
    resetKept();
    expect(personOf('emeka')?.name).toBe('Emeka Obi');
  });

  it('opens on the populated roster for a state it does not know', () => {
    expect(rosterStateOf('nonsense')).toBe('populated');
    expect(rosterStateOf('noRead')).toBe('noRead');
  });
});

describe('the link screen’s states the roster opens (sc-77903)', () => {
  it('has no actions without a mobile number', () => {
    const s = seed('noMobile');
    expect(acts(s)).toBe(false);
    expect(statusWord(s)).toBe('Add a mobile number to send a link');
  });

  it('has nothing to share or copy after the erasure', () => {
    const s = seed('erased');
    expect(acts(s)).toBe(false);
    expect(offersReplace(s)).toBe(false);
    expect(statusWord(s)).toBe('Contact details removed after the event');
  });

  it('shows the status without staff.manage, and no actions', () => {
    const s = seed('readOnly');
    expect(statusWord(s)).toBe('Link sent');
    expect(acts(s)).toBe(false);
    expect(offersMarkSent(s)).toBe(false);
  });

  it('says a person removed while open is no longer on the staff, and holds nothing', () => {
    const s = removedNow(seed('asking'));
    expect(s.removed).toBe(true);
    expect(s.asking).toBe(false);
    expect(acts(s)).toBe(false);
    expect(s.say).toBe('[Ada Obi is no longer on the staff.]');
  });
});
