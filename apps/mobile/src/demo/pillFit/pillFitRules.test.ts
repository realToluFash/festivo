import { describe, expect, it } from 'vitest';

import { languageOf, largestOf, organisationOf, sendingOf, waitingOf } from './pillFitRules.ts';

describe('the board’s choices', () => {
  it('falls back to English, QA Organisation and one invitation', () => {
    expect(languageOf('de')).toBe('en');
    expect(languageOf('pt')).toBe('pt');
    expect(organisationOf(undefined)).toBe('qa');
    expect(organisationOf('long')).toBe('long');
    expect(waitingOf(undefined)).toBe(1);
    expect(waitingOf('2')).toBe(2);
    expect(waitingOf('0')).toBe(0);
    expect(sendingOf('decline')).toBe('decline');
    expect(sendingOf('yes')).toBeNull();
    expect(largestOf('largest')).toBe(true);
    expect(largestOf(undefined)).toBe(false);
  });
});
