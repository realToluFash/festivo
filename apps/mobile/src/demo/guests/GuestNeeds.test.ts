import { describe, expect, it } from 'vitest';

import {
  GROUPS_MOST,
  GW,
  NO_NEEDS,
  NW,
  WEDDING_GROUPS,
  firstFailing,
  fullGroups,
  groupOptions,
  hasAllergy,
  needsChips,
  needsHeadLine,
  needsLines,
  needsOf,
  pickName,
  problemLine,
  returnPick,
  savedNeeds,
  typedProblem,
} from './GuestNeeds.ts';
import { eventGroups, groupNeedsStart, shownProblem, THEIR_GROUP } from './GuestNeedsStart.ts';
import { GUESTS } from './GuestsSample.ts';
import { GROUPS, changedRows, groupRows, rowsOf } from './GuestsModel.ts';

const kwame = GUESTS.find((g) => g.key === 'kwame');
if (kwame == null) throw new Error('Kwame is in the sample');

describe('the Group picker (sc-3775 on the app)', () => {
  it('returns with a name that matches a group, ignoring case and accents, picks it', () => {
    expect(returnPick(WEDDING_GROUPS, 'bride’s SIDE')).toEqual({ pick: { id: 'g-bride' } });
    expect(returnPick(WEDDING_GROUPS, 'Wórk')).toEqual({ pick: { id: 'g-work' } });
  });

  it('returns with a new name to create it with the save', () => {
    expect(returnPick(WEDDING_GROUPS, '  Family ')).toEqual({ pick: { name: 'Family' } });
  });

  it('returns with nothing typed refuses with sc-3775’s blank words and creates nothing', () => {
    expect(returnPick(WEDDING_GROUPS, '   ')).toEqual({ problem: 'blank' });
    expect(problemLine('blank')).toBe('Enter a name for the group.');
  });

  it('refuses a name over 60 characters and offers no Create', () => {
    const long = 'x'.repeat(61);
    expect(typedProblem(WEDDING_GROUPS, long)).toBe('tooLong');
    expect(groupOptions(WEDDING_GROUPS, long).create).toBeNull();
    expect(typedProblem(WEDDING_GROUPS, 'x'.repeat(60))).toBeNull();
  });

  it('at 50 groups says the app’s words, offers no Create, and still picks an existing group', () => {
    const groups = fullGroups();
    expect(groups).toHaveLength(GROUPS_MOST);
    expect(typedProblem(groups, 'Cousins')).toBe('limit');
    expect(groupOptions(groups, 'Cousins').create).toBeNull();
    expect(returnPick(groups, 'work')).toEqual({ pick: { id: 'g-work' } });
    expect(problemLine('limit')).toBe(
      'This event has 50 groups, the most it can have. Choose one of them, or, to create another, use Soirely on the web to delete one in Groups.',
    );
  });

  it('offers Create only when the typed name matches no group', () => {
    expect(groupOptions(WEDDING_GROUPS, 'Family').create).toBe('Family');
    expect(groupOptions(WEDDING_GROUPS, 'work').create).toBeNull();
    expect(groupOptions(WEDDING_GROUPS, 'side').groups.map((one) => one.id)).toEqual([
      'g-bride',
      'g-groom',
    ]);
  });

  it('shows blank only after return, and over 60 as soon as it is typed', () => {
    expect(shownProblem(WEDDING_GROUPS, '', null)).toBeNull();
    expect(shownProblem(WEDDING_GROUPS, '', 'blank')).toBe('blank');
    expect(shownProblem(WEDDING_GROUPS, 'x'.repeat(61), null)).toBe('tooLong');
  });

  it('names the pick: an existing group, a name to create, or none', () => {
    expect(pickName(WEDDING_GROUPS, { id: 'g-work' })).toBe('Work');
    expect(pickName(WEDDING_GROUPS, { name: 'Family' })).toBe('Family');
    expect(pickName(WEDDING_GROUPS, null)).toBeNull();
  });

  it('groupTaken opens with their group listed and the refusal under Group', () => {
    const start = groupNeedsStart('groupTaken', kwame, GUESTS);
    expect(start.groups).toContainEqual(THEIR_GROUP);
    expect(start.taken).toBe('Family');
    expect(GW.taken('Family')).toBe('There’s already a group called Family.');
  });

  it('carries a group a save made into the next form, picked and listed once', () => {
    const saved = GUESTS.map((g) => (g.key === 'kwame' ? { ...g, group: 'Family' } : g));
    const again = groupNeedsStart(null, { ...kwame, group: 'Family' }, saved);
    const family = again.groups.filter((one) => one.name === 'Family');
    expect(family).toHaveLength(1);
    expect(again.pick).toEqual({ id: family[0]?.id });
    expect(groupNeedsStart('groupNew', kwame, GUESTS).pick).toEqual({ name: 'Family' });
    expect(eventGroups(saved).slice(0, WEDDING_GROUPS.length)).toEqual(WEDDING_GROUPS);
  });
});

describe('Needs (sc-3777 on the app)', () => {
  it('refuses a ticked Other with no words, and one over 100', () => {
    expect(needsLines(needsOf({ allergies: ['other'] }))).toEqual({ otherAllergy: 'Say which' });
    expect(needsLines(needsOf({ diet: ['other'], otherDiet: 'x'.repeat(101) }))).toEqual({
      otherDiet: 'Shorten it to 100 characters or fewer.',
    });
    expect(needsLines(needsOf({ access: ['other'], otherAccess: 'A ramp' }))).toEqual({});
  });

  it('finds the first failing field in form order, the guest’s before a companion’s', () => {
    const blank = needsLines(needsOf({ allergies: ['other'] }));
    const long = needsLines(needsOf({ note: 'x'.repeat(501) }));
    expect(firstFailing([{}, {}, blank])).toEqual({ at: 2, field: 'otherAllergy' });
    expect(firstFailing([long, blank])).toEqual({ at: 0, field: 'note' });
    expect(firstFailing([{}, {}])).toBeNull();
  });

  it('refuses a note over 500 and counts it trimmed', () => {
    expect(needsLines(needsOf({ note: 'x'.repeat(501) }))).toEqual({
      note: 'Shorten the note to 500 characters or fewer.',
    });
    expect(needsLines(needsOf({ note: ` ${'x'.repeat(500)} ` }))).toEqual({});
  });

  it('chips allergies first with Allergy, then diet, access and a note chip that hides the note', () => {
    const needs = needsOf({
      diet: ['vegan'],
      access: ['step_free'],
      allergies: ['peanuts', 'other'],
      otherAllergy: 'Kiwi',
      note: 'Private words',
    });
    expect(needsChips(needs).map((chip) => chip.word)).toEqual([
      'Allergy · Peanuts',
      'Allergy · Kiwi',
      'Vegan',
      'Step-free access',
      'Private note',
    ]);
    expect(needsHeadLine(needs)).toBe('5 noted');
    expect(needsHeadLine(NO_NEEDS)).toBe(NW.noneRecorded);
  });

  it('counts Other allergy as an allergy for the mark', () => {
    expect(hasAllergy(needsOf({ allergies: ['other'], otherAllergy: 'Kiwi' }))).toBe(true);
    expect(hasAllergy(needsOf({ diet: ['vegan'] }))).toBe(false);
  });

  it('saves trimmed, dropping an unticked Other’s words', () => {
    expect(savedNeeds(needsOf({ otherDiet: 'kept?', note: ' hi ' }))).toEqual(
      needsOf({ note: 'hi' }),
    );
  });
});

describe('the Guests row (sc-5519, amended 14 Nov)', () => {
  const rows = rowsOf(GUESTS, 'all', '', 'en', null, true, true);

  it('puts the group after the reply, on a companion’s row too', () => {
    expect(rows.find((p) => p.key === 'musa')?.line).toContain('Bride’s side · 1 companion');
    expect(rows.find((p) => p.key === 'musa.0')?.line).toBe('Coming · Bride’s side');
  });

  it('marks a guest or companion with any allergy recorded', () => {
    expect(rows.find((p) => p.key === 'emeka')?.allergy).toBe(true);
    expect(rows.find((p) => p.key === 'ines.0')?.allergy).toBe(true);
    expect(rows.find((p) => p.key === 'ines')?.allergy).toBe(false);
  });

  it('marks no allergy for anyone without guests.manage, in every list the screen draws', () => {
    const viewer = [
      ...rowsOf(GUESTS, 'all', '', 'en', null, false, false),
      ...rowsOf(GUESTS, 'all', '', 'en', null),
      ...GROUPS.flatMap((group) => groupRows(GUESTS, group, 'en', null, true)),
    ];
    expect(viewer.length).toBeGreaterThan(0);
    expect(viewer.filter((p) => p.allergy === true)).toEqual([]);
    const host = GROUPS.flatMap((group) => groupRows(GUESTS, group, 'en', null, true, true));
    expect(host.some((p) => p.allergy === true)).toBe(true);
  });

  it('marks the same allergy and group under the Changed filter as in every other list', () => {
    const emeka = [{ key: 'emeka', kind: 'needs' as const, at: '2026-11-02T10:00:00Z' }];
    const now = new Date('2026-11-03T10:00:00Z');
    const [host] = changedRows(GUESTS, emeka, '', now, 'en-US', true, true);
    expect(host?.allergy).toBe(true);
    expect(host?.line).toContain('Bride’s side');
    expect(changedRows(GUESTS, emeka, '', now, 'en-US')[0]?.allergy).toBe(false);
  });

  it('draws no group for a guest with none', () => {
    expect(rows.find((p) => p.key === 'nadia')?.line).toBe('No reply');
  });
});
