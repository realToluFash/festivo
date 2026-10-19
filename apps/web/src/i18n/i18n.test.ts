import i18next from 'i18next';
import { afterEach, describe, expect, it } from 'vitest';

import { LANGUAGE_KEY, currentLocale, setLanguage, storedLanguage } from './index.ts';

/**
 * How this app resolves a language.
 *
 * The CATALOGUES are checked in @soirely/i18n-lint, which runs the same four
 * parity checks over every surface. Keeping a copy here was three
 * implementations of one idea; what belongs here is the behaviour only this
 * app has.
 */
describe('resolution', () => {
  afterEach(async () => {
    localStorage.removeItem(LANGUAGE_KEY);
    await setLanguage(null);
  });

  it('persists an explicit choice and reports it as the override', async () => {
    await setLanguage('fr');

    expect(storedLanguage()).toBe('fr');
    expect(currentLocale()).toBe('fr');
    expect(localStorage.getItem(LANGUAGE_KEY)).toBe('fr');
  });

  /**
   * Clearing has to be reachable, or "Automatic" is a label on a control that
   * does nothing.
   */
  it('clears the override back to following the browser', async () => {
    await setLanguage('pt');
    await setLanguage(null);

    expect(storedLanguage()).toBeNull();
    expect(localStorage.getItem(LANGUAGE_KEY)).toBeNull();
  });

  it('ignores a stored value for a locale we have no catalogue for', () => {
    localStorage.setItem(LANGUAGE_KEY, 'de');

    expect(storedLanguage()).toBeNull();
  });

  it('sets the document language, which the scrollbar and form controls read', async () => {
    await setLanguage('es');

    expect(document.documentElement.lang).toBe('es');
  });

  it('counts none in Portuguese as plural, the European rule the copy is written in', async () => {
    await setLanguage('pt');

    expect(i18next.t('nav.eventCount', { count: 0 })).toBe('0 eventos');
    expect(i18next.t('nav.eventCount', { count: 1 })).toBe('1 evento');
  });
});
