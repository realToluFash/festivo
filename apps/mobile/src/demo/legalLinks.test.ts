import { describe, expect, it } from 'vitest';

import { LEGAL_WORDS, legalDoc, linkNote } from './legalLinks.ts';

describe('Terms and Privacy from inside the app (sc-29938)', () => {
  it('uses the web footer’s words', () => {
    expect(LEGAL_WORDS).toEqual({ terms: 'Terms', privacy: 'Privacy' });
  });

  it('opens Terms unless Privacy is asked for', () => {
    expect(legalDoc('privacy')).toBe('privacy');
    expect(legalDoc(undefined)).toBe('terms');
    expect(legalDoc('elsewhere')).toBe('terms');
  });

  it('names the page, the build’s environment and the app’s language, not the phone’s', () => {
    const note = linkNote('privacy', 'fr', 'qa', 'ios');

    expect(note.title).toBe('Demo: Privacy opens in the in-app browser');
    expect(note.address).toBe(
      'The web app’s /privacy, from the place this build talks to (qa), in French, the app’s language.',
    );
    expect(note.browser).toMatch(/^In the app, Safari’s in-app browser opens over the screen/u);
  });

  it('says Android opens a Chrome Custom Tab', () => {
    expect(linkNote('terms', 'en', 'development', 'android').browser).toMatch(
      /a Chrome Custom Tab/u,
    );
  });
});
