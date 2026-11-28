import { describe, expect, it } from 'vitest';

import { afterTrip, headerVerbShown, limitTime, stillLimited } from './ProviderProofModel.ts';

describe("Confirm it's you with Google or Apple", () => {
  it('shows no header verb until the code step', () => {
    expect(headerVerbShown('trip')).toBe(false);
    expect(headerVerbShown('busy')).toBe(false);
    expect(headerVerbShown('code')).toBe(true);
  });

  it('asks for the code after the trip only with two-factor on', () => {
    expect(afterTrip(true)).toBe('code');
    expect(afterTrip(false)).toBe('proved');
  });

  it('holds a limit until its until, and not a moment after', () => {
    expect(stillLimited(null, 0)).toBe(false);
    expect(stillLimited(1_000, 999)).toBe(true);
    expect(stillLimited(1_000, 1_000)).toBe(false);
  });

  it('names the time 24-hour, to the minute', () => {
    expect(limitTime(new Date(2026, 10, 23, 9, 5, 40).getTime())).toBe('09:05');
    expect(limitTime(new Date(2026, 10, 23, 21, 30).getTime())).toBe('21:30');
  });
});
