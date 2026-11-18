import { describe, expect, it } from 'vitest';

import { opensOver, signInOver } from './signInOver.ts';

describe('whether Sign in opens over something (sc-67606)', () => {
  it('is alone unless its opener says otherwise', () => {
    expect(opensOver('alone')).toBe(false);
  });

  it('is over what was under it when its opener says so, whatever the stack read before the push', () => {
    signInOver(true);

    expect(opensOver('pushed')).toBe(true);
  });

  it('keeps its answer for as long as the route lives', () => {
    signInOver(true);
    opensOver('kept');

    expect(opensOver('kept')).toBe(true);
  });

  it('gives the opener’s word to one Sign in only', () => {
    signInOver(true);
    opensOver('first');

    expect(opensOver('second')).toBe(false);
  });

  it('is alone when its opener says nothing is under it', () => {
    signInOver(true);
    signInOver(false);

    expect(opensOver('replaced')).toBe(false);
  });
});
