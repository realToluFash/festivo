import { init, t } from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';

import en from '../../i18n/locales/en.json';
import { SAMPLE } from '../samples.ts';
import { confirmSays } from './AccountModel.ts';
import {
  changeRefusal,
  chooseRefusal,
  emailedCodeRefusal,
  finishedLine,
  proofAsks,
  SECURITY_STATES,
  sampleDevice,
  securityStart,
  securityStateOf,
  setupRefusal,
  waysOf,
} from './SecurityModel.ts';
import {
  AUTHENTICATOR_KEY,
  BREACHED_PASSWORD,
  DEVICES,
  enrolledKey,
  NEXT_AUTHENTICATOR_KEY,
  otpauthLink,
  type SampleWays,
} from './SecuritySample.ts';

beforeAll(() =>
  init({
    lng: 'en',
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
  }),
);

const both: SampleWays = { password: true, google: true, apple: false };
const googleOnly: SampleWays = { password: false, google: true, apple: false };
const NEW_PASSWORD = 'a much longer passphrase';

describe('two-factor not loaded', () => {
  it('starts with no card, and the line of what had just finished', () => {
    expect(securityStart('rest')).toMatchObject({ factor: 'ready', finished: null });
    expect(securityStart('factorFailed')).toMatchObject({ factor: 'failed', finished: null });
    expect(securityStart('factorFailedLinked')).toMatchObject({
      ways: { password: true, google: true, apple: true },
      factor: 'failed',
      finished: { kind: 'linked', provider: 'apple' },
    });
    expect(securityStart('factorLoadingSignedOut')).toMatchObject({
      factor: 'loading',
      finished: { kind: 'signedOut', device: 'safari' },
      signedOut: ['safari'],
    });
  });

  it("says the finished action in the card's own words", () => {
    expect(finishedLine(null, t)).toBeNull();
    expect(finishedLine({ kind: 'linked', provider: 'apple' }, t)).toBe(
      'Apple is linked. We emailed your verified addresses to say so.',
    );
    expect(finishedLine({ kind: 'signedOut', device: 'safari' }, t)).toBe(
      'Safari on macOS is signed out.',
    );
  });
});

describe('a state link', () => {
  it('opens the state it names, and the page at rest for anything else', () => {
    expect(SECURITY_STATES).toHaveLength(26);
    expect(securityStateOf('forgotSent')).toBe('forgotSent');
    expect(securityStateOf('nonsense')).toBe('rest');
    expect(securityStateOf(undefined)).toBe('rest');
  });

  it('starts each state with what its board drew', () => {
    expect(securityStart('rest')).toMatchObject({ ways: both, twoFactor: true, codesLeft: 8 });
    expect(securityStart('googleOnly')).toMatchObject({ ways: googleOnly, twoFactor: false });
    expect(securityStart('setPasswordExpired')).toMatchObject({
      ways: googleOnly,
      screen: 'setPasswordExpired',
    });
    expect(securityStart('keptByRule')).toMatchObject({
      rules: { providerOnly: SAMPLE.organisation, twoFactor: SAMPLE.organisation },
      opened: 'google',
    });
    expect(securityStart('link')).toMatchObject({ opened: 'apple', screen: 'confirm' });
    expect(securityStart('linkPick')).toMatchObject({
      ways: { password: true, google: false, apple: false },
      rules: { providerOnly: SAMPLE.organisation },
      opened: null,
      inView: 'apple',
      screen: null,
      proof: null,
    });
    expect(securityStart('recovery')).toMatchObject({ twoFactor: true, codesLeft: 10 });
    expect(securityStart('setup')).toMatchObject({ twoFactor: false, screen: 'setup' });
    expect(securityStart('setup')).toMatchObject({ takesLinks: true });
    expect(securityStart('setupNoAuthenticator')).toMatchObject({
      twoFactor: false,
      screen: 'setup',
      takesLinks: false,
    });
    expect(securityStart('setup')).toMatchObject({ enrol: 'ready' });
    expect(securityStart('setupLoading')).toMatchObject({
      twoFactor: false,
      screen: 'setup',
      enrol: 'loading',
      takesLinks: true,
    });
    expect(securityStart('setupFailed')).toMatchObject({
      twoFactor: false,
      screen: 'setup',
      enrol: 'failed',
    });
    expect(securityStart('setupRetried')).toMatchObject({ screen: 'setup', fetched: 2, typed: '' });
    expect(securityStart('setupBack')).toMatchObject({
      screen: 'setup',
      fetched: 1,
      typed: '305',
      handed: true,
      refused: false,
    });
    expect(securityStart('setupOldEntry')).toMatchObject({
      screen: 'setup',
      fetched: 2,
      refused: true,
    });
    expect(setupRefusal(securityStart('setupOldEntry').typed)).not.toBeNull();
    expect(securityStart('rest')).toMatchObject({ fetched: 0, typed: '', handed: false });
    expect(securityStart('signOutDevice')).toMatchObject({ opened: 'safari', ask: 'signOut' });
  });
});

describe('the sample, as the product page takes it', () => {
  it('lists both providers, Google with its address and Apple hiding it', () => {
    expect(waysOf(both).providers).toEqual([
      { provider: 'google', name: 'Google', linked: true, address: 'folake.adeyemi@gmail.com' },
      { provider: 'apple', name: 'Apple', linked: false, address: null },
    ]);
  });

  it('writes each device’s lines', () => {
    const here = sampleDevice(DEVICES[0]!, 'en-US', t);
    const safari = sampleDevice(DEVICES[1]!, 'en-US', t);

    expect(here.line).toBe(t('security.thisDevice'));
    expect(safari.line).toMatch(/^Last used /u);
    expect(safari.signedIn).toContain(DEVICES[1]!.ip);
  });
});

describe('confirm it’s you', () => {
  it('asks for the password and, while two-factor is on, a code', () => {
    const link = proofAsks('link', 'apple', both, true, t);

    expect(link).toMatchObject({ password: true, code: true, instead: null });
    expect(link.note).toBe(t('waysCard.linkNote', { provider: 'Apple', email: SAMPLE.email }));
    expect(proofAsks('link', 'apple', both, false, t).code).toBe(false);
    expect(proofAsks('everywhere', 'google', both, true, t).codeHelp).toBe(
      t('devices.everywhereCodeHelp'),
    );
  });

  it('takes a code alone to turn off two-factor or make new codes', () => {
    const off = proofAsks('turnOff', 'google', both, true, t);

    expect(off).toMatchObject({ password: false, code: true, lead: t('twoFactorCard.offBody') });
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
    const link = proofAsks('link', 'apple', googleOnly, false, t);

    expect(link).toMatchObject({ password: false, code: false, instead: 'Google' });
    expect(link.lead).toBe(t('waysCard.proveWithProvider', { provider: 'Google' }));
  });
});

describe('the sample server', () => {
  it('refuses a change one field at a time', () => {
    expect(changeRefusal('wrong', NEW_PASSWORD)?.field).toBe('current');
    expect(changeRefusal(SAMPLE.password, SAMPLE.password)?.field).toBe('next');
    expect(changeRefusal(SAMPLE.password, BREACHED_PASSWORD)?.message).toMatch(/data breach/u);
    expect(changeRefusal(SAMPLE.password, NEW_PASSWORD)).toBeNull();
  });

  it('refuses a breached chosen password, a wrong emailed code and a wrong setup code', () => {
    expect(chooseRefusal(BREACHED_PASSWORD)?.field).toBe('password');
    expect(chooseRefusal(NEW_PASSWORD)).toBeNull();
    expect(emailedCodeRefusal('482170')).toMatch(/^That code did not match\./u);
    expect(emailedCodeRefusal(SAMPLE.code)).toBeNull();
    expect(setupRefusal('714 320')).toMatch(/^That code does not match\./u);
    expect(setupRefusal(SAMPLE.authenticator)).toBeNull();
  });
});

describe('the key Add to my authenticator app hands over', () => {
  it('is new with every fetch, and named Soirely with the sample email', () => {
    expect(enrolledKey(1)).toBe(AUTHENTICATOR_KEY);
    expect(enrolledKey(2)).toBe(NEXT_AUTHENTICATOR_KEY);
    expect(enrolledKey(3)).toBe(AUTHENTICATOR_KEY);
    expect(otpauthLink(AUTHENTICATOR_KEY)).toBe(
      `otpauth://totp/Soirely:${SAMPLE.email}?secret=${AUTHENTICATOR_KEY}&issuer=Soirely`,
    );
  });
});
