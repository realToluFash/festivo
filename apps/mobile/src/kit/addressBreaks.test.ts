import { describe, expect, it } from 'vitest';

import {
  addressParts,
  addressRuns,
  atWithItsLastCharacter,
  breakableEmail,
  isLoneAt,
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

  it('never breaks after a hyphen, so a domain no line holds breaks only before its dots', () => {
    expect(addressRuns('ada@students.university-of-lagos.edu.ng')).toEqual([
      'ada@',
      `students${BREAK}.university-${JOIN}of-${JOIN}lagos${BREAK}.edu${BREAK}.ng`,
    ]);
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

describe('a lone @', () => {
  it('takes the character ahead of it down with it, adding nothing a reader sees', () => {
    const local = 'fundacaocomunitariadeoyoeartescontemporaneas@';
    expect(atWithItsLastCharacter(local)).toBe(
      `fundacaocomunitariadeoyoeartescontemporanea${BREAK}s@`,
    );
    expect(atWithItsLastCharacter(local).replaceAll(BREAK, '')).toBe(local);
  });

  it('is a line holding only the @, whatever space Android pads it with', () => {
    expect(isLoneAt('@ ')).toBe(true);
    expect(isLoneAt(`${BREAK}@`)).toBe(true);
    expect(isLoneAt('s@')).toBe(false);
  });
});

describe('addressParts', () => {
  it('splits an address where a line may break, keeping the characters as drawn', () => {
    expect(addressParts('amaka.outside@soirely.test')).toEqual([
      'amaka',
      '.outside@',
      'soirely',
      '.test',
    ]);
  });

  it('is null for anything that is not an address', () => {
    expect(addressParts('Ada Obi')).toBeNull();
  });
});
