import { describe, expect, it } from 'vitest';

import { addressRuns, breakableEmail, headingAddress } from './addressBreaks.ts';

const BREAK = '​';

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
  it('breaks after the @ and before the dots ahead of it, keeping the domain whole', () => {
    expect(headingAddress('fundacao.comunitaria.de@soirely.test')).toBe(
      `fundacao${BREAK}.comunitaria${BREAK}.de@${BREAK}soirely.test`,
    );
  });

  it('leaves a name or a number to its plain text', () => {
    expect(headingAddress('Ada Obi')).toBeNull();
    expect(headingAddress('+234 803 123 4567')).toBeNull();
  });
});
