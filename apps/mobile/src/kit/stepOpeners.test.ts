import { describe, expect, it } from 'vitest';

import { stepOpeners } from './stepOpeners.ts';

describe('the openers of a card’s steps', () => {
  it('give back the opener a closed step names', () => {
    const openers = stepOpeners<string>();
    openers.ref('signOut.a')('Sign out a');
    openers.ref('signOut.b')('Sign out b');

    expect(openers.target('signOut.b', 'Signed in on')).toBe('Sign out b');
  });

  it('give back the heading when that opener is no longer there', () => {
    const openers = stepOpeners<string>();
    openers.ref('remove.a')('Remove a');
    openers.ref('remove.a')(null);

    expect(openers.target('remove.a', 'Members')).toBe('Members');
  });

  it('give back the heading for a name no opener took', () => {
    const openers = stepOpeners<string>();
    openers.ref('turnOn')('Turn on two-factor');

    expect(openers.target('title', 'Two-factor authentication')).toBe('Two-factor authentication');
  });

  it('give back nothing with no closed step and no heading', () => {
    const openers = stepOpeners<string>();
    openers.ref('change')('Change');

    expect(openers.target(null, null)).toBeNull();
  });

  it('hand each opener the same ref on every render', () => {
    const openers = stepOpeners<string>();

    expect(openers.ref('add')).toBe(openers.ref('add'));
    expect(openers.ref('add')).not.toBe(openers.ref('change'));
  });

  it('follow an opener that comes back after its step', () => {
    const openers = stepOpeners<string>();
    const ref = openers.ref('change');
    ref('Change');
    ref(null);
    ref('Change again');

    expect(openers.target('change', null)).toBe('Change again');
  });
});
