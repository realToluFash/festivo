import { describe, expect, it } from 'vitest';

import { CLOCKS, sampleEvent } from './events.ts';
import { SAMPLE_GUESTS } from './guestCounts.ts';
import {
  DRAFT,
  GUESTS_STATES,
  PARTY,
  WALK_IN,
  WEDDING,
  closeLine,
  countsOf,
  guestLineOf,
  guestsCardOf,
  guestsStart,
  handMarked,
  haventLine,
  invitationLine,
  invitesOn,
  linesOf,
  markInvited,
  markNotInvited,
  numberMatches,
  recordReply,
  replyByOf,
  sampleGuests,
  saveGuest,
  seatedOf,
  valuesOf,
  viewBase,
  viewOf,
} from './guests.ts';
import { GW } from './guestsWords.ts';
import { COMING, GUESTS_N, NOT_REPLIED, countOf } from './messages.ts';
import { GROUPS } from './messagesTo.ts';

const NONE = new Set<never>();

describe('the wedding counts as Messaging B counts it (pm, 7 Nov)', () => {
  const counts = countsOf(sampleGuests(WEDDING));

  it('has 156 on the list, 142 invited and 96 coming', () => {
    expect(counts).toMatchObject({
      all: 156,
      invited: 142,
      coming: 96,
      notSure: 10,
      noReply: 21,
      held: 6,
      notComing: 9,
      notYet: 14,
    });
  });

  it('keeps the choices exclusive: the replies add up to Invited, and Invited and Not yet invited to All', () => {
    expect(counts.coming + counts.notSure + counts.noReply + counts.held + counts.notComing).toBe(
      counts.invited,
    );
    expect(counts.invited + counts.notYet).toBe(counts.all);
  });

  it('says 25 haven’t replied: the 21 guests and the 4 companions held behind them', () => {
    expect(counts.havent).toBe(25);
    expect(counts.haventGuests).toBe(21);
    expect(counts.haventCompanions).toBe(4);
  });

  it('agrees with Messaging and with Events’ tiles', () => {
    expect(counts.invited).toBe(GUESTS_N);
    expect(counts.coming).toBe(countOf(COMING, GROUPS));
    expect(counts.havent).toBe(countOf(NOT_REPLIED, GROUPS));
    expect(SAMPLE_GUESTS[WEDDING]).toEqual({
      invited: counts.invited,
      coming: counts.coming,
      replied: counts.invited - counts.havent,
    });
  });

  it('counts the paused party as its tile does, and the draft as 12 nobody has invited', () => {
    const party = countsOf(sampleGuests(PARTY));
    const draft = countsOf(sampleGuests(DRAFT));

    expect(SAMPLE_GUESTS[PARTY]).toEqual({
      invited: party.invited,
      coming: party.coming,
      replied: party.invited - party.havent,
    });
    expect(party.all).toBe(48);
    expect(draft).toMatchObject({ all: 12, invited: 0, notYet: 12 });
  });
});

describe('the list (sc-3772)', () => {
  const list = sampleGuests(WEDDING);
  const replyBy = replyByOf(WEDDING);

  it('groups by reply in sc-3772’s order, the first rows then Show all', () => {
    const { view, shown } = viewOf(list, 'all', '', NONE, replyBy);

    expect(shown).toBe(156);
    if (view.kind !== 'groups') throw new Error('groups');
    expect(view.groups.map((group) => [group.reply, group.count, group.collapsed])).toEqual([
      ['coming', 96, true],
      ['notSure', 10, true],
      ['noReply', 21, true],
      ['notComing', 9, true],
      ['notYet', 14, true],
    ]);
    expect(view.groups[0]?.rows.map((row) => [row.person.name, row.indent, row.line])).toEqual([
      ['Alhaji Musa Bello', false, 'Coming · replied Oct 14 · 1 companion'],
      ['Guest of Alhaji Musa Bello', true, 'Coming'],
      ['Amaka Eze', false, 'Coming · replied Oct 13'],
    ]);
    expect(view.groups[1]?.rows.map((row) => row.line)).toEqual([
      'Not sure yet · asked to decide by Nov 4 · 1 companion',
      'Held · comes only if their host accepts',
      'Not sure yet · asked to decide by Nov 4',
    ]);
  });

  it('opens a group in full with Show all', () => {
    const { view } = viewOf(list, 'all', '', new Set(['coming']), replyBy);

    if (view.kind !== 'groups') throw new Error('groups');
    expect(view.groups[0]?.collapsed).toBe(false);
    expect(view.groups[0]?.rows).toHaveLength(96);
  });

  it('filters to No reply · 21, each row saying how they were invited', () => {
    const { view, shown } = viewOf(list, 'noReply', '', NONE, replyBy);

    expect(shown).toBe(21);
    if (view.kind !== 'rows') throw new Error('rows');
    expect(view.rows[0]).toMatchObject({
      line: 'Invited by Folake Adeyemi, WhatsApp, Oct 9',
      label: 'Dr Emeka Nwosu, No reply, Invited by Folake Adeyemi, WhatsApp, Oct 9',
    });
    expect(view.rows.slice(0, 5).map((row) => row.person.name)).toEqual([
      'Dr Emeka Nwosu',
      'Joaquín Ruiz',
      'Nadia Haddad',
      'Oluwaseun Ajayi',
      'Tomás Ferreira',
    ]);
  });

  it('finds by name only for someone who cannot see contact details (sc-3773, 7 Nov)', () => {
    expect(viewOf(list, 'all', 'nhs.net', NONE, replyBy, false).shown).toBe(0);
    expect(viewOf(list, 'all', '900412', NONE, replyBy, false).shown).toBe(0);
    expect(viewOf(list, 'all', 'nwosu', NONE, replyBy, false).shown).toBe(2);
  });

  it('counts a walk-in as a choice of its own, so the choices add up to All', () => {
    const day = countsOf([...list, WALK_IN]);

    expect(day.walkIn).toBe(1);
    expect(day.invited + day.notYet + day.walkIn).toBe(day.all);
    expect(viewOf([...list, WALK_IN], 'walkIn', '', NONE, replyBy).shown).toBe(1);
  });

  it('finds by name, email address or number, inside the filter', () => {
    expect(viewOf(list, 'all', 'okon', NONE, replyBy).shown).toBe(2);
    expect(viewOf(list, 'all', 'kofi', NONE, replyBy).shown).toBe(0);
    expect(viewOf(list, 'held', 'marta', NONE, replyBy).shown).toBe(0);
    expect(viewOf(list, 'all', 'nhs.net', NONE, replyBy).shown).toBe(1);
    expect(viewOf(list, 'all', '900412', NONE, replyBy).shown).toBe(1);
    expect(viewOf(list, 'all', 'ines', NONE, replyBy).shown).toBe(2);
  });
});

describe('a number, in any form (sc-3772)', () => {
  const musa = { country: 'NG', number: '803 412 7730' };

  it('matches the national form, the international one, and with or without spaces', () => {
    expect(numberMatches(musa, '0803 412 7730')).toBe(true);
    expect(numberMatches(musa, '08034127730')).toBe(true);
    expect(numberMatches(musa, '+234 803 412')).toBe(true);
    expect(numberMatches(musa, '412 7730')).toBe(true);
    expect(numberMatches(musa, '0412 7730')).toBe(false);
  });

  it('counts only from 3 digits, and never with letters in the box', () => {
    expect(numberMatches(musa, '80')).toBe(false);
    expect(numberMatches(musa, 'Table 803')).toBe(false);
    expect(viewOf(sampleGuests(WEDDING), 'all', '0803 412', NONE, null).shown).toBe(1);
  });
});

describe('the card’s words (l10n, 8 Nov)', () => {
  it('says how many of each have not replied, each number in its own form', () => {
    const counts = countsOf(sampleGuests(WEDDING));

    expect(haventLine(counts)).toBe('25 haven’t replied (21 guests and 4 companions).');
    expect(haventLine({ ...counts, havent: 2, haventGuests: 1, haventCompanions: 1 })).toBe(
      '2 haven’t replied (1 guest and 1 companion).',
    );
    expect(haventLine({ ...counts, havent: 1, haventGuests: 1, haventCompanions: 0 })).toBe(
      '1 hasn’t replied.',
    );
  });

  it('says when replies close in one whole sentence per case', () => {
    expect(closeLine('2026-11-04', '2026-11-04')).toBe('Replies close today.');
    expect(closeLine('2026-11-04', '2026-11-03')).toBe('Replies close tomorrow, Wed, Nov 4.');
    expect(closeLine('2026-11-04', '2026-11-01')).toBe('Replies close on Wed, Nov 4.');
    expect(closeLine('2026-11-04', '2026-11-05')).toBe('Replies closed on Wed, Nov 4.');
  });

  it('says Everyone has replied at 0, never 0 haven’t replied, and keeps the close line', () => {
    const wedding = sampleEvent(WEDDING);

    if (wedding == null) throw new Error('wedding');
    const start = guestsStart('everyoneReplied', new URLSearchParams());
    const card = guestsCardOf(wedding, start.list, 'live', start.clock, true);

    expect(card).toMatchObject({
      line: 'Everyone has replied. Replies close tomorrow, Wed, Nov 4.',
      step: null,
    });
  });

  it('opens each close case on the live card', () => {
    const wedding = sampleEvent(WEDDING);

    if (wedding == null) throw new Error('wedding');
    const lineOf = (
      state: 'closesToday' | 'closesLater' | 'repliesClosedLive' | 'noCompanionsWaiting',
    ) => {
      const start = guestsStart(state, new URLSearchParams());

      return guestsCardOf(wedding, start.list, start.card, start.clock, true).line;
    };

    expect(lineOf('closesToday')).toBe(
      '25 haven’t replied (21 guests and 4 companions). Replies close today.',
    );
    expect(lineOf('closesLater')).toBe(
      '25 haven’t replied (21 guests and 4 companions). Replies close on Wed, Nov 4.',
    );
    expect(lineOf('repliesClosedLive')).toBe(
      '25 haven’t replied (21 guests and 4 companions). Replies closed on Wed, Nov 4.',
    );
    expect(lineOf('noCompanionsWaiting')).toBe(
      '21 haven’t replied. Replies close tomorrow, Wed, Nov 4.',
    );
  });
});

describe('the view in the address (sc-3772)', () => {
  it('knows what each state opens on before the address says otherwise', () => {
    expect(viewBase('filtered')).toEqual({ choice: 'noReply', q: '' });
    expect(viewBase('search')).toEqual({ choice: 'all', q: 'okon' });
    expect(viewBase(null)).toEqual({ choice: 'all', q: '' });
  });
});

describe('a split family (sc-3773, Decided 8 Nov)', () => {
  it('shows each group exactly the people it counts after a recorded reply', () => {
    const list = recordReply(
      sampleGuests(WEDDING),
      'emeka',
      'coming',
      'By phone',
      NONE,
      '2026-11-03',
    );
    const all = new Set(['coming', 'notSure', 'noReply', 'notComing', 'notYet'] as const);
    const { view } = viewOf(list, 'all', '', all, replyByOf(WEDDING));

    if (view.kind !== 'groups') throw new Error('groups');
    for (const group of view.groups)
      expect(group.rows.filter((row) => row.person.reply !== 'held')).toHaveLength(group.count);
    const notComing = view.groups.find((group) => group.reply === 'notComing');

    expect(notComing?.rows.find((row) => row.person.name === 'Adanna Nwosu')).toMatchObject({
      indent: false,
      line: 'Guest of Dr Emeka Nwosu',
    });
  });
});

describe('the card (spec §4)', () => {
  const wedding = sampleEvent(WEDDING);

  it('says how the room stands and why it matters now', () => {
    if (wedding == null) throw new Error('wedding');
    const card = guestsCardOf(wedding, sampleGuests(WEDDING), 'live', CLOCKS.rest, true);

    expect(card).toMatchObject({
      says: '96 coming of 142 invited',
      line: '25 haven’t replied (21 guests and 4 companions). Replies close tomorrow, Wed, Nov 4.',
      step: 'write',
    });
    expect(guestsCardOf(wedding, [], 'live', CLOCKS.rest, true)).toMatchObject({
      says: 'No guests yet',
      step: 'add',
    });
    expect(
      guestsCardOf(wedding, sampleGuests(WEDDING), 'live', CLOCKS.rest, false).step,
    ).toBeNull();
  });

  it('counts a recorded reply straight away (sc-3787)', () => {
    const list = recordReply(
      sampleGuests(WEDDING),
      'emeka',
      'coming',
      'By phone',
      new Set(['emeka-c1']),
      '2026-11-03',
    );

    expect(countsOf(list)).toMatchObject({ coming: 98, noReply: 20, held: 5, havent: 23 });
  });

  it('counts a guest marked as invited as owing a reply (sc-3788)', () => {
    const list = markInvited(sampleGuests(WEDDING), 'bisi', 'WhatsApp', '2026-11-03');

    expect(countsOf(list)).toMatchObject({ invited: 143, noReply: 22, notYet: 13 });
  });
});

describe('invited is a fact with a date and a way (sc-3788)', () => {
  const list = sampleGuests(WEDDING);
  const find = (id: string) => {
    const one = list.find((each) => each.id === id);

    if (one == null) throw new Error(id);

    return one;
  };

  it('reads the Invitation’s one line: by hand, by Soirely’s message, or from their reply', () => {
    expect(invitationLine(find('emeka'))).toBe('Invited by Folake Adeyemi, WhatsApp, Oct 9');
    expect(invitationLine(find('marta'))).toBe('Invited by Soirely’s message, Oct 12');
    expect(invitationLine(find('ngozi'))).toBe('Invited when they replied, Oct 2');
    expect(invitationLine(find('bisi'))).toBeNull();
  });

  it('undoes only a mark made by hand, before they reply', () => {
    expect(handMarked(find('emeka'))).toBe(true);
    expect(handMarked(find('marta'))).toBe(false);
    expect(handMarked(find('ngozi'))).toBe(false);
    expect(handMarked(find('tomas'))).toBe(false);
  });

  it('takes the guest and their companion back to Not yet invited, and out of the counts', () => {
    const counts = countsOf(markNotInvited(list, 'emeka'));

    expect(counts).toMatchObject({ invited: 140, noReply: 20, notYet: 16, havent: 23 });
  });

  it('allows the mark only while the event is live or happening now', () => {
    const wedding = sampleEvent(WEDDING);
    const party = sampleEvent(PARTY);
    const draft = sampleEvent(DRAFT);

    if (wedding == null || party == null || draft == null) throw new Error('samples');
    expect(invitesOn(wedding, CLOCKS.rest)).toBe(true);
    expect(invitesOn(wedding, CLOCKS.now)).toBe(true);
    expect(invitesOn(wedding, CLOCKS.finished)).toBe(false);
    expect(invitesOn(party, CLOCKS.rest)).toBe(false);
    expect(invitesOn(draft, CLOCKS.rest)).toBe(false);
    expect(guestsCardOf(wedding, list, 'live', CLOCKS.finished, true)).toMatchObject({
      tags: [{ kind: null, word: 'Finished' }],
      line: 'This event has finished, so guests can’t be invited.',
      step: null,
    });
  });
});

describe('the numbers on Events (sc-23284, sc-3786)', () => {
  it('reads each event in the tiles’ measure, so the rows add up to the tile', () => {
    expect(guestLineOf(WEDDING)).toBe('96 coming · 25 haven’t replied');
    expect(guestLineOf('evt-ireti-2')).toBe('31 coming · 22 haven’t replied');
    expect(guestLineOf('evt-gala-4')).toBe('64 coming · 35 haven’t replied');
    expect(guestLineOf(PARTY)).toBe('20 coming · 19 haven’t replied');
    expect(guestLineOf(DRAFT)).toBeNull();
  });
});

describe('refused before sending (sc-1468)', () => {
  it('says what is wrong with each field, in main’s words', () => {
    expect(
      linesOf({ ...valuesOf(null), name: ' ', email: 'kwame.mensah@outlook', number: '7700 90' }),
    ).toEqual({
      name: 'Enter their full name.',
      email: 'That does not look like an email address. Check it has an @ and a domain.',
      number: 'That number looks too short for United Kingdom. Check it and try again.',
    });
    expect(linesOf({ ...valuesOf(null), name: 'Bimpe Adeyemi' })).toEqual({});
  });
});

describe('a companion with a seat and a meal (sc-3773)', () => {
  const list = sampleGuests(WEDDING);
  const ines = list.find((one) => one.id === 'ines');
  const musa = list.find((one) => one.id === 'musa');

  it('says what removing them takes, in the AC’s words', () => {
    if (ines == null || musa == null)
      throw new Error('the sample has Inês Duarte and Alhaji Musa Bello');
    const seat = seatedOf(ines, 'ines-c1');

    expect(seat).toEqual({ table: 'Table 4', meal: true });
    expect(GW.seatedLine('Rui Duarte', 'Table 4', true)).toBe(
      'Rui Duarte has a seat at Table 4 and a meal chosen. Removing this companion frees the seat and drops the meal.',
    );
    expect(seatedOf(musa, 'musa-c1')).toBeNull();
    expect(seatedOf(ines, null)).toBeNull();
  });

  it('keeps the seat on a companion who stays when the guest is saved', () => {
    const saved = saveGuest(list, 'ines', { ...valuesOf(ines ?? null), email: 'ines@sapo.pt' });

    expect(saved.find((one) => one.id === 'ines')?.companions[0]).toMatchObject({
      name: 'Rui Duarte',
      table: 'Table 4',
      meal: true,
    });
  });
});

describe('every state (spec §15)', () => {
  it('opens each one on the sample, with no time on a 12-hour clock', () => {
    for (const { key } of GUESTS_STATES) {
      const start = guestsStart(key, new URLSearchParams());

      expect(start.event).toMatch(/^evt-/u);
      expect(JSON.stringify(start)).not.toMatch(/\b(AM|PM)\b/u);
    }
  });
});
