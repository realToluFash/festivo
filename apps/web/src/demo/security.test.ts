import { describe, expect, it } from 'vitest';

import { HOLDS } from './general.ts';
import { SAMPLE } from './rules.ts';
import {
  CODES_MADE,
  DEVICES,
  NEW_CODES,
  NEW_PASSWORD,
  RECOVERY_CODES,
  REST_PAGE,
  RESULT_WORDS,
  SECURITY_PAGES,
  SECURITY_STATES,
  SHORT_PASSWORD,
  WEB_MOMENTS,
  WRONG_PASSWORD,
  cardOf,
  changeProblems,
  chooseRefusal,
  deviceLine,
  emailedCodeRefusal,
  forgotRefusal,
  heldStepPath,
  keptByRule,
  onlyWayIn,
  proveAsks,
  proveProblems,
  securityStart,
  setupRefusal,
  stillLine,
  waysCount,
  yourSecurity,
} from './security.ts';
import { VIEWERS } from './settings.ts';

const rest = securityStart('');
const email = SAMPLE.email;

describe('Security’s sample (sc-30223)', () => {
  it('opens an unknown state on the page at rest: a password and Google, two-factor on, three devices', () => {
    expect(securityStart('nowhere')).toEqual(rest);
    expect(rest.page).toEqual(REST_PAGE);
    expect(cardOf(rest.page, null)).toEqual({
      says: 'Two-factor is on',
      summary: '2 ways to sign in · 3 devices',
      line: null,
      done: false,
      step: null,
    });
    expect(DEVICES.filter((device) => device.here).map((device) => device.name)).toEqual([
      'Safari on macOS',
    ]);
  });

  it('opens every app state and every web moment on something other than the page at rest', () => {
    expect(SECURITY_STATES).toEqual([
      'googleOnly',
      'keptByRule',
      'changePassword',
      'setPassword',
      'setPasswordExpired',
      'link',
      'unlink',
      'setup',
      'recovery',
      'newCodes',
      'turnOff',
      'signOutDevice',
      'everywhere',
      'forgot',
      'forgotSent',
    ]);
    for (const state of [...SECURITY_STATES, ...WEB_MOMENTS])
      expect(securityStart(state), state).not.toEqual(rest);
  });

  it('links every state and moment from the demo home, once', () => {
    const linked = SECURITY_PAGES.flatMap((group) => group.states).map(
      (link) => new URL(link.to, 'http://demo').searchParams.get('state') ?? '',
    );

    expect([...linked].sort()).toEqual(['', '', '', ...SECURITY_STATES, ...WEB_MOMENTS].sort());
  });

  it('is the viewer’s own sign-in, the same page for every role', () => {
    expect(securityStart('', VIEWERS.julien).page).toEqual(rest.page);
    expect(yourSecurity(VIEWERS.ana).email).toBe(VIEWERS.ana.id);
    expect(yourSecurity(VIEWERS.folake).address.Google).toBe(SAMPLE.otherEmail);
  });

  it('asks you to turn two-factor on from the card while it is off', () => {
    const off = securityStart('googleOnly').page;

    expect(cardOf(off, null)).toMatchObject({
      says: 'Two-factor is off',
      summary: '1 way to sign in · 3 devices',
      step: 'Turn on two-factor',
    });
    expect(cardOf(off, RESULT_WORDS.on).done).toBe(true);
  });

  it('keeps the last way in, and the last provider under the organisation’s rule', () => {
    const googleOnly = securityStart('googleOnly').page;
    const kept = securityStart('keptByRule').page;

    expect(onlyWayIn(googleOnly.ways, 'Google')).toBe(true);
    expect(onlyWayIn(rest.page.ways, 'Google')).toBe(false);
    expect(keptByRule(kept, 'Google')).toBe(true);
    expect(keptByRule(rest.page, 'Google')).toBe(false);
    expect(waysCount(rest.page.ways)).toBe(2);
    expect(stillLine(rest.page.ways, 'Google')).toBe('You can still sign in with your password.');
    expect(stillLine({ password: false, Google: true, Apple: true }, 'Google')).toBe(
      'You can still sign in with Apple.',
    );
  });

  it('says this device is in use and the others when they were last used', () => {
    const [here, phone] = DEVICES;

    expect(deviceLine(here, 'en-US')).toBe('This device · in use now');
    expect(deviceLine(phone, 'en-US')).toBe('Last used Nov 3 at 6:40 PM');
  });

  it('refuses a change of password in the product’s order', () => {
    expect(changeProblems('', '')).toEqual({
      current: 'Enter your current password.',
      next: 'Enter a new password.',
    });
    expect(changeProblems(SAMPLE.password, SHORT_PASSWORD).next).toBe(
      'Use at least 15 characters.',
    );
    expect(changeProblems(WRONG_PASSWORD, NEW_PASSWORD).current).toMatch(/not your current/);
    expect(changeProblems(SAMPLE.password, SAMPLE.password).next).toMatch(/already your password/);
    expect(changeProblems(SAMPLE.password, SAMPLE.breachedPassword).next).toMatch(/breach/);
    expect(changeProblems(SAMPLE.password, NEW_PASSWORD)).toEqual({});
    expect(chooseRefusal('')).toBe('Enter a password.');
    expect(chooseRefusal(NEW_PASSWORD)).toBeNull();
  });

  it('checks the emailed code, the authenticator code and the reset address', () => {
    expect(emailedCodeRefusal('')).not.toBeNull();
    expect(emailedCodeRefusal('482 170')).toMatch(/did not match/);
    expect(emailedCodeRefusal(SAMPLE.code)).toBeNull();
    expect(setupRefusal('714 320')).toMatch(/does not match/);
    expect(setupRefusal(SAMPLE.authenticator)).toBeNull();
    expect(forgotRefusal('')).toBe('Enter your email address.');
    expect(forgotRefusal('folake@ire')).not.toBeNull();
    expect(forgotRefusal(email)).toBeNull();
  });

  it('asks a proof for what the product asks: a password and a code, or a code alone', () => {
    const unlink = proveAsks('unlink', 'Google', rest.page, email);
    const off = proveAsks('turnOff', null, rest.page, email);
    const noPassword = proveAsks('everywhere', null, securityStart('googleOnly').page, email);

    expect(unlink).toMatchObject({ password: true, code: true, provider: null });
    expect(unlink.lead).toBe(
      "To unlink Google, confirm it's you. You won't be asked again for 5 minutes.",
    );
    expect(off).toMatchObject({ password: false, code: true });
    expect(noPassword).toMatchObject({ password: false, provider: 'Google', code: false });
    expect(proveProblems(unlink, 'unlink', '', '')).toEqual({
      password: 'Enter your password.',
      code: 'Enter a code from your app, or a recovery code.',
    });
    expect(proveProblems(off, 'turnOff', '', '714 320').code).toMatch(/unused recovery code/);
    expect(proveProblems(unlink, 'unlink', SAMPLE.password, SAMPLE.recovery)).toEqual({});
  });

  it('makes ten codes each time, the first set starting with the sample’s recovery code', () => {
    expect(RECOVERY_CODES).toHaveLength(CODES_MADE);
    expect(NEW_CODES).toHaveLength(CODES_MADE);
    expect(RECOVERY_CODES[0]).toBe(SAMPLE.recovery);
    expect(NEW_CODES.some((code) => RECOVERY_CODES.includes(code))).toBe(false);
  });

  it('sends a held step to Security, at the step it names', () => {
    expect(heldStepPath(HOLDS.twoFactor.step, VIEWERS.julien)).toBe(
      '/demo/settings/security?as=julien&state=setup',
    );
    expect(heldStepPath(HOLDS.linking.step, VIEWERS.julien)).toBe(
      '/demo/settings/security?as=julien&state=linkPick',
    );
    const pick = securityStart('linkPick');
    expect(pick).toMatchObject({
      page: { ways: { password: true, Google: false, Apple: false }, twoFactorRule: false },
      open: null,
      dialog: null,
    });
    expect(keptByRule(pick.page, 'Google')).toBe(false);
    expect(keptByRule({ ...pick.page, ways: { ...pick.page.ways, Google: true } }, 'Google')).toBe(
      true,
    );
    expect(heldStepPath('Something else', VIEWERS.folake)).toBe('/demo/settings/security');
  });
});
