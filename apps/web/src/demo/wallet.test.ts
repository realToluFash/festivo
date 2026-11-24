import { describe, expect, it } from 'vitest';

import { EVENT, GUEST } from './guest.ts';
import {
  ISSUER,
  WALLET_PAGES,
  WALLET_WORDS,
  deviceOf,
  faceOf,
  namesOf,
  offerFor,
  passContent,
} from './wallet.ts';

describe('the wallet button (sc-9956)', () => {
  it('offers Apple on an iPhone, Google on an Android phone, and the line anywhere else', () => {
    expect(offerFor('ios')).toBe('apple');
    expect(offerFor('android')).toBe('google');
    expect(offerFor('desktop')).toBe('line');
  });

  it('takes the device from the query, and otherwise an iPhone on a phone and a computer elsewhere', () => {
    expect(deviceOf('android', 'desk')).toBe('android');
    expect(deviceOf(null, 'phone')).toBe('ios');
    expect(deviceOf(null, 'small')).toBe('ios');
    expect(deviceOf(null, 'upright')).toBe('desktop');
    expect(deviceOf(null, 'side')).toBe('desktop');
    expect(deviceOf('ipad', 'desk')).toBe('desktop');
  });
});

describe('the pass (sc-9956)', () => {
  it('carries the issuer, the event, the guest, the door words and the code, and nothing else', () => {
    const pass = passContent('apple', 'page', 'en', 'Show this at the door');

    expect(pass).toEqual({
      kind: 'live',
      issuer: 'Soirely',
      event: EVENT.name,
      guest: GUEST,
      door: 'Show this at the door',
      code: true,
    });
  });

  it('names Soirely the same in every language', () => {
    for (const lang of ['en', 'es', 'fr', 'pt'] as const) {
      expect(passContent('google', 'page', lang, 'x').issuer).toBe(ISSUER);
    }
  });

  it('keeps the long-names fixture whole for the details', () => {
    const pass = passContent('google-details', 'long', 'fr', 'x');

    expect(pass.kind === 'live' && pass.guest).toBe(
      'Chief Olusegun Adebayo-Williams and Dr. Funmilayo Adebayo-Williams',
    );
  });

  it('empties the Google pass to the issuer, one line and Expired, with no names and no code', () => {
    const pass = passContent('google-emptied', 'page', 'en', 'Show this at the door');

    expect(pass).toEqual({
      kind: 'emptied',
      issuer: 'Soirely',
      header: 'This pass is no longer valid',
      expired: 'Expired',
    });
  });

  it('reads an unknown face, names or language as the default', () => {
    expect(faceOf('wallet')).toBe('apple');
    expect(namesOf('short')).toBe('page');
  });

  it('has every word in every language', () => {
    const keys = Object.keys(WALLET_WORDS.en).sort();

    for (const lang of ['es', 'fr', 'pt'] as const) {
      expect(Object.keys(WALLET_WORDS[lang]).sort()).toEqual(keys);
    }
  });

  it('links every face and device from the demo home', () => {
    const links = WALLET_PAGES.flatMap((page) => page.states.map((state) => state.to));

    for (const face of ['apple', 'apple-back', 'google', 'google-details', 'google-emptied']) {
      expect(links).toContain(`/demo/wallet-pass?face=${face}`);
    }
    for (const device of ['ios', 'android', 'desktop']) {
      expect(links).toContain(`/demo/guest?state=coming&wallet=${device}`);
    }
    expect(new Set(links).size).toBe(links.length);
  });
});
