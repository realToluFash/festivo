import { describe, expect, it } from 'vitest';

import { startOf } from './guest.ts';
import {
  COMPANION_NAMES,
  KITCHEN_PAGES,
  type Kitchen,
  type Person,
  blankParty,
  changes,
  errorsOf,
  firstError,
  isKitchenState,
  kitchenLines,
  kitchenStarts,
  mealRows,
  ruledOut,
  saved,
} from './kitchen.ts';
import { kitchenWordsFor } from './kitchenWords.ts';

const EN = kitchenWordsFor('en');
const FR = kitchenWordsFor('fr');
const STATES = KITCHEN_PAGES.flatMap((page) => page.states).map(
  (one) => /state=(\w+)/u.exec(one.to)?.[1] ?? '',
);

function kitchenOf(state: string): Kitchen {
  const kitchen = startOf(state).kitchen;
  if (kitchen == null) throw new Error(`${state} has no kitchen`);

  return kitchen;
}

function party(...people: Partial<Person>[]): Kitchen {
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
    expect(STATES.every(isKitchenState)).toBe(true);
    expect(isKitchenState('check')).toBe(false);
  });

  it('opens each on the step or on Check and send, with one card per person coming', () => {
    expect(startOf('kitchen')).toMatchObject({ view: { kind: 'kitchen' }, recorded: null });
    expect(startOf('kitchen').kitchen?.people.map((one) => one.name)).toEqual([
      null,
      ...COMPANION_NAMES,
    ]);
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

  it('keeps the hosts’ record whole, but never a private note', () => {
    const [me] = kitchenOf('kitchen_returning').record ?? [];

    expect(me).toMatchObject({ host: ['step_free', 'near_exit'], by: 'hosts', on: '2026-10-03' });
    expect(Object.keys(me ?? {})).not.toContain('note');
  });

  it('opens sc-1439’s own Check and send with no kitchen row', () => {
    expect(startOf('check').kitchen).toBeNull();
    expect(kitchenStarts('kitchen', { earlier: '2026-10-20' }).view).toEqual({ kind: 'kitchen' });
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
    const lines = kitchenLines(
      party(
        { allergies: ['peanuts'] },
        { allergies: ['peanuts', 'sesame', 'other'], other: 'Kiwi' },
      ),
      EN,
    );

    expect(lines[0]?.lines[0]).toEqual({ text: 'Allergy: peanuts', allergy: true, quiet: false });
    expect(lines[1]?.lines[0]?.text).toBe('Allergies: peanuts, sesame, and Kiwi');
    expect(kitchenLines(party({ allergies: ['peanuts', 'sesame'] }), FR)[0]?.lines[0]?.text).toBe(
      '[Allergies : arachides et sésame]',
    );
  });

  it('reads in the order a cook does: allergies, diet, the words, the hosts’ access, removed, the access line', () => {
    const [you] = kitchenLines(kitchenOf('check_and_send'), EN);

    expect(you?.who).toBe('You');
    expect(you?.lines.map((line) => line.text)).toEqual([
      'Allergies: peanuts and sesame',
      'Halal',
      '“No raw onion, please.”',
      'A seat near an exit',
      'Removed: Step-free access',
    ]);
    expect(kitchenLines(kitchenOf('check_and_send'), EN)[1]?.lines.at(-1)?.text).toBe(
      'Getting in and around: A seat I can reach without stairs',
    );
  });

  it('says Nothing to add for a person with nothing, and once when nobody has anything', () => {
    expect(kitchenLines(kitchenOf('check_and_send'), EN)[2]).toEqual({
      who: COMPANION_NAMES[1],
      lines: [{ text: 'Nothing to add', allergy: false, quiet: true }],
    });
    expect(kitchenLines(kitchenOf('kitchen_nothing'), EN)).toEqual([
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
    const [me, ana, rafael] = saved(kitchenOf('check_and_send'), '2026-10-27');

    expect(me).toMatchObject({ host: ['near_exit'], removed: [], by: 'you', on: '2026-10-27' });
    expect(ana).toMatchObject({ by: 'you', on: '2026-10-20' });
    expect(rafael).toMatchObject({ by: null, words: '', access: '' });
  });
});

describe('meal_ruled_out (sc-3907’s rule)', () => {
  it('marks the dish the new allergy rules out, and lets Send go once it is unpicked', () => {
    const kitchen = kitchenOf('meal_ruled_out');
    const ana = mealRows(kitchen, EN).find((row) => row.key === 'c1');

    expect(ana?.row).toBe('Ana Paula Albuquerque’s meals');
    expect(ana?.dishes[0]).toEqual({
      name: 'Canapé selection',
      reason: 'Ana Paula Albuquerque is allergic to: milk.',
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
