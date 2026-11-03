import { describe, expect, it } from 'vitest';

import { demoOpens } from './gate.ts';

describe('the design demo opens only in builds made to try things', () => {
  it.each(['development', 'qa', 'phone'])('opens in %s', (environment) => {
    expect(demoOpens(environment)).toBe(true);
  });

  it.each(['production', 'staging', '', 'Development'])('stays shut in "%s"', (environment) => {
    expect(demoOpens(environment)).toBe(false);
  });
});
