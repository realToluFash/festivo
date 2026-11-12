import { describe, expect, it } from 'vitest';

import {
  CHECK_IN_PAGES,
  CHECK_IN_STATES,
  CW,
  LONG_NAME,
  PEOPLE,
  addWalkIn,
  arrive,
  backOf,
  checkInStart,
  countOf,
  nameMatches,
  nameProblem,
  sameName,
  shownName,
  shownPeople,
  undo,
} from './doorCheckIn.ts';

describe('check-in in the browser (sc-28230)', () => {
  it('finds a name by the start of each word, accents and case ignored', () => {
    expect(nameMatches('Chief Mrs Adaeze Okonkwo-Williams', 'okon ada')).toBe(true);
    expect(nameMatches('Chief Mrs Adaeze Okonkwo-Williams', 'kwo')).toBe(false);
    expect(nameMatches('Yetúndé Adébáyọ̀', 'yetunde ade')).toBe(true);
    expect(sameName('Folasade  Bello', 'folasade bello')).toBe(true);
  });

  it('shows a whole party when anyone in it matches, unnamed companions named by their host', () => {
    const shown = shownPeople(PEOPLE, 'okon ada');

    expect(shown.map((one) => one.id)).toEqual(['adaeze', 'a1', 'a2']);
    expect(shown.map((one) => shownName(one, PEOPLE)).slice(1)).toEqual([
      'Guest of Chief Mrs Adaeze Okonkwo-Williams · 1',
      'Guest of Chief Mrs Adaeze Okonkwo-Williams · 2',
    ]);
    expect(shownPeople(PEOPLE, 'kemi').map((one) => one.id)).toEqual(['bisi', 'kemi']);
  });

  it('checks a walk-in’s name before anything is sent', () => {
    expect(nameProblem('   ')).toBe(CW.blank);
    expect(nameProblem(LONG_NAME)).toBe('Shorten the name to 200 characters or fewer.');
    expect(nameProblem('x'.repeat(200))).toBeNull();
  });

  it('counts the arrived against who is coming, and an arrival or walk-in moves it', () => {
    const before = countOf(PEOPLE);
    const after = countOf(arrive(PEOPLE, 'ngozi', '19:44', 'Samuel Okafor'));

    expect(before.arrived).toBe(0);
    expect(after).toEqual({ arrived: 1, expected: before.expected + 1 });

    const withKunle = addWalkIn(PEOPLE, 'Kunle Adeyemi', '19:42', 'Bisi Adeyemi');
    const kunle = withKunle.find((one) => one.reply === 'walkIn');

    expect(kunle?.arrivedAt).toBe('19:42');
    expect(withKunle.indexOf(kunle ?? PEOPLE[0]!)).toBeLessThan(
      withKunle.findIndex((one) => one.id === 'marie'),
    );
    expect(undo(withKunle, kunle?.id ?? '')).toHaveLength(PEOPLE.length);
  });

  it('goes back to the shift, or for a join code alone to the event by its name', () => {
    expect(backOf('shift')).toEqual({ to: '/demo/check-in/shift', words: 'Your shift' });
    expect(backOf('code').to).toBe('/demo/redeem?state=from-check-in');
  });

  it('opens each state as drawn and lists every one on the demo’s home', () => {
    const links = CHECK_IN_PAGES.flatMap((group) => group.states.map((state) => state.to));

    for (const state of CHECK_IN_STATES)
      expect(links.some((link) => link.includes(`state=${state}`))).toBe(true);
    expect(checkInStart('before_open', 'shift').phase).toBe('before');
    expect(checkInStart('empty_closed', 'shift')).toMatchObject({ phase: 'before', people: [] });
    expect(checkInStart('offline', 'shift')).toMatchObject({ offline: true, failed: 'adaeze' });
    expect(checkInStart('not_signed_in', 'shift').signedOut).toBe(true);
  });
});
