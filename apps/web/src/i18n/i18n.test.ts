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

describe('a value that ends its own sentence', () => {
  afterEach(async () => {
    await setLanguage(null);
  });

  const org = 'Ọ̀ṣun Galas Ltd.';

  it.each([
    ['en', 'Made by Ọ̀ṣun Galas Ltd. It can be removed.'],
    ['es', 'Creado por Ọ̀ṣun Galas Ltd. Se puede eliminar.'],
    ['fr', 'Créé par Ọ̀ṣun Galas Ltd. Il peut être supprimé.'],
    ['pt', 'Criada por Ọ̀ṣun Galas Ltd. Pode ser removida.'],
  ])('takes no second full stop in %s', async (locale, shown) => {
    await setLanguage(locale);

    expect(i18next.t('rolesScreen.describeCustom', { name: org })).toBe(shown);
  });

  it.each(['Party Time!', "Who's Next?", 'Galas…', 'Galas Ltd..'])(
    'keeps %j exactly as typed, with no full stop after it',
    async (name) => {
      await setLanguage('en');

      expect(i18next.t('rolesScreen.describeCustomReadOnly', { name })).toBe(`Made by ${name}`);
    },
  );

  it('gives a value ending in a letter the string’s full stop', async () => {
    await setLanguage('en');

    expect(i18next.t('rolesScreen.describeCustomReadOnly', { name: 'Galas Ltd' })).toBe(
      'Made by Galas Ltd.',
    );
  });

  it('drops only a full stop, never a comma, a question mark, a space or a closing quote', async () => {
    await setLanguage('en');

    expect(i18next.t('switcher.labelSwitch', { name: org, role: 'Door team.' })).toBe(
      'Organisation: Ọ̀ṣun Galas Ltd., your role Door team. Switch organisation',
    );
    expect(i18next.t('timeZone.noneMatch', { typed: 'Atlantis.' })).toBe(
      'No time zone matches “Atlantis.”. Try a city, a country or an offset like UTC+01.',
    );
    expect(i18next.t('test.unused', { defaultValue: 'Did you mean {{name}}?', name: org })).toBe(
      'Did you mean Ọ̀ṣun Galas Ltd.?',
    );
  });

  it('counts a plural line as before', async () => {
    await setLanguage('en');

    expect(i18next.t('rolesScreen.unsaved', { role: 'Door team.', count: 2 })).toMatch(
      /^Unsaved changes to Door team\. 2 people/,
    );
    expect(i18next.t('rolesScreen.unsavedNobody', { role: 'Door team.' })).toBe(
      'Unsaved changes to Door team. Nobody holds this role yet.',
    );
  });
});
