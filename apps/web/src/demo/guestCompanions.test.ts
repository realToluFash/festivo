import { describe, expect, it } from 'vitest';

import { startOf } from './guest.ts';
import {
  GUEST_PARTY_PAGES,
  GUEST_PARTY_STATES,
  NO_PLACES,
  PARTY_WORDS,
  SAMPLE_PARTY,
  added,
  comingWith,
  companionIs,
  hasStep,
  opened,
  placesLeft,
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

  it('caps the people at the places the host saved', () => {
    expect(placesLeft(SAMPLE_PARTY)).toBe(1);
    const full = added({ ...opened(SAMPLE_PARTY), adding: 'Nneka Okonkwo-Williams' });

    expect(full.people.map((one) => one.name)).toEqual([
      'Chidi Okonkwo-Williams',
      'Nneka Okonkwo-Williams',
    ]);
    expect(placesLeft(full)).toBe(0);
    expect(opened(full).adding).toBeNull();
  });

  it('adds no blank name, and says why', () => {
    const blank = added({ ...opened(SAMPLE_PARTY), adding: '   ' });

    expect(blank.people).toHaveLength(1);
    expect(blank.tried).toBe(true);
    expect(PARTY_WORDS.typeTheirName).toBe('Type their name');
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

    expect(comingWith(off)).toHaveLength(0);
    expect(comingWith(toggled(off, 'chidi'))).toHaveLength(1);
  });

  it('has no step with no places', () => {
    expect(hasStep(NO_PLACES)).toBe(false);
    expect(hasStep(SAMPLE_PARTY)).toBe(true);
    expect(startOf('open').party).toEqual(NO_PLACES);
  });

  it('says the places and the people in words', () => {
    expect(PARTY_WORDS.places('Adaeze and Tunde', 2)).toBe(
      'Adaeze and Tunde have saved places for you and up to 2 others.',
    );
    expect(PARTY_WORDS.add(1)).toBe('Add someone · 1 place left');
    expect(PARTY_WORDS.add(2)).toBe('Add someone · 2 places left');
    expect(PARTY_WORDS.people(['Chidi Okonkwo-Williams'])).toBe(
      'You and Chidi Okonkwo-Williams · 2 people',
    );
    expect(PARTY_WORDS.people([])).toBe('You · 1 person');
  });

  it('links every state once from the demo home', () => {
    expect(GUEST_PARTY_PAGES.flatMap((page) => page.states).map((one) => one.to)).toEqual(
      Object.keys(GUEST_PARTY_STATES).map((state) => `/demo/guest?state=${state}`),
    );
  });
});
