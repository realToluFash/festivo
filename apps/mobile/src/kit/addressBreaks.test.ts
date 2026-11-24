import { describe, expect, it } from 'vitest';

import {
  addressRuns,
  breakableEmail,
  headingAddress,
  headingBreaksAfter,
} from './addressBreaks.ts';

const BREAK = '\u200B';
const JOIN = '\u2060';

describe('addressRuns', () => {
  it('splits an address after its @, each side free to break before a dot', () => {
    expect(addressRuns('amaka.outside@soirely.test')).toEqual([
      `amaka${BREAK}.outside@`,
      `soirely${BREAK}.test`,
    ]);
  });

  it('adds nothing a reader sees', () => {
    const runs = addressRuns('fundacao.comunitaria.de.oyo.e.artes@soirely.test') ?? [];
    expect(runs.join('').replaceAll(BREAK, '')).toBe(
      'fundacao.comunitaria.de.oyo.e.artes@soirely.test',
    );
  });

  it('leaves a name or a number as it is', () => {
    expect(addressRuns('Ada Obi')).toBeNull();
    expect(addressRuns('+234 803 123 4567')).toBeNull();
    expect(addressRuns('@ada')).toBeNull();
  });
});

describe('breakableEmail', () => {
  it('lets an address break after the @ and nowhere new', () => {
    expect(breakableEmail('camille.moreau@traiteur-lumiere.fr')).toBe(
      `camille.moreau@${BREAK}traiteur-lumiere.fr`,
    );
  });

  it('lets a sentence carrying one break after the @ only', () => {
    expect(breakableEmail('Remove amaka.outside@soirely.test from this event?')).toBe(
      `Remove amaka.outside@${BREAK}soirely.test from this event?`,
    );
  });
});

describe('headingAddress', () => {
  it('lays an address out whole first, free to break after its @', () => {
    expect(headingAddress('fundacao.comunitaria.de@soirely.test')).toBe(
      `fundacao.comunitaria.de@${BREAK}soirely.test`,
    );
  });

  it('once it takes two lines, breaks after the @ and before the dots ahead of it, keeping the domain whole', () => {
    expect(headingAddress('fundacao.comunitaria.de.oyo.e.artes@soirely.test', 'at')).toBe(
      `fundacao${BREAK}.comunitaria${BREAK}.de${BREAK}.oyo${BREAK}.e${BREAK}.artes@\nsoirely.test`,
    );
  });

  it('breaks a domain no line can hold before its dots, never after a hyphen', () => {
    expect(headingAddress('ada@students.university-of-lagos.edu.ng', 'wide')).toBe(
      `ada@\nstudents${BREAK}.university-${JOIN}of-${JOIN}lagos${BREAK}.edu${BREAK}.ng`,
    );
  });

  it('shows only the address', () => {
    const name = 'ada@students.university-of-lagos.edu.ng';
    expect(headingAddress(name, 'wide')?.replace(/[\u200B\u2060\n]/g, '')).toBe(name);
  });

  it('leaves a name or a number to its plain text', () => {
    expect(headingAddress('Ada Obi')).toBeNull();
    expect(headingAddress('+234 803 123 4567')).toBeNull();
  });
});

describe('headingBreaksAfter', () => {
  const name = 'ada@students.university-of-lagos.edu.ng';

  it('keeps an address that fits one line whole', () => {
    expect(headingBreaksAfter('a@b.co', 'none', ['a@\u200Bb.co'])).toBe('none');
  });

  it('breaks after the @ once the address takes two lines, even where the domain fits beside the last part', () => {
    expect(
      headingBreaksAfter('fundacao.comunitaria.de.oyo.e.artes@soirely.test', 'none', [
        'fundacao.comunitaria.de',
        `.oyo.e.artes@${BREAK}soirely.test`,
      ]),
    ).toBe('at');
  });

  it('stays at the @ while one line holds the whole domain', () => {
    expect(headingBreaksAfter(name, 'at', ['ada@\n', 'students.university-of-lagos.edu.ng'])).toBe(
      'at',
    );
  });

  it('breaks the domain before its dots once it runs past a line', () => {
    expect(
      headingBreaksAfter(name, 'at', [
        'ada@\n',
        `students.university-${JOIN}of-${JOIN}la`,
        'gos.edu.ng',
      ]),
    ).toBe('wide');
  });
});
