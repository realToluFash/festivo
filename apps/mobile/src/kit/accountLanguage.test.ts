import { describe, expect, it } from 'vitest';

import { languageOnSignIn } from './accountLanguage.ts';

describe('the language at sign-in', () => {
  it('saves a choice made on this device while signed out', () => {
    expect(languageOnSignIn('en', 'pt', true)).toEqual({ save: 'pt' });
  });

  it("otherwise opens this device in the account's language", () => {
    expect(languageOnSignIn('es', 'en', false)).toEqual({ apply: 'es' });
    expect(languageOnSignIn('es', null, false)).toEqual({ apply: 'es' });
  });

  it('does nothing when they already agree, or the account has none', () => {
    expect(languageOnSignIn('fr', 'fr', false)).toBeNull();
    expect(languageOnSignIn(null, 'fr', false)).toBeNull();
  });
});
