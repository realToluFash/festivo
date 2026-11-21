import { describe, expect, it } from 'vitest';

import {
  LINK_STATES,
  MASKED,
  STAFF_SIGN_IN_PAGES,
  S,
  authenticatorLine,
  linkStart,
  linkStateOf,
  maskedNumber,
  twoFactorFor,
} from './staffSignIn.ts';

describe('a staff link opened in the browser, signed out (sc-4235)', () => {
  it('masks the number in code: the country’s code and the last four digits', () => {
    expect(MASKED).toBe('+351 ••• ••• 4512');
    expect(maskedNumber('+2348031234512', 'NG')).toBe('+234 ••• ••• 4512');
    expect(S.sendTo(MASKED)).toBe('We’ll send a code to +351 ••• ••• 4512.');
  });

  it('names nobody before the code: the organiser’s lines carry no name', () => {
    expect(S.askToChange).toBe('Ask the event’s organiser to change it on the roster.');
    expect(S.askToAdd).toBe('Ask the event’s organiser to add your mobile number to the roster.');
  });

  it('checks the authenticator code before it is sent', () => {
    expect(authenticatorLine('')).toBe('Enter the 6-digit code from your app.');
    expect(authenticatorLine('7143')).toBe('The code is 6 digits.');
    expect(authenticatorLine('714302')).toBeNull();
  });

  it('names the masked number in the two-factor line when the account has no email', () => {
    expect(S.tfIntro(twoFactorFor('two-factor'))).toBe(
      'Open your authenticator app and enter the 6-digit code for bisi.adeyemi@gmail.com.',
    );
    expect(S.tfIntro(twoFactorFor('two-factor-no-email'))).toBe(
      'Open your authenticator app and enter the 6-digit code for +351 ••• ••• 4512.',
    );
    expect(linkStart('two-factor-no-email').twoFactor).toBe(true);
  });

  it('opens every listed state, and an unknown one on Confirm it’s you', () => {
    expect(linkStateOf('nonsense')).toBe('confirm');
    for (const state of LINK_STATES) expect(linkStateOf(state)).toBe(state);
    expect(linkStart('two-factor').twoFactor).toBe(true);
    expect(linkStart('signed-out').step).toMatchObject({ kind: 'confirm', signedOut: true });

    const listed = STAFF_SIGN_IN_PAGES.flatMap((page) => page.states.map((one) => one.to));
    for (const state of LINK_STATES) expect(listed).toContain(`/demo/staff-sign-in?state=${state}`);
  });
});
