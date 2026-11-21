import { describe, expect, it } from 'vitest';

import { WEDDING_GROUPS, groupedWedding } from './guestGroups.ts';
import { arrivedIn } from './guestRemove.ts';
import { type Reply, WEDDING, sampleGuests, viewOf } from './guests.ts';
import {
  MMW,
  lineWords,
  manyStart,
  moveMany,
  onlyCompanions,
  over,
  removeMany,
  removeQuestion,
  shownGuests,
  undoMany,
} from './guestsMany.ts';

const list = () => groupedWedding(sampleGuests(WEDDING));
const groups = [...WEDDING_GROUPS];
const EVERY_REPLY: ReadonlySet<Reply> = new Set<Reply>([
  'coming',
  'notSure',
  'noReply',
  'notComing',
  'notYet',
  'held',
  'walkIn',
]);

describe('select many guests (sc-3776)', () => {
  it('selects only the guests a filter shows, never a companion on their own', () => {
    const { view } = viewOf(list(), 'all', '', EVERY_REPLY, null, true, false, 'g-work');
    const ids = shownGuests(view);

    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every((id) => list().find((one) => one.id === id)?.group === 'g-work')).toBe(true);
  });

  it('says on the Held tab that companions are selected with their guest', () => {
    const { view } = viewOf(list(), 'held', '', EVERY_REPLY, null);

    expect(shownGuests(view)).toEqual([]);
    expect(onlyCompanions(view)).toBe(true);
  });

  it('moves every selected guest, counting one already there and one removed meanwhile', () => {
    const picked = new Set(['sophie', 'tomas', 'emeka', 'joaquin']);
    const done = moveMany(list(), picked, groups, 'g-bride', ['joaquin']);

    expect(lineWords(done.line)).toEqual([
      '2 moved to Bride’s side.',
      '1 was already in Bride’s side.',
      '1 not changed: someone else removed them.',
    ]);
    expect(done.list.find((one) => one.id === 'sophie')?.group).toBe('g-bride');
    expect(done.list.some((one) => one.id === 'joaquin')).toBe(false);
  });

  it('asks for only the guests it can remove, and names who has arrived', () => {
    const now = arrivedIn(list(), 'kwame', '18:05');
    const asked = removeQuestion(now, new Set(['kwame', 'tomas', 'nadia', 'sophie']));

    expect(asked).toEqual({ goes: 3, companions: 1, replied: 1, stays: ['Kwame Mensah'] });
    expect(MMW.removeTitle(asked.goes, asked.companions)).toBe(
      'Remove 3 guests and their 1 companion?',
    );
    expect(MMW.removeTitle(3, 0)).toBe('Remove 3 guests?');
  });

  it('removes as one action, leaves the arrived, and Undo puts them all back as they were', () => {
    const now = arrivedIn(list(), 'kwame', '18:05');
    const done = removeMany(now, new Set(['kwame', 'tomas', 'nadia', 'sophie']));

    expect(lineWords(done.line)).toEqual([
      '3 guests and 1 companion removed.',
      '1 not changed: Kwame Mensah has arrived.',
      'Undo puts them all back as they were.',
    ]);
    expect(done.list.some((one) => one.id === 'kwame')).toBe(true);
    expect(undoMany(done.list, done.removed).map((one) => one.id)).toEqual(
      now.map((one) => one.id),
    );
  });

  it('removes nothing when everyone selected has arrived, and says so', () => {
    const now = arrivedIn(list(), 'kwame', '18:05');
    const done = removeMany(now, new Set(['kwame']));

    expect(done.removed).toEqual([]);
    expect(lineWords(done.line)).toEqual([
      'Nothing removed.',
      'Kwame Mensah has arrived, so they stay on the list.',
    ]);
  });

  it('acts on up to 2,000 at once', () => {
    expect(over(2000)).toBe(false);
    expect(over(2001)).toBe(true);
  });

  it('starts every state', () => {
    expect(manyStart('viewOnly').manages).toBe(false);
    expect(manyStart('removed').undo?.length).toBe(3);
  });
});
