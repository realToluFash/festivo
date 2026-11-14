import { describe, expect, it } from 'vitest';

import { startOf } from './guest.ts';
import {
  GUEST_PARTY_PAGES,
  GUEST_PARTY_STATES,
  NO_PLACES,
  holdsCompanions,
  partyWords,
  SAMPLE_PARTY,
  comingWith,
  companionIs,
  hasStep,
  labelOf,
  partyLine,
  partyOf,
  renamed,
  renaming,
  toggled,
} from './guestCompanions.ts';

describe('who’s coming with the guest (sc-3779)', () => {
  it('derives each companion from the guest’s answer and the guest’s choice', () => {
    expect(companionIs('coming', true)).toBe('coming');
    expect(companionIs('coming', false)).toBe('notComing');
    for (const answer of ['notComing', 'notSure', null] as const) {
      expect(companionIs(answer, true)).toBe('held');
      expect(companionIs(answer, false)).toBe('held');
    }
  });

  it('makes a row of each place nobody has named, after the named ones, Coming by default (sc-48740)', () => {
    expect(SAMPLE_PARTY.people.map((one) => [one.name, one.coming])).toEqual([
      ['Chidi Okonkwo-Williams', true],
      [null, true],
    ]);
    expect(partyOf(2, [{ key: 'a', name: 'A', by: 'you', coming: true }]).people).toHaveLength(2);
  });

  it('labels a place Your guest with one place in all, else by position, named first (sc-48740)', () => {
    const one = partyOf(1);
    const three = startOf('withYouUnnamed').party;

    expect(labelOf(one, one.people[0]!, 'en')).toBe('Your guest');
    expect(three.people.map((each) => labelOf(three, each, 'en'))).toEqual([
      'Obi Okonkwo',
      'Your guest 2',
      'Your guest 3',
    ]);
    expect(labelOf(three, three.people[2]!, 'fr')).toBe('[Votre invité 3]');
  });

  it('renumbers no other place when one is named or declined (sc-48740)', () => {
    const three = startOf('withYouUnnamed').party;
    const named = renamed({ ...renaming(three, 'place-2'), draft: 'Ifeoma Okonkwo' });
    const both = toggled(named, 'obi');

    expect(named.people[1]).toMatchObject({ name: 'Ifeoma Okonkwo', by: 'you' });
    expect(both.people.map((each) => labelOf(both, each, 'en'))).toEqual([
      'Obi Okonkwo',
      'Ifeoma Okonkwo',
      'Your guest 3',
    ]);
  });

  it('leaves a place unnamed when Done is pressed with the field blank, refusing nothing (sc-48740)', () => {
    const three = startOf('withYouUnnamed').party;
    const left = renamed({ ...renaming(three, 'place-3'), draft: '  ' });

    expect(left.tried).toBe(false);
    expect(left.renaming).toBeNull();
    expect(left.people[2]).toMatchObject({ name: null, by: null, coming: true });
  });

  it('lists and counts every place left Coming, and none marked Not coming (sc-48740)', () => {
    const three = startOf('withYouUnnamed').party;

    expect(partyLine(three, 'en')).toBe(
      'You, Obi Okonkwo, Your guest 2 and Your guest 3 · 4 people',
    );
    expect(partyLine(toggled(three, 'place-3'), 'en')).toBe(
      'You, Obi Okonkwo and Your guest 2 · 3 people',
    );
    expect(partyLine(startOf('checkAlone').party, 'en')).toBe('You · 1 person');
  });

  it('holds an unnamed place like a named one, and keeps the last choice for it (sc-48740)', () => {
    const back = startOf('heldUnnamedThenBack').party;

    for (const one of back.people) expect(companionIs('notSure', one.coming)).toBe('held');
    expect(back.people.map((one) => companionIs('coming', one.coming))).toEqual([
      'coming',
      'coming',
      'notComing',
    ]);
  });

  it('renames a companion the host named, and keeps a blank rename from saving', () => {
    const open = renaming(SAMPLE_PARTY, 'chidi');

    expect(open.draft).toBe('Chidi Okonkwo-Williams');
    expect(renamed({ ...open, draft: ' ' }).tried).toBe(true);
    const done = renamed({ ...open, draft: 'Chidi Okonkwo' });
    expect(done.people[0]).toMatchObject({ name: 'Chidi Okonkwo', by: 'you' });
  });

  it('keeps the guest’s last choice for each companion', () => {
    const off = toggled(SAMPLE_PARTY, 'chidi');

    expect(comingWith(off).map((one) => one.key)).toEqual(['place-2']);
    expect(comingWith(toggled(off, 'chidi'))).toHaveLength(2);
  });

  it('has no step with no places', () => {
    expect(hasStep(NO_PLACES)).toBe(false);
    expect(hasStep(SAMPLE_PARTY)).toBe(true);
    expect(startOf('open').party).toEqual(NO_PLACES);
  });

  it('says the places and the people in words, by plural family, in the guest’s language', () => {
    const en = partyWords('en');
    const fr = partyWords('fr');

    expect(en.places('Adaeze and Tunde', 2)).toBe(
      'Adaeze and Tunde have saved places for you and up to 2 others.',
    );
    expect(en.people(['Chidi Okonkwo-Williams'])).toBe('You and Chidi Okonkwo-Williams · 2 people');
    expect(en.people([])).toBe('You · 1 person');
    expect(en.name('Your guest 2')).toBe('Add a name for Your guest 2');
    expect(fr.people(['Chidi', 'Nneka'])).toBe('[[Vous], Chidi et Nneka · 3 personnes]');
  });

  it('holds companions only when the guest’s own answer holds them', () => {
    const held = { ...startOf('heldNotSure') };

    expect(holdsCompanions(held)).toBe(true);
    expect(holdsCompanions({ ...held, recorded: { answer: 'coming', on: '2026-10-27' } })).toBe(
      false,
    );
    expect(
      holdsCompanions({
        ...startOf('withYouNoPlaces'),
        recorded: { answer: 'notSure', on: '2026-10-27' },
      }),
    ).toBe(false);
  });

  it('links every state once from the demo home', () => {
    expect(GUEST_PARTY_PAGES.flatMap((page) => page.states).map((one) => one.to)).toEqual(
      Object.keys(GUEST_PARTY_STATES).map((state) => `/demo/guest?state=${state}`),
    );
  });
});
