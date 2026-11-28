import { describe, expect, it } from 'vitest';

import { APP_REFUSED, REFUSALS, RW, readOnlyStateOf, wayPastOf } from './readOnlyRules.ts';
import { READ_ONLY_BOARDS } from './ReadOnlyBoards.ts';

describe('read-only in the app (sc-3937)', () => {
  it('titles the refusal with the organisation, keeping its full stop', () => {
    expect(RW.title('Ìrè Events')).toBe('Ìrè Events is read-only until the payment is made.');
  });

  it('never sends billing.manage anywhere from the app', () => {
    expect(wayPastOf('manage')).toBe('inApp');
    expect(wayPastOf('other')).toBe('ask');
    for (const words of [RW.inApp, RW.ask, ...APP_REFUSED.map((one) => REFUSALS[one].safe)])
      expect(words).not.toMatch(/web|website|online|upgrade/iu);
  });

  it('lists only states that exist, and falls back to Make live', () => {
    for (const board of READ_ONLY_BOARDS) {
      const name = board.href.split('state=')[1];
      expect(readOnlyStateOf(name)).toBe(name);
    }
    expect(readOnlyStateOf('nonsense')).toBe('makeLive');
  });
});
