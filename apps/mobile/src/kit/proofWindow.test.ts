import { createInstance } from 'i18next';
import { describe, expect, it, vi } from 'vitest';

import en from '../i18n/locales/en.json';
import es from '../i18n/locales/es.json';
import fr from '../i18n/locales/fr.json';
import pt from '../i18n/locales/pt.json';
import { codeHelp, proveIntro } from './waysProof.ts';

vi.mock('@soirely/domain', async (original) => ({
  ...(await original<typeof import('@soirely/domain')>()),
  PROOF_MINUTES: 1,
}));

async function english() {
  const i18n = createInstance();
  await i18n.init({
    lng: 'en',
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
  });

  return i18n.t;
}

describe('the proof window, counted from PROOF_MINUTES (sc-2197)', () => {
  it('says a one-minute window on step one, for linking and for unlinking', async () => {
    const t = await english();

    expect(proveIntro(t, 'link', 'Google')).toBe(
      "To link Google, confirm it's you. You won't be asked again for a minute.",
    );
    expect(proveIntro(t, 'unlink', 'Apple')).toBe(
      "To unlink Apple, confirm it's you. You won't be asked again for a minute.",
    );
  });

  it('says a one-minute window under the code field on step two', async () => {
    const t = await english();

    expect(codeHelp(t, 'Google')).toEqual([
      'From your authenticator app, or one of your recovery codes.',
      "A wrong code doesn't send you back to Google. Your Google sign-in lasts a minute.",
    ]);
    expect(codeHelp(t, null)).toBe('From your authenticator app, or one of your recovery codes.');
  });

  it.each([
    ['en', en, 6],
    ['es', es, 9],
    ['fr', fr, 9],
    ['pt', pt, 9],
  ])('keeps no number in the window lines in %s', (_, catalogue, forms) => {
    const lines = Object.entries(catalogue.waysCard).filter(([key]) =>
      /^(proveLink|proveUnlink|codeKeepsSignIn)_/.test(key),
    );

    expect(lines).toHaveLength(forms);
    for (const [key, line] of lines) expect(line, key).not.toMatch(/\d/);
  });
});
