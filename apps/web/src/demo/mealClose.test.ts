import { describe, expect, it } from 'vitest';

import { type Person, MSW, closeWords, defaultedWords, rowLine } from './mealClose.ts';

const chidi: Person = { name: 'Chidi', companion: false, allergies: [], diets: [] };
const kofi: Person = { ...chidi, name: 'Kofi', companion: true };
const allergic: Person = { ...chidi, allergies: ['sesame'] };

describe('a course’s default on the guest’s meal step (sc-1362)', () => {
  it('says the default will be waiting, until the person answers', () => {
    expect(rowLine('starter', false, false, chidi)).toBe('chooseBy');
    expect(rowLine('starter', true, false, chidi)).toBe('open');
    expect(rowLine('main', false, false, chidi)).toBe('open');
    expect(closeWords('chooseBy', 'Starter', 'Friday, Oct 16', 'Canapé selection', chidi)).toBe(
      'Choose your starter by Friday, Oct 16. If you have not chosen by then, Canapé selection will be waiting for you.',
    );
    expect(closeWords('open', 'Starter', 'Friday, Oct 16', 'Canapé selection', chidi)).toBe(
      'Picks close Friday, Oct 16.',
    );
  });

  it('names a companion, with no pronoun', () => {
    expect(closeWords('chooseBy', 'Starter', 'Friday, Oct 16', 'Canapé selection', kofi)).toBe(
      'Choose a starter for Kofi by Friday, Oct 16. If none is chosen by then, Canapé selection will be waiting for Kofi.',
    );
  });

  it('never mentions the default to someone it leaves out', () => {
    expect(rowLine('starter', false, false, allergic)).toBe('open');
    expect(rowLine('starter', false, true, allergic)).toBe('hostInTouch');
    expect(rowLine('starter', false, false, { ...chidi, diets: ['vegan'] })).toBe('open');
    expect(defaultedWords('hostInTouch', 'Starter', allergic)).toBe(
      '[You hadn’t chosen a starter by then. The host will be in touch about it.]',
    );
    expect(defaultedWords('hostInTouch', 'Starter', { ...kofi, allergies: ['sesame'] })).toBe(
      '[Kofi hadn’t chosen a starter by then. The host will be in touch about it.]',
    );
  });

  it('gives the default after the date to anyone who never answered', () => {
    expect(rowLine('starter', false, true, chidi)).toBe('defaulted');
    expect(rowLine('starter', true, true, chidi)).toBe('closed');
    expect(rowLine('main', false, true, chidi)).toBe('closed');
    expect(defaultedWords('defaulted', 'Starter', chidi)).toBe(MSW.neverChose('Starter'));
    expect(MSW.neverChose('Starter')).toBe('You had not chosen by then, so this is your starter.');
    expect(defaultedWords('closed', 'Starter', chidi)).toBeNull();
  });
});
