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
import {
  ACCESS,
  ALLERGENS,
  DIETS,
  GUEST_KITCHEN_ENGLISH,
  GUEST_KITCHEN_NAMES,
  GUEST_KITCHEN_SAMPLES,
  guestKitchenWordsFor,
} from './guestKitchenWords.ts';
import { landed } from './useGuestKitchen.ts';

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

describe('who each card is for (pm and ux, 8 Nov; lead, 4506198443)', () => {
  it('names a companion the host never named Your guest, or Your guest 1, 2 … , never an invented name', () => {
    const two = blankParty(2);

    expect(two.map((one) => whoOf(one, two, EN))).toEqual(['You', 'Your guest 1', 'Your guest 2']);
    expect(
      blankParty(10)
        .map((one, _, all) => whoOf(one, all, EN))
        .at(-1),
    ).toBe('Your guest 10');
    expect(whoOf(blankParty(1)[1]!, blankParty(1), EN)).toBe('Your guest');
    expect(startOf('kitchen').kitchen?.people.every((one) => one.name == null)).toBe(true);
  });

  it('carries the number into every language', () => {
    const two = blankParty(2);
    const second = (lang: 'fr' | 'es' | 'pt') => whoOf(two[2]!, two, guestKitchenWordsFor(lang));

    expect(second('fr')).toBe('[Votre invité 2]');
    expect(second('es')).toBe('[Su invitado 2]');
    expect(second('pt')).toBe('[O seu convidado 2]');
  });

  it('keeps a name the host gave', () => {
    const party = blankParty(2).map((one) =>
      one.key === 'c2' ? { ...one, name: 'Rafael Santos' } : one,
    );

    expect(party.map((one) => whoOf(one, party, EN))).toEqual([
      'You',
      'Your guest 1',
      'Rafael Santos',
    ]);
  });
});

describe('the samples in every language (lead, 4506198441 and 4506242145)', () => {
  const languages = ['fr', 'es', 'pt'] as const;
  const english = Object.keys(GUEST_KITCHEN_ENGLISH).filter((key) => key !== 'notBuilt');

  it.each(languages)(
    '%s has every English line, each in [brackets] but the quote marks',
    (lang) => {
      const sample: Record<string, string> = GUEST_KITCHEN_SAMPLES[lang];

      expect(Object.keys(sample).sort()).toEqual([...english].sort());
      for (const key of english.filter((one) => one !== 'quote')) {
        expect([key, sample[key]?.startsWith('[') && sample[key]?.endsWith(']')]).toEqual([
          key,
          true,
        ]);
      }
    },
  );

  it.each(languages)('%s names every allergen, diet and access need', (lang) => {
    const names = GUEST_KITCHEN_NAMES[lang];

    expect(Object.keys(names.allergens)).toEqual([...ALLERGENS]);
    expect(Object.keys(names.diets)).toEqual([...DIETS]);
    expect(Object.keys(names.access)).toEqual([...ACCESS]);
    const samples = [
      ...(lang === 'fr' ? [names.allergens.other] : Object.values(names.allergens)),
      ...Object.values(names.diets),
      ...Object.values(names.access),
    ];
    expect(samples.filter((one) => !one.startsWith('['))).toEqual([]);
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
      who: 'Your guest 2',
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

describe('the saved line after the date to answer by (lead, 4506198447)', () => {
  it('goes only when a later Send is refused, and stays when one lands', () => {
    const late = startOf('refused');
    const kitchen = { ...late.kitchen!, from: 'closed' as const, saved: true };

    expect(landed({ ...late, kitchen }).kitchen?.saved).toBe(false);
    expect(landed({ ...late, kitchen: { ...kitchen, refuses: false } }).kitchen?.saved).toBe(true);
  });
});

describe('meal_ruled_out (sc-3907’s rule)', () => {
  it('marks the dish the new allergy rules out, and lets Send go once it is unpicked', () => {
    const kitchen = kitchenOf('meal_ruled_out');
    const first = mealRows(kitchen, EN).find((row) => row.key === 'c1');

    expect(first?.row).toBe('Your guest 1’s meals');
    expect(first?.dishes[0]).toEqual({
      name: 'Canapé selection',
      reason: 'Your guest 1 is allergic to: milk.',
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
