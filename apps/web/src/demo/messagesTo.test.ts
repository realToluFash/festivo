import { describe, expect, it } from 'vitest';

import { GUESTS_N, MESSAGE_STATES, MW, sectionsOf, seedOf } from './messages.ts';
import {
  type Audience,
  type Book,
  type Condition,
  type ToPick,
  BOOK,
  GROUPS,
  LONG_NAME,
  POPULATION,
  SAVED,
  SAVED_MOST,
  TAKEN_NAME,
  TW,
  bookOf,
  changedFrom,
  channelsOf,
  chipWords,
  conditionWord,
  countIn,
  countOf,
  nameCount,
  nameLength,
  nameRefusal,
  pickOf,
  refusalOf,
  saveRefusal,
  savedInOrder,
  sentToHead,
  sentToRow,
  toLine,
  toSeedOf,
  viewOf,
  whoMatches,
  withName,
  withSaved,
  without,
} from './messagesTo.ts';

const KEYS = [
  'whoAdded',
  'whoNone',
  'whoNoneSend',
  'whoMany',
  'whoGroup',
  'whoCounting',
  'seeWho',
  'whoNobody',
  'whoRenamed',
  'whoDeleted',
  'saveName',
  'saveBlank',
  'saveLong',
  'saveTaken',
  'saveFull',
  'saved',
  'savedChanged',
  'audienceMenu',
  'rename',
  'renamed',
  'deleteAsk',
  'deletedPicked',
  'noManage',
  'resolvedRow',
  'nobodyDue',
] as const;

const who = (conditions: readonly Condition[], pick?: ToPick): Audience => ({
  kind: 'who',
  conditions,
  ...(pick == null ? {} : { pick }),
});
const deleted: Book = bookOf('whoDeleted');

describe('Who gets it: conditions, counted live (sc-3957)', () => {
  it('appends its 25 states after sc-3942’s, each with a seed', () => {
    const keys = MESSAGE_STATES.map((one) => one.key);

    expect(keys.slice(-KEYS.length)).toEqual([...KEYS]);
    for (const key of KEYS) expect(seedOf(key), key).toBeDefined();
    for (const key of KEYS.filter((one) => one !== 'noManage')) {
      expect(toSeedOf(key), key).not.toBeNull();
    }
  });

  it('counts the sample as STATES.md gives it, every condition matched (AND)', () => {
    expect(POPULATION).toHaveLength(GUESTS_N);
    expect(new Set(POPULATION.map((guest) => guest.name)).size).toBe(GUESTS_N);
    expect(countOf({ kind: 'all' })).toBe(142);
    expect(countIn(['coming'])).toBe(96);
    expect(countIn(['notReplied'])).toBe(25);
    expect(countIn(['coming', 'hasMobile'])).toBe(31);
    expect(countIn(['notReplied', 'group:family'])).toBe(6);
    expect(countIn(['group:family', 'group:work'])).toBe(0);
    expect(countIn(['coming', 'hasEmail'])).toBe(92);
    expect(countIn(['group:family'])).toBe(18);
    expect(countIn(['group:oldSchool'])).toBe(12);
    expect(countIn(['group:work'])).toBe(22);
    expect(countIn(['group:none'])).toBe(90);
    expect(countIn(['replied'])).toBe(115);
    expect(countIn(['invited'])).toBe(140);
    expect(countIn(['notInvited'])).toBe(2);
    expect(countIn(['notInvited', 'notReplied'])).toBe(0);
    expect(countIn(['group:work', 'notReplied'])).toBe(0);
    expect(countIn([])).toBeNull();
    expect(SAVED.map((one) => countIn(one.conditions))).toEqual([31, 12, 6, 25, 20]);
  });

  it('lists who matches A to Z, each with the channels they have', () => {
    expect(
      whoMatches(['notReplied', 'group:family']).map(
        (guest) => `${guest.name} · ${channelsOf(guest)}`,
      ),
    ).toEqual([
      'Abena Mensah · Email address · Mobile number',
      'Chidi Okeke · Email address',
      'Grace Adeyemi · Mobile number',
      'Ifeoma Bello · Email address · Mobile number',
      'Kofi Asante · No email address or mobile number',
      'Yetunde Bakare · Email address',
    ]);
  });

  it('follows its group: a renamed one by its new name, a deleted one matching nobody', () => {
    const renamed = bookOf('whoRenamed').groups;

    expect(conditionWord('group:family')).toBe('Is in group: Family');
    expect(conditionWord('group:family', renamed)).toBe('Is in group: Bride’s family');
    expect(countIn(['group:family', 'notReplied'], renamed)).toBe(6);
    expect(conditionWord('group:family', deleted.groups)).toBe('Is in group: Family (deleted)');
    expect(conditionWord('group:none')).toBe('Is in group: No group');
    expect(countIn(['group:family'], deleted.groups)).toBe(0);
    expect(countIn(['group:none'], deleted.groups)).toBe(108);
    expect(refusalOf(who(['group:family', 'notReplied']), deleted.groups)).toBe(
      'Nobody matches, because Family was deleted. Remove that condition or choose another audience to send it.',
    );
  });

  it('refuses Send with no condition or nobody, never All guests', () => {
    expect(refusalOf({ kind: 'all' })).toBeNull();
    expect(refusalOf(who([]))).toBe(MW.noCondition);
    expect(refusalOf(who(['group:family', 'group:work']))).toBe(MW.nobodyLine);
    expect(refusalOf(who(['coming', 'hasMobile']))).toBeNull();
  });

  it('words the chip by what was picked, and Guests who… once a condition changed', () => {
    expect(chipWords({ kind: 'all' })).toBe('All guests · 142');
    expect(chipWords(who(['coming'], 'coming'))).toBe('Coming · 96');
    expect(chipWords(who(['notReplied'], 'notReplied'))).toBe('Hasn’t replied · 25');
    expect(chipWords(who(['coming', 'hasMobile'], 'coming'))).toBe('Guests who… · 31 guests');
    expect(chipWords(who(['coming', 'hasMobile'], 'saved:comingMobile'))).toBe(
      'Coming, with a mobile · 31 guests',
    );
    expect(chipWords(who(['hasMobile', 'coming'], 'saved:comingMobile'))).toBe(
      'Coming, with a mobile · 31 guests',
    );
    expect(chipWords(who(['coming', 'hasEmail'], 'saved:comingMobile'))).toBe(
      'Guests who… · 92 guests',
    );
    expect(chipWords(who([]))).toBe('Guests who…');
    expect(chipWords(who(['group:family', 'group:work']))).toBe('Guests who… · Nobody matches');
    expect(toLine(who(['notReplied', 'group:family']))).toBe(
      'To Guests who… Hasn’t replied · Is in group: Family',
    );
  });

  it('says a change to a picked audience is this message’s only, and a deleted pick is Guests who…', () => {
    expect(changedFrom(who(['coming', 'hasMobile'], 'coming'), BOOK)).toBe(true);
    expect(changedFrom(who(['coming'], 'coming'), BOOK)).toBe(false);
    expect(changedFrom(who(['coming', 'hasMobile']), BOOK)).toBe(false);
    expect(pickOf(who(['coming', 'hasMobile'], 'saved:comingMobile'), BOOK)).toBe(
      'saved:comingMobile',
    );
    expect(
      pickOf(who(['coming', 'hasMobile'], 'saved:comingMobile'), without(BOOK, 'comingMobile')),
    ).toBe('who');
    expect(pickOf({ kind: 'all' }, BOOK)).toBe('all');
  });

  it('lists saved audiences A to Z, ignoring case and accents', () => {
    expect(savedInOrder(SAVED).map((one) => one.name)).toEqual([
      'Coming, with a mobile',
      'Elodie’s friends',
      'Family who haven’t replied',
      'No reply yet',
      'Work, has an email',
    ]);
    expect(savedInOrder(bookOf('renamed').saved)[1]?.name).toBe('Élodie’s friends');
    expect(savedInOrder(withSaved(BOOK, 'apples', ['coming']).book.saved)[0]?.name).toBe('apples');
  });

  it('takes a group name’s rules: required, at most 60, unique ignoring case and accents', () => {
    expect(nameLength(LONG_NAME)).toBe(61);
    expect(nameCount(LONG_NAME)).toBe('61 of 60 characters');
    expect(nameCount('  ')).toBe('0 of 60 characters');
    expect(nameRefusal('', SAVED)).toBe(TW.nameBlank);
    expect(nameRefusal('   ', SAVED)).toBe('Enter a name for this audience.');
    expect(nameRefusal(LONG_NAME, SAVED)).toBe(
      'A saved audience’s name can be up to 60 characters.',
    );
    expect(nameRefusal(LONG_NAME.slice(0, 60), SAVED)).toBeNull();
    expect(nameRefusal(TAKEN_NAME, SAVED)).toBe(
      'There’s already a saved audience called Elodie’s friends.',
    );
    expect(nameRefusal('Élodie’s friends', SAVED, 'elodie')).toBeNull();
    expect(nameRefusal('no reply yet', SAVED, 'elodie')).toBe(
      'There’s already a saved audience called No reply yet.',
    );
    expect(saveRefusal('Reminder: Family, no reply', BOOK)).toBeNull();
    expect(bookOf('saveFull').saved).toHaveLength(SAVED_MOST);
    expect(saveRefusal('Reminder: Family, no reply', bookOf('saveFull'))).toBe(
      'This event has 20 saved audiences, the most it can have. Delete one to save another.',
    );
  });

  it('saves conditions, not people, renames and deletes, all in memory', () => {
    const made = withSaved(BOOK, '  Reminder: Family, no reply ', ['notReplied', 'group:family']);
    const again = withSaved(without(made.book, 'elodie'), 'Another', ['coming']);

    expect(made.book.saved.at(-1)).toEqual({
      id: made.id,
      name: 'Reminder: Family, no reply',
      conditions: ['notReplied', 'group:family'],
    });
    expect(again.id).not.toBe(made.id);
    expect(withName(BOOK, 'elodie', 'Élodie’s friends').saved[1]?.name).toBe('Élodie’s friends');
    expect(without(BOOK, 'comingMobile').saved).toHaveLength(4);
    expect(BOOK.saved).toHaveLength(5);
    expect(GROUPS.map((group) => group.name)).toEqual(['Family', 'Old school friends', 'Work']);
  });

  it('opens each state’s popover on its own field, menu or question', () => {
    expect(viewOf('saveLong', BOOK).saving).toEqual({
      name: LONG_NAME,
      wrong: 'A saved audience’s name can be up to 60 characters.',
    });
    expect(viewOf('saveTaken', BOOK).saving?.wrong).toBe(
      'There’s already a saved audience called Elodie’s friends.',
    );
    expect(viewOf('saveFull', bookOf('saveFull')).saving?.wrong).toBe(TW.full);
    expect(viewOf('deleteAsk', BOOK)).toMatchObject({ deleting: 'comingMobile', first: 'keep' });
    expect(viewOf('whoCounting', BOOK).counting).toBe(true);
    expect(viewOf('to', BOOK).first).toBeNull();
  });

  it('keeps a message sent to conditions in Done, with who it resolved to when it went', () => {
    const resolved = seedOf('resolvedRow');
    const done = sectionsOf(resolved).done.map((row) => row.id);

    expect(done).toContain('replyBy');
    expect(done).toContain('reminder');
    expect(done.indexOf('reminder')).toBeLessThan(done.indexOf('replyBy'));
    expect(sentToRow('replyBy')).toMatchObject({
      title: 'Please reply by Friday',
      line: 'To Guests who… Hasn’t replied · Is in group: Family · Reached 6 of 6',
      when: 'Oct 29',
      tag: null,
    });
    expect(sentToRow('reminder').line).toBe('Nobody matched when it was due, 09:00 · sent nothing');
    expect(sentToHead('replyBy')).toBe('To Guests who… Hasn’t replied · Is in group: Family · 6');
    expect(sentToHead('reminder')).toBe('To Guests who… Is in group: Work · Hasn’t replied');
    expect(sectionsOf(seedOf('inUse')).done.map((row) => row.id)).not.toContain('replyBy');
  });
});
