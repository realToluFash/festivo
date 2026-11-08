import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { TO_FIGURES } from '../messages/MessagesSample.ts';
import { SAMPLE_GUESTS } from '../events/GuestCounts.ts';
import {
  DOOR_STATES,
  countAfter,
  addedGuest,
  GROUPS,
  GUESTS_ON,
  guestsOpening,
  FILTERS,
  GUESTS_STATES,
  areaStart,
  ASK_OWNER_STATES,
  cardWords,
  companionsAfterEdit,
  countsFrom,
  countsOf,
  doorMatches,
  doorPeople,
  doorShown,
  emailCheck,
  eventOf,
  filterCount,
  filtersFor,
  groupRows,
  guestOf,
  isIn,
  markedInvited,
  OVER_LIMIT_STATES,
  PLAN_STATES,
  nameProblem,
  phoneCheck,
  planRoom,
  recorded,
  replyLine,
  reviewProblems,
  roleOf,
  rowsOf,
  sameNameAs,
} from './GuestsModel.ts';
import {
  DRAFT_GUESTS,
  GUESTS,
  GUEST_LANGUAGES,
  ORGANISATION_LANGUAGE,
  PAUSED_GUESTS,
  PLAN_SAMPLES,
  REPLY_BY,
  WALK_IN,
  languageName,
  replyByOf,
} from './GuestsSample.ts';
import { W, say } from './GuestsWords.ts';

const EN = 'en-US';
const byKey = (key: string) => {
  const g = GUESTS.find((one) => one.key === key);
  if (g == null) throw new Error(key);
  return g;
};

describe('the states, as guests-a-spec §15 names them', () => {
  it('names each once, the door apart', () => {
    expect(new Set(GUESTS_STATES).size).toBe(GUESTS_STATES.length);
    expect(
      GUESTS_STATES.filter((state) => (DOOR_STATES as readonly string[]).includes(state)),
    ).toEqual([]);
    expect(GUESTS_STATES).toHaveLength(92);
    expect(DOOR_STATES).toHaveLength(13);
  });

  it('opens each guest state on the guest the boards draw', () => {
    expect(guestOf('guest')).toBe('emeka');
    expect(guestOf('guestComing')).toBe('kwame');
    expect(guestOf('notYetInvited')).toBe('bisi');
    expect(guestOf('recordReplace')).toBe('ngozi');
    expect(guestOf('editMax')).toBe('musa');
    expect(guestOf('editSeated')).toBe('ines');
    expect(guestOf('edit412')).toBe('kwame');
    expect(guestOf('inUse')).toBeNull();
  });

  it('starts each group with its screen open', () => {
    expect(areaStart('edit412').overlay).toBe('edit');
    expect(areaStart('recordComing').overlay).toBe('record');
    expect(areaStart('addOffline').overlay).toBe('add');
    expect(areaStart('picker').overlay).toBe('picker');
    expect(areaStart('androidPick').overlay).toBe('android');
    expect(areaStart('androidNone').overlay).toBe('android');
    expect(areaStart('editSeated').overlay).toBe('edit');
    expect(areaStart('ownerAsked').overlay).toBe('review');
    expect(areaStart('over250').overlay).toBe('review');
    expect(areaStart('replaceAsk').overlay).toBe('replace');
    expect(areaStart('markRefused').overlay).toBe('mark');
    expect(areaStart('filterNone')).toMatchObject({ filter: 'held', typed: 'marta' });
    expect(areaStart('contactsAdded')).toMatchObject({ added: 23, toast: 'manyAdded' });
  });

  it('reads as door staff or Can view only where the spec says', () => {
    expect(roleOf('staffBefore')).toBe('staff');
    expect(roleOf('staffDoorOpen')).toBe('staff');
    expect(roleOf('guestViewer')).toBe('viewer');
    expect(roleOf('inUse')).toBe('owner');
  });

  it('opens a Draft, a Paused event and the plan limit on their own events', () => {
    expect(eventOf('draft')).toBe('evt-draft-4');
    expect(eventOf('paused')).toBe('evt-party-2');
    expect(eventOf('overLimit')).toBe('evt-ireti-2');
    expect(eventOf('overLimitAsk')).toBe('evt-ireti-2');
    expect(eventOf('ownerAsked')).toBe('evt-ireti-2');
    expect(eventOf('inUse')).toBe('evt-wed-4');
  });
});

describe('the guest’s Language (sc-3790)', () => {
  it('opens each language state on the guest the boards draw, the form where it is one', () => {
    expect(guestOf('languageNotSet')).toBe('kwame');
    expect(guestOf('languageSet')).toBe('sophie');
    expect(guestOf('languageGuestChose')).toBe('ines');
    expect(guestOf('languageEdit')).toBe('ines');
    expect(areaStart('languageEdit').overlay).toBe('edit');
    expect(areaStart('languageAdd').overlay).toBe('add');
    expect(areaStart('languageSet').overlay).toBeNull();
  });

  it('keeps the Language chosen on Add guest on the guest it adds', () => {
    const added = addedGuest('added-1', {
      name: ' Lucas Moreau ',
      email: 'lucas.moreau@orange.fr',
      phone: null,
      language: 'fr',
      companions: ['', 'Chloé Moreau'],
    });

    expect(added).toMatchObject({ name: 'Lucas Moreau', kind: 'notyet', language: 'fr' });
    expect(added.companions).toEqual([{ name: 'Chloé Moreau', kind: 'notyet' }]);
  });

  it('holds the host’s Language and the guest’s own choice on the sample', () => {
    const at = (key: string) => GUESTS.find((g) => g.key === key);

    expect(at('kwame')?.language ?? null).toBeNull();
    expect(at('sophie')?.language).toBe('fr');
    expect(at('ines')).toMatchObject({ language: 'es', chose: 'pt' });
  });

  it('names the four languages in their own names, and says what Not set falls back to', () => {
    expect(GUEST_LANGUAGES.map((one) => one.name)).toEqual([
      'English',
      'Español',
      'Français',
      'Português',
    ]);
    expect(say.notSetLine(languageName(ORGANISATION_LANGUAGE) ?? '')).toBe(
      'Not set · their browser’s language, or English when Soirely does not offer it',
    );
    expect(say.theyChose(languageName('pt') ?? '')).toBe(
      'They chose Português on their page, and that wins.',
    );
  });
});

describe('the counts (sc-99), as Messaging B and Events count the wedding', () => {
  const counts = countsOf(GUESTS);

  it('adds the five replies up to Invited, and Not yet invited to All', () => {
    expect(counts).toMatchObject({
      list: 156,
      invited: 142,
      coming: 96,
      maybe: 10,
      noreply: 21,
      held: 6,
      notcoming: 9,
      notyet: 14,
    });
    expect(counts.coming + counts.maybe + counts.noreply + counts.held + counts.notcoming).toBe(
      counts.invited,
    );
    expect(FILTERS.map((key) => filterCount(key, counts))).toEqual([
      156, 142, 96, 10, 21, 6, 9, 14,
    ]);
  });

  it('says 25 haven’t replied, as Messaging and Events do', () => {
    expect(counts.havent).toBe(25);
    expect(counts.havent).toBe(TO_FIGURES.notReplied.count);
    expect(SAMPLE_GUESTS['evt-wed-4']).toEqual({ invited: 142, coming: 96, replied: 117 });
  });

  it('moves the counts when a reply is recorded, the companion with it', () => {
    const after = GUESTS.map((g) =>
      g.key === 'emeka' ? recorded(g, 'coming', 'By phone', [true], '2026-11-03') : g,
    );
    expect(countsOf(after)).toMatchObject({
      invited: 142,
      coming: 98,
      noreply: 20,
      held: 5,
      havent: 23,
    });
  });

  it('counts a guest marked as invited as No reply, and 23 from contacts as Not yet invited', () => {
    const after = GUESTS.map((g) =>
      g.key === 'bisi' ? markedInvited(g, 'WhatsApp', '2026-11-03') : g,
    );
    expect(countsOf(after)).toMatchObject({ list: 156, invited: 143, noreply: 22, notyet: 13 });
    expect(countsOf(GUESTS, 23)).toMatchObject({ list: 179, notyet: 37 });
  });
});

describe('a list that starts empty', () => {
  it('counts only who was added to it', () => {
    expect(countsFrom([])).toMatchObject({ list: 0, invited: 0, havent: 0 });
    expect(countsFrom([byKey('bisi')])).toMatchObject({ list: 1, notyet: 1, invited: 0 });
    expect(countsFrom([byKey('emeka')])).toMatchObject({
      invited: 2,
      noreply: 1,
      held: 1,
      havent: 2,
    });
  });
});

describe('the list: groups, the filter and search (sc-3772)', () => {
  it('words each row in the guest’s own words', () => {
    expect(replyLine(byKey('kwame'), EN, REPLY_BY)).toBe('Coming · replied Oct 2');
    expect(replyLine(byKey('lucia'), EN, REPLY_BY)).toBe('Not sure yet · asked to decide by Nov 4');
    expect(replyLine(byKey('emeka'), EN, REPLY_BY)).toBe(
      'No reply · invited by Folake Adeyemi, WhatsApp, Oct 9',
    );
    expect(replyLine(byKey('bisi'), EN, REPLY_BY)).toBe('Not yet invited');
    expect(replyLine(byKey('lucia'), 'en-GB', REPLY_BY)).toBe(
      'Not sure yet · asked to decide by 4 Nov',
    );
  });

  it('words Not sure yet by the event’s own Reply by date, or by the day they replied when it has none (sc-3780)', () => {
    expect(replyByOf('evt-wed-4')).toBe(REPLY_BY);
    expect(replyByOf('evt-party-2')).toBeNull();
    const yemi = PAUSED_GUESTS.find((g) => g.key === 'yemi');
    if (yemi == null) throw new Error('yemi');
    expect(replyLine(yemi, EN, replyByOf('evt-party-2'))).toBe('Not sure yet · replied Oct 25');
    expect(rowsOf(PAUSED_GUESTS, 'maybe', '', EN, null).map((row) => row.line)).toEqual([
      'Not sure yet · replied Oct 25',
      'Not sure yet · replied Oct 27',
    ]);
  });

  it('puts a companion under their host, in the host’s group', () => {
    const coming = groupRows(GUESTS, 'coming', EN, REPLY_BY);
    expect(coming.map((row) => row.name)).toEqual([
      'Alhaji Musa Bello',
      'Guest of Alhaji Musa Bello',
      'Amaka Eze',
      'Inês Duarte',
      'Rui Duarte',
    ]);
    expect(coming[0]?.line).toBe('Coming · replied Oct 14 · 1 companion');
    expect(groupRows(GUESTS, 'maybe', EN, REPLY_BY)[1]?.line).toBe(
      'Held · comes only if their host accepts',
    );
  });

  it('filters No reply to the guests, each saying how they were invited', () => {
    const rows = rowsOf(GUESTS, 'noreply', '', EN, REPLY_BY);
    expect(rows.map((row) => row.name)).toEqual([
      'Dr Emeka Nwosu',
      'Joaquín Ruiz',
      'Nadia Haddad',
      'Oluwaseun Ajayi',
      'Tomás Ferreira',
    ]);
    expect(rows[0]?.line).toBe('Invited by Folake Adeyemi, WhatsApp, Oct 9');
    expect(rowsOf(GUESTS, 'held', '', EN, REPLY_BY).map((row) => row.name)).toEqual([
      'Guest of Chief Mrs Folasade Okonkwo-Williams',
      'Adanna Nwosu',
    ]);
  });

  it('finds by name, email address or number, and nobody for kofi or Held and marta', () => {
    expect(rowsOf(GUESTS, 'all', 'okon', EN, REPLY_BY)).toHaveLength(2);
    expect(rowsOf(GUESTS, 'all', 'kofi', EN, REPLY_BY)).toHaveLength(0);
    expect(rowsOf(GUESTS, 'held', 'marta', EN, REPLY_BY)).toHaveLength(0);
    expect(rowsOf(GUESTS, 'all', 'nhs.net', EN, REPLY_BY).map((row) => row.name)).toEqual([
      'Dr Emeka Nwosu',
      'Adanna Nwosu',
    ]);
    expect(rowsOf(GUESTS, 'all', '900412', EN, REPLY_BY).map((row) => row.name)).toEqual([
      'Kwame Mensah',
    ]);
  });
});

describe('on the day and for view-only roles', () => {
  it('adds Walk-in after Coming, so Invited, Walk-in and Not yet invited add up to All', () => {
    const counts = countsOf([...GUESTS, WALK_IN]);
    expect(filtersFor(counts).slice(2, 4)).toEqual(['coming', 'walkin']);
    expect(counts.list).toBe(157);
    expect(counts.invited + counts.walkin + counts.notyet).toBe(counts.list);
    expect(rowsOf([WALK_IN], 'walkin', '', EN, REPLY_BY)[0]?.line).toBe('Walk-in · Arrived 18:20');
    expect(filtersFor(countsOf(GUESTS))).not.toContain('walkin');
  });

  it('finds a guest by name only where contact details are hidden', () => {
    expect(rowsOf(GUESTS, 'all', 'nhs.net', EN, REPLY_BY, false)).toEqual([]);
    expect(rowsOf(GUESTS, 'all', '900412', EN, REPLY_BY, false)).toEqual([]);
    expect(rowsOf(GUESTS, 'all', 'emeka', EN, REPLY_BY, false).map((row) => row.name)).toEqual([
      'Dr Emeka Nwosu',
      'Adanna Nwosu',
    ]);
  });
});

describe('a split family (sc-3773, ux, 8 Nov): each group shows the people it counts', () => {
  const emeka = byKey('emeka');
  const walk = () =>
    GUESTS.map((g) =>
      g.key === 'emeka' ? recorded(g, 'coming', 'By phone', [false], '2026-11-03') : g,
    );

  it('Record a reply for Dr Emeka Nwosu, Coming, Adanna unticked: Coming gains Emeka only', () => {
    const after = walk();
    const coming = groupRows(after, 'coming', EN, REPLY_BY).map((row) => row.name);
    expect(coming).toContain(emeka.name);
    expect(coming).not.toContain('Adanna Nwosu');
    const notComing = groupRows(after, 'notcoming', EN, REPLY_BY);
    expect(notComing.map((row) => [row.name, row.line, row.companion])).toContainEqual([
      'Adanna Nwosu',
      'Guest of Dr Emeka Nwosu',
      false,
    ]);
    expect(groupRows(after, 'noreply', EN, REPLY_BY).map((row) => row.name)).not.toContain(
      emeka.name,
    );
    expect(countsOf(after)).toMatchObject({
      coming: 97,
      notcoming: 10,
      noreply: 20,
      held: 5,
      invited: 142,
    });
  });

  it('counts every row it shows, held companions under their guest apart', () => {
    for (const people of [GUESTS, walk()])
      for (const group of GROUPS) {
        const rows = groupRows(people, group, EN, REPLY_BY, true);
        expect(rows.filter((row) => row.kind === group)).toHaveLength(
          people.filter((g) => g.kind === group).length +
            people.flatMap((g) => g.companions).filter((c) => c.kind === group).length,
        );
        expect(
          rows
            .filter((row) => row.kind !== group)
            .every((row) => row.kind === 'held' && row.companion),
        ).toBe(true);
      }
  });

  it('sends nothing anywhere: no file of Guests reaches for the network', () => {
    const folder = join('src', 'demo', 'guests');
    const reaching = readdirSync(folder)
      .filter((file) => /\.tsx?$/u.test(file) && !file.endsWith('.test.ts'))
      .filter((file) =>
        /\bfetch\(|@soirely\/api-client|XMLHttpRequest/u.test(
          readFileSync(join(folder, file), 'utf8'),
        ),
      );
    expect(reaching).toEqual([]);
  });
});

describe('Events, then an event, then Guests, with no ?state= (the lead on #1463)', () => {
  const open = (event: string) => guestsOpening(null, event, EN);

  it('opens each event the sample names on its own guests, card and step', () => {
    expect(GUESTS_ON).toEqual(['evt-wed-4', 'evt-draft-4', 'evt-party-2']);
    const wedding = open('evt-wed-4');
    expect(wedding.guests).toEqual(GUESTS);
    expect(wedding.card).toMatchObject({
      tags: [],
      says: '96 coming of 142 invited',
      step: 'write',
    });
    expect(wedding.card.line).toContain('Replies close tomorrow, Wed, Nov 4.');

    const party = open('evt-party-2');
    expect(party.state).toBe('paused');
    expect(party.guests).toEqual(PAUSED_GUESTS);
    expect(party.card).toMatchObject({
      tags: [{ word: 'Paused', mark: 'paused' }],
      says: '20 coming of 45 invited',
      line: 'Guests can’t be invited while this event is paused.',
      step: null,
    });

    const draft = open('evt-draft-4');
    expect(draft.state).toBe('draft');
    expect(draft.guests).toEqual(DRAFT_GUESTS);
    expect(draft.card).toMatchObject({
      tags: [{ word: 'Draft', mark: 'draft' }],
      says: '12 on the list',
      line: 'Guests can’t be invited until this event is live.',
      step: 'makeLive',
    });
    for (const one of [party, draft]) expect(one.card.line).not.toContain('Replies close');
  });

  it('is where the screen starts, from the event it is opened on', () => {
    const screen = readFileSync(join('src', 'demo', 'guests', 'GuestsScreen.tsx'), 'utf8');
    expect(screen).toMatch(/guestsOpening\(given, event\.id, locale\)/u);
  });

  it('leaves the Reply by sentence out when the event has none', () => {
    const counts = countsOf(GUESTS);
    expect(cardWords('inUse', 'owner', counts, false, EN, null).line).toBe(
      '25 haven’t replied (21 guests and 4 of their companions).',
    );
  });
});

describe('the card, per state (spec §4)', () => {
  const counts = countsOf(GUESTS);

  it('says how the room stands, and who hasn’t replied in words', () => {
    expect(cardWords('inUse', 'owner', counts, false, EN, REPLY_BY)).toMatchObject({
      says: '96 coming of 142 invited',
      line: '25 haven’t replied (21 guests and 4 of their companions). Replies close tomorrow, Wed, Nov 4.',
      step: 'write',
    });
    expect(cardWords('inUse', 'owner', counts, false, 'en-GB', REPLY_BY).line).toContain(
      'Replies close tomorrow, Wed 4 Nov.',
    );
    expect(cardWords('viewer', 'viewer', counts, false, EN, REPLY_BY).step).toBeNull();
    expect(cardWords('first', 'owner', counts, true, EN, REPLY_BY)).toMatchObject({
      says: 'No guests yet',
      step: 'addGuest',
    });
  });

  it('counts arrivals on the day, with Open check-in all day', () => {
    expect(cardWords('onTheDay', 'owner', counts, false, EN, REPLY_BY)).toMatchObject({
      count: { arrived: 41, expected: 98 },
      step: 'openCheckIn',
    });
    expect(cardWords('secondDay', 'owner', counts, false, EN, REPLY_BY)).toMatchObject({
      line: '96 coming of 142 invited. Check-in is open all day.',
      step: 'openCheckIn',
    });
    expect(cardWords('staffDayBefore', 'staff', counts, false, EN, REPLY_BY)).toMatchObject({
      says: 'Check-in opens at 16:00',
      step: 'openCheckIn',
    });
    expect(cardWords('staffDoorOpen', 'staff', counts, false, EN, REPLY_BY).count).toEqual({
      arrived: 3,
      expected: 98,
    });
    expect(cardWords('staffBefore', 'staff', counts, false, EN, REPLY_BY).step).toBeNull();
  });
});

describe('the forms check before they send', () => {
  it('in main’s words', () => {
    expect(nameProblem('  ')).toBe('Enter their full name.');
    expect(nameProblem('x'.repeat(201))).toBe('Shorten the name to 200 characters or fewer.');
    expect(emailCheck('kwame.mensah@outlook')).toBe(
      'That does not look like an email address. Check it has an @ and a domain.',
    );
    expect(emailCheck('')).toBeNull();
    expect(phoneCheck('7700 90', 'GB')).toBe(
      'That number looks too short for United Kingdom. Check it and try again.',
    );
    expect(phoneCheck('', 'GB')).toBeNull();
  });

  it('says when the name is already on the list, never itself', () => {
    expect(sameNameAs(GUESTS, 'marta silva', 'kwame')?.name).toBe('Marta Silva');
    expect(sameNameAs(GUESTS, 'Kwame Mensah', 'kwame')).toBeNull();
  });
});

describe('From contacts and the plan limit (sc-7579, sc-3930)', () => {
  it('counts what to fix and what is already on the list', () => {
    const row = {
      key: 'a',
      name: 'A',
      country: 'GB',
      number: '0151 23',
      saved: null,
      unreadable: true,
      listed: false,
      numberAt: 0,
      places: 0,
    };
    expect(reviewProblems([row, { ...row, unreadable: false, listed: true }])).toEqual({
      fix: 1,
      listed: 1,
    });
    expect(reviewProblems([{ ...row, number: '' }])).toEqual({ fix: 0, listed: 0 });
  });

  it('says the room left from 80%, and refuses past 100', () => {
    const near = PLAN_SAMPLES.roomLeft;
    expect(planRoom(near.listed, near.picked)).toEqual({ after: 94, room: 6, over: false });
    const over = PLAN_SAMPLES.overLimit;
    expect(planRoom(over.listed, over.picked + over.places)).toEqual({
      after: 106,
      room: -6,
      over: true,
    });
    expect(planRoom(40, 10)).toBeNull();
    expect(Object.values(PLAN_SAMPLES).map((one) => one.listed)).toEqual([80, 80, 80]);
  });

  it('opens every plan state on Ireti at 40, the over-limit ones a subset', () => {
    for (const state of PLAN_STATES) expect(eventOf(state)).toBe('evt-ireti-2');
    expect(OVER_LIMIT_STATES.every((state) => isIn(PLAN_STATES, state))).toBe(true);
    expect(ASK_OWNER_STATES.every((state) => isIn(OVER_LIMIT_STATES, state))).toBe(true);
    expect(isIn(OVER_LIMIT_STATES, 'roomLeft')).toBe(false);
  });

  it('the app plan line is sc-3930’s (sc-7579)', () => {
    expect(W.planInApp).toBe('The plan cannot be changed in the app.');
  });
});

describe('a companion with a seat and a meal (sc-3773)', () => {
  it('says what removing them takes, with their full name and no pronoun', () => {
    const [rui] = byKey('ines').companions;
    expect(rui).toMatchObject({ name: 'Rui Duarte', table: 'Table 4', meal: true });
    expect(say.removeTitle('Rui Duarte')).toBe('Remove Rui Duarte?');
    expect(say.seatedLine('Rui Duarte', 'Table 4', true)).toBe(
      'Rui Duarte has a seat at Table 4 and a meal chosen. Removing this companion frees the seat and drops the meal.',
    );
    expect(byKey('musa').companions.some((one) => one.table != null || one.meal === true)).toBe(
      false,
    );
  });

  it('keeps each companion’s own reply, seat and meal when an earlier one is removed', () => {
    // Inês Duarte with two companions, Coming and Held, both seated; Edit removes the first, then saves.
    const rui = { name: 'Rui Duarte', kind: 'coming', table: 'Table 4', meal: true } as const;
    const beatriz = { name: 'Beatriz Duarte', kind: 'held', table: 'Table 4', meal: true } as const;
    const [, ...left] = [rui, beatriz];

    expect(companionsAfterEdit(['Beatriz Duarte'], left, byKey('ines').kind)).toEqual([beatriz]);
    expect(companionsAfterEdit(['Beatriz Duarte', ''], [...left, null], 'coming')[1]).toEqual({
      name: '',
      kind: 'coming',
    });
  });
});

describe('the door (sc-1454)', () => {
  it('matches word starts in any order', () => {
    expect(doorMatches('Chief Mrs Folasade Okonkwo-Williams', 'okon fola')).toBe(true);
    expect(doorMatches('Chief Mrs Folasade Okonkwo-Williams', 'fola okon')).toBe(true);
    expect(doorMatches('Kwame Mensah', 'ensah')).toBe(false);
  });

  it('keeps a companion with their host, and finds nobody for a walk-in', () => {
    const people = doorPeople();
    expect(doorShown(people, 'okon fola').map((p) => p.name)).toEqual([
      'Chief Mrs Folasade Okonkwo-Williams',
      'Guest of Chief Mrs Folasade Okonkwo-Williams',
    ]);
    expect(doorShown(people, 'Kofi Asante')).toEqual([]);
    expect(people.find((p) => p.key === 'musa')).toMatchObject({
      arrivedAt: '18:12',
      by: 'Ana Souza',
    });
  });
});

describe('the door’s count, one rule for Check-in and the scanner (sc-1454, 5 Nov)', () => {
  it('adds an arrival to attended, and to expected too for anyone not counted', () => {
    expect(countAfter({ arrived: 41, expected: 98 }, 'coming', 1)).toEqual({
      arrived: 42,
      expected: 98,
    });
    expect(countAfter({ arrived: 41, expected: 98 }, 'maybe', 1)).toEqual({
      arrived: 42,
      expected: 99,
    });
    expect(countAfter({ arrived: 41, expected: 98 }, 'walkin', 1)).toEqual({
      arrived: 42,
      expected: 99,
    });
    expect(countAfter({ arrived: 42, expected: 99 }, 'held', -1)).toEqual({
      arrived: 41,
      expected: 98,
    });
  });
});
