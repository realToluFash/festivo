import type { Guest, HeadcountCounts } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';

import { choiceOf, countsOf, viewOf } from './guestView.ts';

function guest(id: string, fullName: string, more: Partial<Guest> = {}): Guest {
  return {
    id,
    fullName,
    group: null,
    email: null,
    mobile: null,
    language: null,
    chosenLanguage: null,
    messageLanguage: null,
    reply: 'noReply',
    repliedAt: null,
    invitation: { at: '2026-11-01T10:00:00+01:00', how: 'whatsapp', by: 'Folake Adeyemi' },
    companions: [],
    ...more,
  };
}

const ADAEZE = guest('g_1', 'Chief Mrs Adaeze Okonkwo-Williams', {
  email: 'adaeze@example.com',
  mobile: '+2348031234567',
  reply: 'coming',
  companions: [{ id: 'c_1', fullName: 'Obi Okonkwo', state: 'coming', namedByGuest: false }],
});
const JOSE = guest('g_2', 'José Ávila', {
  companions: [{ id: 'c_2', fullName: null, state: 'held', namedByGuest: false }],
});
const BEN = guest('g_3', 'Ben Cole', { reply: 'notComing' });
const CLEO = guest('g_4', 'Cleo Dunn');
const DAN = guest('g_5', 'Dan Eke');
const LIST = [JOSE, ADAEZE, BEN, CLEO, DAN];

const HEADCOUNT: HeadcountCounts = {
  onList: 7,
  notYetInvited: 0,
  invited: 7,
  accepted: 2,
  maybe: 0,
  awaitingReply: 3,
  held: 1,
  heldBy: { hostNoReply: 1, hostMaybe: 0, hostNotComing: 0 },
  declined: 1,
};
const COUNTS = countsOf(HEADCOUNT);

describe('the counts above the list (sc-3772)', () => {
  it('reads the headcount, haven’t replied counting the companions held behind a guest who owes one', () => {
    expect(COUNTS).toMatchObject({
      all: 7,
      coming: 2,
      noReply: 3,
      held: 1,
      notComing: 1,
      havent: 4,
      haventGuests: 3,
      haventCompanions: 1,
    });
    expect(COUNTS.coming + COUNTS.maybe + COUNTS.noReply + COUNTS.held + COUNTS.notComing).toBe(
      COUNTS.all,
    );
  });

  it('counts the people nobody has invited apart, so every choice but All still adds up to All (sc-3788)', () => {
    const counts = countsOf({ ...HEADCOUNT, onList: 9, notYetInvited: 2 });
    const { all, coming, maybe, noReply, held, notComing, notYetInvited } = counts;

    expect(notYetInvited).toBe(2);
    expect(coming + maybe + noReply + held + notComing + notYetInvited).toBe(all);
  });

  it('opens on All for anything the address does not know', () => {
    expect(choiceOf(null)).toBe('all');
    expect(choiceOf('held')).toBe('held');
    expect(choiceOf('walkIn')).toBe('all');
  });
});

describe('the list as the choice and the search leave it', () => {
  it('groups All by reply, companions under their guest, each group its first rows then Show all', () => {
    const { view, shown } = viewOf(LIST, COUNTS, 'all', '', new Set());

    expect(shown).toBe(7);
    if (view.kind !== 'groups') throw new Error('expected groups');
    expect(view.groups.map((group) => [group.standing, group.count, group.collapsed])).toEqual([
      ['coming', 2, false],
      ['noReply', 3, true],
      ['notComing', 1, false],
    ]);
    const waiting = view.groups[1]!;

    expect(waiting.rows.map((row) => [row.person.id, row.indent])).toEqual([
      ['g_4', false],
      ['g_5', false],
    ]);
    expect(waiting.next).toBe('g_2');
  });

  it('shows the whole group once Show all is pressed', () => {
    const { view } = viewOf(LIST, COUNTS, 'all', '', new Set(['noReply']));

    if (view.kind !== 'groups') throw new Error('expected groups');
    expect(view.groups[1]!.rows.map((row) => row.person.id)).toEqual(['g_4', 'g_5', 'g_2', 'c_2']);
  });

  it('lists a companion in their own state, apart from their guest, under any other choice', () => {
    const { view, shown } = viewOf(LIST, COUNTS, 'held', '', new Set());

    expect(shown).toBe(1);
    expect(view).toEqual({ kind: 'rows', rows: [expect.objectContaining({ indent: false })] });
  });

  it('finds any part of a name, ignoring case and accents, inside the chosen filter', () => {
    const names = (q: string, choice: 'all' | 'coming' = 'all') => {
      const { view } = viewOf(LIST, COUNTS, choice, q, new Set());

      return view.kind === 'rows' ? view.rows.map((row) => row.person.id) : [];
    };

    expect(names('okonkwo')).toEqual(['g_1', 'c_1']);
    expect(names('jose avila')).toEqual(['g_2']);
    expect(names('ADAEZE@EXAMPLE')).toEqual(['g_1']);
    expect(names('0803 123 4567')).toEqual(['g_1']);
    expect(names('cole', 'coming')).toEqual([]);
  });

  it('keeps a companion under their guest when the search keeps both', () => {
    const { view } = viewOf(LIST, COUNTS, 'all', 'okonkwo', new Set());

    if (view.kind !== 'rows') throw new Error('expected rows');
    expect(view.rows.map((row) => row.indent)).toEqual([false, true]);
  });

  it('lists a guest nobody invited, and their companions, apart from No reply (sc-3788)', () => {
    const EMEKA = guest('g_6', 'Emeka Obi', {
      invitation: null,
      companions: [{ id: 'c_3', fullName: null, state: 'notYetInvited', namedByGuest: false }],
    });
    const list = [...LIST, EMEKA];
    const counts = countsOf({ ...HEADCOUNT, onList: 9, notYetInvited: 2 });
    const ids = (choice: 'noReply' | 'notYetInvited') => {
      const { view } = viewOf(list, counts, choice, '', new Set());

      return view.kind === 'rows' ? view.rows.map((row) => row.person.id) : [];
    };

    expect(ids('noReply')).toEqual(['g_4', 'g_5', 'g_2']);
    expect(ids('notYetInvited')).toEqual(['g_6', 'c_3']);

    const { view } = viewOf(list, counts, 'all', '', new Set());

    if (view.kind !== 'groups') throw new Error('expected groups');
    expect(view.groups.map((group) => [group.standing, group.count])).toEqual([
      ['coming', 2],
      ['noReply', 3],
      ['notComing', 1],
      ['notYetInvited', 2],
    ]);
    expect(view.groups[3]!.rows.map((row) => [row.person.id, row.indent])).toEqual([
      ['g_6', false],
      ['c_3', true],
    ]);
  });

  it('filters 2,000 guests in well under 100 ms', () => {
    const many = Array.from({ length: 2000 }, (_, at) =>
      guest(`g_${at}`, `Guest ${at} Okafor`, { email: `guest${at}@example.com` }),
    );
    const started = performance.now();

    viewOf(many, COUNTS, 'noReply', 'okafor', new Set());
    expect(performance.now() - started).toBeLessThan(100);
  });
});
