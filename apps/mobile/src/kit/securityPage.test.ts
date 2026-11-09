import { ApiError } from '@soirely/api-client';
import { init, t } from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';

import en from '../i18n/locales/en.json';

import {
  askBusy,
  cardCounts,
  cardLine,
  everywhereAsk,
  keptByRule,
  lastWayIn,
  providerLine,
  signOutOthers,
  type Ways,
  unlinkAsk,
  unlinkNote,
  waysFoot,
} from './securityPage.ts';

beforeAll(() =>
  init({
    lng: 'en',
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
  }),
);

const google = {
  provider: 'google',
  name: 'Google',
  linked: true,
  address: 'folake.adeyemi@gmail.com',
} as const;
const apple = { provider: 'apple', name: 'Apple', linked: false, address: null } as const;
const both: Ways = { email: 'folake@example.com', password: true, providers: [google, apple] };
const googleOnly: Ways = { ...both, password: false };
const rules = { providerOnly: 'Ade Events', twoFactor: null };

describe('the card', () => {
  it('counts the ways in and the devices, one of each in the singular', () => {
    expect(cardCounts(both, 3, t)).toBe('2 ways to sign in · 3 devices');
    expect(cardCounts(googleOnly, 1, t)).toBe('1 way to sign in · 1 device');
    expect(cardCounts(both, null, t)).toBe('2 ways to sign in');
  });

  it('says what just happened, else why two-factor matters while it is off', () => {
    expect(cardLine('Done.', false, t)).toEqual({ kind: 'done', text: 'Done.' });
    expect(cardLine(null, false, t)).toEqual({ kind: 'todo', text: t('security.why') });
    expect(cardLine(null, true, t)).toBeNull();
  });
});

describe('ways to sign in', () => {
  it('give each provider its address when it has one', () => {
    expect(providerLine(google, t)).toBe('Linked · folake.adeyemi@gmail.com');
    expect(providerLine({ ...apple, linked: true }, t)).toBe(t('waysCard.linked'));
    expect(providerLine(apple, t)).toBe(t('waysCard.notLinked'));
  });

  it('keep the last way in, and say why under the section', () => {
    expect(lastWayIn(googleOnly)?.provider).toBe('google');
    expect(lastWayIn(both)).toBeNull();
    expect(waysFoot(googleOnly, t)).toBe(t('waysCard.last', { provider: 'Google' }));
    expect(waysFoot(both, t)).toBeUndefined();
  });

  it('keep the last provider under a Google-or-Apple rule, password or not', () => {
    const twoLinked: Ways = { ...both, providers: [google, { ...apple, linked: true }] };

    expect(keptByRule(both, google, rules)).toBe(true);
    expect(keptByRule(twoLinked, google, rules)).toBe(false);
    expect(keptByRule(both, google, { ...rules, providerOnly: null })).toBe(false);
  });

  it('say what stays after unlinking', () => {
    expect(unlinkNote(both, google, t)).toBe(
      `Devices signed in with Google are signed out. ${t('waysCard.stillPassword')}`,
    );
    expect(unlinkNote(googleOnly, google, t)).toMatch(/Apple/u);
    expect(unlinkAsk(google, both, t)).toMatchObject({
      title: t('waysCard.confirmTitle', { provider: 'Google' }),
      confirm: t('waysCard.confirmUnlink', { provider: 'Google' }),
      removes: true,
    });
    expect(unlinkAsk(google, both, t).line).toContain('folake.adeyemi@gmail.com');
  });
});

describe('signing out everywhere else', () => {
  it('speaks of one device or of several, and keeps this one when it can', () => {
    expect(everywhereAsk(1, true, t).line).toBe(
      'This signs out your other device, whoever has it. It has to sign in again before it can carry on. This device stays signed in.',
    );
    expect(everywhereAsk(2, true, t).line).toMatch(/^This signs out your 2 other devices/u);
    expect(everywhereAsk(2, false, t).line).toBe(t('devices.everywhereSelf', { count: 2 }));
  });
});

describe('signing out everywhere else, when it is sent', () => {
  it('says how many went, or that this device went too', async () => {
    expect(await signOutOthers(async () => ({ signedOut: 2, thisDevice: false }), t)).toEqual({
      kind: 'done',
      words: t('devices.everywhereDone', { count: 2 }),
    });
    expect(await signOutOthers(async () => ({ signedOut: 3, thisDevice: true }), t)).toEqual({
      kind: 'endedHere',
    });
  });

  it('turns a dropped connection into words for the sheet, rather than a rejection', async () => {
    const outcome = await signOutOthers(
      () => Promise.reject(new TypeError('Network request failed')),
      t,
    );

    expect(outcome).toEqual({
      kind: 'failed',
      message: en.devices.everywhereFailedBody,
      refused: false,
    });
  });

  it('marks a server refusal, so the rows are read again', async () => {
    const outcome = await signOutOthers(() => Promise.reject(Object.create(ApiError.prototype)), t);

    expect(outcome).toMatchObject({ kind: 'failed', refused: true });
  });
});

describe('the ask while its change is sent', () => {
  it('says Unlinking or Signing out, and nothing for an ask that opens a proof', () => {
    expect(askBusy('unlink', t)).toBe('Unlinking…');
    expect(askBusy('signOut', t)).toBe('Signing out…');
    expect(askBusy('everywhere', t)).toBeUndefined();
  });
});
