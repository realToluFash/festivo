import { describe, expect, it } from 'vitest';

import { briefingTally, codePoints, fitRules, rulesCount } from './staffRules.ts';

const MAX = 2000;

describe('codePoints', () => {
  it('counts "Ọ̀" as two and an emoji as one', () => {
    expect(codePoints('Ọ̀')).toBe(2);
    expect(codePoints('😀')).toBe(1);
  });
});

describe('fitRules', () => {
  const full = 'a'.repeat(MAX);

  it('does not take a key typed at the limit, and does not call it a cut', () => {
    expect(fitRules(full, `${full.slice(0, 10)}b${full.slice(10)}`, MAX)).toEqual({
      text: full,
      cut: false,
    });
  });

  it('cuts a paste over a selection that lands one over, and says so', () => {
    const before = `${'a'.repeat(MAX - 5)}bbbbb`;
    const pasted = `${'a'.repeat(MAX - 5)}cccccc`;

    expect(fitRules(before, pasted, MAX)).toEqual({ text: pasted.slice(0, MAX), cut: true });
  });

  it('keeps the first 2,000 code points of a paste that goes over', () => {
    const typed = 'a'.repeat(1990) + 'Ọ̀'.repeat(6);
    const fitted = fitRules('a'.repeat(1990), typed, MAX);

    expect(fitted.cut).toBe(true);
    expect(codePoints(fitted.text)).toBe(MAX);
  });

  it('leaves text within the limit as typed', () => {
    expect(fitRules('ab', 'abc', MAX)).toEqual({ text: 'abc', cut: false });
  });
});

describe('rulesCount', () => {
  it('stays quiet below 1,800, counts from there and flags the limit', () => {
    expect(rulesCount('a'.repeat(1799), MAX)).toBeNull();
    expect(rulesCount('a'.repeat(1918), MAX)).toEqual({ n: 1918, limit: false });
    expect(rulesCount('a'.repeat(MAX), MAX)).toEqual({ n: MAX, limit: true });
  });
});

describe('briefingTally', () => {
  it('counts each of the four states', () => {
    const people = (['read', 'sent', 'sent', 'changed', 'none'] as const).map((briefing) => ({
      briefing,
    }));

    expect(briefingTally(people)).toEqual({ read: 1, sent: 2, changed: 1, none: 1 });
  });
});
