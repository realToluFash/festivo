import { describe, expect, it } from 'vitest';

import { addressRuns, breakAfterAt } from './addressBreaks.ts';

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

describe('breakAfterAt', () => {
  it('lets a sentence break after the @ only', () => {
    expect(breakAfterAt('Remove amaka.outside@soirely.test from this event?')).toBe(
      `Remove amaka.outside@${BREAK}soirely.test from this event?`,
    );
  });
});
