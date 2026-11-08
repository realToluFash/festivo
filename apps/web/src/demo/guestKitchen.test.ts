import { describe, expect, it } from 'vitest';

import { startOf } from './guest.ts';
import {
  GUEST_KITCHEN_PAGES,
  type GuestKitchen,
  type Person,
  blankParty,
  changes,
  errorsOf,
  firstError,
  isGuestKitchenState,
  guestKitchenLines,
  guestKitchenStarts,
  mealRows,
  ruledOut,
  saved,
  whoOf,
} from './guestKitchen.ts';
import { guestKitchenWordsFor } from './guestKitchenWords.ts';

const EN = guestKitchenWordsFor('en');
const FR = guestKitchenWordsFor('fr');
const STATES = GUEST_KITCHEN_PAGES.flatMap((page) => page.states).map(
  (one) => /state=(\w+)/u.exec(one.to)?.[1] ?? '',
);

function kitchenOf(state: string): GuestKitchen {
  const kitchen = startOf(state).kitchen;
  if (kitchen == null) throw new Error(`${state} has no kitchen`);

  return kitchen;
}

function party(...people: Partial<Person>[]): GuestKitchen {
  return {
    ...kitchenOf('kitchen'),
    people: blankParty(people.length - 1).map((one, at) => ({ ...one, ...people[at] })),
  };
}

describe('the kitchen step’s states (sc-3778)', () => {
  it('links the board’s Page states, kitchen to refused, and the step’s own, once each', () => {
    expect(STATES).toEqual([
      'kitchen',
      'kitchen_alone',
      'kitchen_picked',
      'kitchen_say_which',
      'kitchen_returning',
      'kitchen_access_removed',
      'check_and_send',
      'kitchen_nothing',
      'kitchen_sending',
      'kitchen_not_sent',
      'meal_ruled_out',
      'refused',
    ]);
    expect(STATES.every(isGuestKitchenState)).toBe(true);
    expect(isGuestKitchenState('check')).toBe(false);
  });

  it('opens each on the step or on Check and send, with one card per person coming', () => {
    expect(startOf('kitchen')).toMatchObject({ view: { kind: 'kitchen' }, recorded: null });
    expect(startOf('kitchen').kitchen?.people.map((one) => one.key)).toEqual(['me', 'c1', 'c2']);
    expect(startOf('kitchen_alone').kitchen?.people).toHaveLength(1);
    expect(startOf('kitchen_alone').companionsComing).toBe(0);
    expect(startOf('check_and_send').view.kind).toBe('check');
    expect(startOf('kitchen_sending').view).toMatchObject({ kind: 'check', busy: true });
    expect(startOf('kitchen_returning')).toMatchObject({
      recorded: { answer: 'coming', on: '2026-10-20' },
      want: 'kitchenHead',
    });
    expect(startOf('refused').kitchen).toMatchObject({ alert: 'refused', refuses: true });
    expect(startOf('meal_ruled_out')).toMatchObject({ want: 'k-meals-c1' });
  });

  it('holds no Sending switch: Not sent comes from its alert alone (lead, 4506149264)', () => {
    expect(Object.keys(kitchenOf('kitchen_not_sent'))).not.toContain('fails');
    expect(kitchenOf('kitchen_not_sent').alert).toBe('net');
  });

  it('keeps every French line in [brackets] until [l10n] writes it (lead, 4506149270)', () => {
    expect(FR.say('changeKitchen')).toBe('[Modifier ce que la cuisine doit savoir]');
    expect(FR.say('changeAnswer')).toBe('[Modifier votre réponse]');
  });

  it('keeps the hosts’ record whole, but never a private note', () => {
    const [me] = kitchenOf('kitchen_returning').record ?? [];

    expect(me).toMatchObject({ host: ['step_free', 'near_exit'], by: 'hosts', on: '2026-10-03' });
    expect(Object.keys(me ?? {})).not.toContain('note');
  });

  it('opens sc-1439’s own Check and send with no kitchen row', () => {
    expect(startOf('check').kitchen).toBeNull();
    expect(guestKitchenStarts('kitchen', { earlier: '2026-10-20', companions: 2 }).view).toEqual({
      kind: 'kitchen',
    });
  });
});

describe('who each card is for (pm and ux, 8 Nov)', () => {
  it('names a companion the host never named by an ordinal, never an invented name', () => {
    const two = blankParty(2);
    const four = blankParty(4);

    expect(two.map((one) => whoOf(one, two, EN))).toEqual([
      'You',
      'Your first guest',
      'Your second guest',
    ]);
    expect(four.map((one) => whoOf(one, four, EN)).slice(3)).toEqual([
      'Your third guest',
      'Your 4th guest',
    ]);
    expect(
      blankParty(10)
        .map((one, _, all) => whoOf(one, all, EN))
        .at(-1),
    ).toBe('Your 10th guest');
    expect(whoOf(blankParty(1)[1]!, blankParty(1), EN)).toBe('Your guest');
    expect(startOf('kitchen').kitchen?.people.every((one) => one.name == null)).toBe(true);
  });

  it('keeps a name the host gave', () => {
    const party = blankParty(2).map((one) =>
      one.key === 'c2' ? { ...one, name: 'Rafael Santos' } : one,
    );

    expect(party.map((one) => whoOf(one, party, EN))).toEqual([
      'You',
      'Your first guest',
      'Rafael Santos',
    ]);
  });
});

describe('the free texts and the 100 characters', () => {
  it('asks Say which for Other allergy with no words, and refuses over 100 after trimming', () => {
    expect(errorsOf(party({ allergies: ['other'] }).people[0]!).other).toBe('empty');
    expect(errorsOf(party({ allergies: ['other'], other: '   ' }).people[0]!).other).toBe('empty');
    expect(
      errorsOf(party({ allergies: ['other'], other: ` ${'x'.repeat(100)} ` }).people[0]!).other,
    ).toBeNull();
    expect(errorsOf(party({ words: 'x'.repeat(101) }).people[0]!).words).toBe('long');
    expect(errorsOf(party({ access: 'é'.repeat(101) }).people[0]!).access).toBe('long');
    expect(errorsOf(party({ other: 'x'.repeat(200) }).people[0]!).other).toBeNull();
  });

  it('sends focus to the first failing field, card by card', () => {
    expect(firstError(kitchenOf('kitchen_say_which'))).toBe('k-other-me');
    expect(firstError(party({}, { words: 'x'.repeat(101) }))).toBe('k-words-c1');
    expect(firstError(kitchenOf('kitchen'))).toBeNull();
  });
});

describe('For the kitchen on Check and send', () => {
  it('writes Allergy for one and Allergies for more, as a list in the reader’s language', () => {
    const lines = guestKitchenLines(
      party(
        { allergies: ['peanuts'] },
        { allergies: ['peanuts', 'sesame', 'other'], other: 'Kiwi' },
      ),
      EN,
    );

    expect(lines[0]?.lines[0]).toEqual({ text: 'Allergy: peanuts', allergy: true, quiet: false });
    expect(lines[1]?.lines[0]?.text).toBe('Allergies: peanuts, sesame, and Kiwi');
    expect(
      guestKitchenLines(party({ allergies: ['peanuts', 'sesame'] }), FR)[0]?.lines[0]?.text,
    ).toBe('[Allergies : arachides et sésame]');
  });

  it('reads in the order a cook does: allergies, diet, the words, the hosts’ access, removed, the access line', () => {
    const [you] = guestKitchenLines(kitchenOf('check_and_send'), EN);

    expect(you?.who).toBe('You');
    expect(you?.lines.map((line) => line.text)).toEqual([
      'Allergies: peanuts and sesame',
      'Halal',
      '“No raw onion, please.”',
      'A seat near an exit',
      'Removed: Step-free access',
    ]);
    expect(guestKitchenLines(kitchenOf('check_and_send'), EN)[1]?.lines.at(-1)?.text).toBe(
      'Getting in and around: A seat I can reach without stairs',
    );
  });

  it('says Nothing to add for a person with nothing, and once when nobody has anything', () => {
    expect(guestKitchenLines(kitchenOf('check_and_send'), EN)[2]).toEqual({
      who: 'Your second guest',
      lines: [{ text: 'Nothing to add', allergy: false, quiet: true }],
    });
    expect(guestKitchenLines(kitchenOf('kitchen_nothing'), EN)).toEqual([
      { who: null, lines: [{ text: 'Nothing to add', allergy: false, quiet: true }] },
    ]);
  });
});

describe('what Send records', () => {
  it('changes nothing for a first reply with nothing chosen, or for Leave it as it is', () => {
    expect(changes(kitchenOf('kitchen'))).toBe(false);
    expect(changes(kitchenOf('kitchen_returning'))).toBe(false);
    expect(changes(kitchenOf('kitchen_access_removed'))).toBe(true);
  });

  it('drops removed rows and empty Others, and dates only the people whose picks changed', () => {
    const [me, first, second] = saved(kitchenOf('check_and_send'), '2026-10-27');

    expect(me).toMatchObject({ host: ['near_exit'], removed: [], by: 'you', on: '2026-10-27' });
    expect(first).toMatchObject({ by: 'you', on: '2026-10-20' });
    expect(second).toMatchObject({ by: null, words: '', access: '' });
  });
});

describe('meal_ruled_out (sc-3907’s rule)', () => {
  it('marks the dish the new allergy rules out, and lets Send go once it is unpicked', () => {
    const kitchen = kitchenOf('meal_ruled_out');
    const first = mealRows(kitchen, EN).find((row) => row.key === 'c1');

    expect(first?.row).toBe('Your first guest’s meals');
    expect(first?.dishes[0]).toEqual({
      name: 'Canapé selection',
      reason: 'Your first guest is allergic to: milk.',
    });
    expect(ruledOut(kitchen)).toBe('k-meals-c1');
    expect(
      ruledOut({
        ...kitchen,
        people: kitchen.people.map((one) => ({ ...one, allergies: [] })),
      }),
    ).toBeNull();
    expect(mealRows(kitchenOf('check_and_send'), EN)).toEqual([]);
  });
});
