import { describe, expect, it } from 'vitest';

import { SAMPLE } from '../samples.ts';
import { confirmSays } from './AccountModel.ts';
import {
  cardCounts,
  cardLine,
  changeSays,
  chooseSays,
  emailedCodeSays,
  everywhereAsk,
  keptByRule,
  lastWayIn,
  proofAsks,
  providerLine,
  resetSays,
  RESULTS,
  SECURITY_STATES,
  securityStart,
  securityStateOf,
  setupSays,
  unlinkAsk,
  unlinkNote,
  waysFoot,
  WORDS,
} from './SecurityModel.ts';
import { BREACHED_PASSWORD, DEVICES, type Ways } from './SecuritySample.ts';

const both: Ways = { password: true, Google: true, Apple: false };
const googleOnly: Ways = { password: false, Google: true, Apple: false };
const NEW_PASSWORD = 'a much longer passphrase';

describe('a state link', () => {
  it('opens the state it names, and the page at rest for anything else', () => {
    expect(SECURITY_STATES).toHaveLength(16);
    expect(securityStateOf('forgotSent')).toBe('forgotSent');
    expect(securityStateOf('nonsense')).toBe('rest');
    expect(securityStateOf(undefined)).toBe('rest');
  });

  it('starts each state with what its board drew', () => {
    expect(securityStart('rest')).toMatchObject({ ways: both, twoFactor: true, codesLeft: 8 });
    expect(securityStart('googleOnly')).toMatchObject({ ways: googleOnly, twoFactor: false });
    expect(securityStart('keptByRule')).toMatchObject({
      rules: { providerOnly: true, twoFactor: true },
      opened: 'Google',
    });
    expect(securityStart('link')).toMatchObject({ opened: 'Apple', screen: 'confirm' });
    expect(securityStart('linkPick')).toMatchObject({
      ways: { password: true, Google: false, Apple: false },
      rules: { providerOnly: true },
      opened: null,
      inView: 'Apple',
      screen: null,
      proof: null,
    });
    expect(securityStart('recovery')).toMatchObject({ twoFactor: true, codesLeft: 10 });
    expect(securityStart('setup')).toMatchObject({ twoFactor: false, screen: 'setup' });
    expect(securityStart('signOutDevice')).toMatchObject({ opened: 'safari', ask: 'signOut' });
  });
});

describe('the card', () => {
  it('counts the ways in and the devices, one of each in the singular', () => {
    expect(cardCounts(both, 3)).toBe('2 ways to sign in · 3 devices');
    expect(cardCounts(googleOnly, 1)).toBe('1 way to sign in · 1 device');
  });

  it('says what just happened, else why two-factor matters while it is off', () => {
    expect(cardLine('Done.', false)).toEqual({ kind: 'done', text: 'Done.' });
    expect(cardLine(null, false)).toEqual({ kind: 'todo', text: WORDS.why });
    expect(cardLine(null, true)).toBeNull();
  });
});

describe('ways to sign in', () => {
  it('give each provider its address when it has one', () => {
    expect(providerLine(both, 'Google')).toBe('Linked · folake.adeyemi@gmail.com');
    expect(providerLine({ ...both, Apple: true }, 'Apple')).toBe('Linked');
    expect(providerLine(both, 'Apple')).toBe('Not linked');
  });

  it('keep the last way in, and say why under the section', () => {
    expect(lastWayIn(googleOnly)).toBe('Google');
    expect(lastWayIn(both)).toBeNull();
    expect(waysFoot(googleOnly)).toBe(
      "Google is your only way to sign in, so it can't be removed. Set a password or link another account before removing this one.",
    );
    expect(waysFoot(both)).toBeUndefined();
  });

  it('keep the last provider under a Google-or-Apple rule, password or not', () => {
    const rules = { providerOnly: true, twoFactor: false };

    expect(keptByRule(both, 'Google', rules)).toBe(true);
    expect(keptByRule({ ...both, Apple: true }, 'Google', rules)).toBe(false);
    expect(keptByRule(both, 'Google', { ...rules, providerOnly: false })).toBe(false);
  });

  it('say what stays after unlinking', () => {
    expect(unlinkNote(both, 'Google')).toBe(
      'Devices signed in with Google are signed out. You can still sign in with your password.',
    );
    expect(unlinkNote({ password: false, Google: true, Apple: true }, 'Google')).toMatch(
      /with Apple\.$/u,
    );
    expect(unlinkAsk('Google', both)).toMatchObject({
      title: 'Unlink Google?',
      line: "You'll no longer be able to sign in with Google as folake.adeyemi@gmail.com. Devices signed in with Google are signed out. You can still sign in with your password.",
      keep: 'Keep it linked',
      confirm: 'Unlink Google',
      removes: true,
    });
  });
});

describe('signing out everywhere else', () => {
  it('speaks of one device or of several', () => {
    expect(everywhereAsk(2)).toMatchObject({
      keep: 'Keep them signed in',
      confirm: 'Sign them out',
    });
    expect(everywhereAsk(1).line).toBe(
      'This signs out your other device, whoever has it. It has to sign in again before it can carry on. This device stays signed in.',
    );
    expect(RESULTS.everywhere(2)).toBe('Your 2 other devices are signed out.');
    expect(RESULTS.passwordChanged(1)).toBe('Password changed. Your other device is signed out.');
    expect(RESULTS.passwordChanged(0)).toBe('Password changed. No other device was signed in.');
    expect(RESULTS.signedOut(DEVICES[1]!)).toBe('Safari on macOS is signed out.');
  });
});

describe('confirm it’s you', () => {
  it('asks for the password and, while two-factor is on, a code', () => {
    const link = proofAsks('link', 'Apple', both, true);

    expect(link).toMatchObject({ password: true, code: true, instead: null });
    expect(link.lead).toBe(
      "To link Apple, confirm it's you. You won't be asked again for 5 minutes.",
    );
    expect(link.note).toMatch(/^Next, Apple opens/u);
    expect(proofAsks('link', 'Apple', both, false).code).toBe(false);
    expect(proofAsks('everywhere', 'Google', both, true).codeHelp).toMatch(
      /Two-factor protects this the way it protects signing in\.$/u,
    );
  });

  it('takes a code alone to turn off two-factor or make new codes', () => {
    const off = proofAsks('turnOff', 'Google', both, true);

    expect(off).toMatchObject({ password: false, code: true, lead: WORDS.codeOnlyLead });
    expect(confirmSays('', '', off)).toEqual({
      password: null,
      code: 'Enter a code from your app, or a recovery code.',
      checked: true,
    });
    expect(confirmSays('', '714 320', off).code).toBe(
      'That code did not work. Enter the code your app shows now, or an unused recovery code.',
    );
    expect(confirmSays('', SAMPLE.recovery, off).code).toBeNull();
  });

  it('sends somebody with no password to Google instead', () => {
    const link = proofAsks('link', 'Apple', googleOnly, false);

    expect(link).toMatchObject({ password: false, code: false, instead: 'Google' });
    expect(link.lead).toBe('You sign in with Google, so confirm with Google instead.');
  });
});

describe('passwords', () => {
  it('say each blank, and a short one, before anything is sent', () => {
    expect(changeSays('', '')).toEqual({
      says: { current: 'Enter your current password.', next: 'Enter a new password.' },
      checked: true,
    });
    expect(changeSays(SAMPLE.password, 'too short')).toEqual({
      says: { current: null, next: 'Use at least 15 characters.' },
      checked: true,
    });
  });

  it('then the server’s refusals, one at a time', () => {
    expect(changeSays('wrong', NEW_PASSWORD).says.current).toBe(
      'That is not your current password. Try again, or reset it by email.',
    );
    expect(changeSays(SAMPLE.password, SAMPLE.password).says.next).toBe(
      'That is already your password. Choose a different one.',
    );
    expect(changeSays(SAMPLE.password, BREACHED_PASSWORD).says.next).toBe(
      'This password has appeared in a known data breach. Choose another.',
    );
    expect(changeSays(SAMPLE.password, NEW_PASSWORD).says).toEqual({ current: null, next: null });
  });

  it('check a chosen password the same way', () => {
    expect(chooseSays('').says.password).toBe('Enter a password.');
    expect(chooseSays('short').checked).toBe(true);
    expect(chooseSays(BREACHED_PASSWORD)).toMatchObject({ checked: false });
    expect(chooseSays(NEW_PASSWORD).says.password).toBeNull();
  });
});

describe('codes and addresses', () => {
  it('refuse an emailed code, a setup code and an address in their own words', () => {
    expect(emailedCodeSays('')).toBe('Enter the 6-digit code from the email.');
    expect(emailedCodeSays('482170')).toBe(
      'That code did not match. Check the newest email from Soirely and try again.',
    );
    expect(emailedCodeSays(SAMPLE.code)).toBeNull();
    expect(setupSays('7143')).toBe('The code is 6 digits.');
    expect(setupSays('714 320')).toMatch(/^That code does not match\./u);
    expect(setupSays(SAMPLE.authenticator)).toBeNull();
    expect(resetSays('')).toBe('Enter your email address.');
    expect(resetSays('folake@ire')).toBe(
      'That does not look like an email address. Check it has an @ and a domain.',
    );
    expect(resetSays(SAMPLE.email)).toBeNull();
  });
});
