import i18next from 'i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LANGUAGE_KEY, currentLocale, dateLocale, setLanguage, storedLanguage } from './index.ts';

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

describe('a number in a sentence (sc-15361)', () => {
  afterEach(async () => {
    await setLanguage(null);
  });

  it.each([
    ['en', '1,000 people', '10,000 people', '1,000,000 events'],
    ['es', '1000 personas', '10.000 personas', '1.000.000 de eventos'],
    ['fr', '1\u202f000 personnes', '10\u202f000 personnes', '1\u202f000\u202f000 d’événements'],
    ['pt', '1000 pessoas', '10\u00a0000 pessoas', '1\u00a0000\u00a0000 de eventos'],
  ])('is written the way %s writes numbers', async (locale, thousand, tenThousand, million) => {
    await setLanguage(locale);

    expect([
      i18next
        .t('signInRules.everyoneStillWithout', { count: 1000 })
        .split(' ')
        .slice(0, 2)
        .join(' '),
      i18next
        .t('signInRules.everyoneStillWithout', { count: 10_000 })
        .split(' ')
        .slice(0, 2)
        .join(' '),
      i18next.t('ownership.events', { count: 1_000_000 }),
    ]).toEqual([thousand, tenThousand, million]);
  });

  it('reads as before under 1000', async () => {
    await setLanguage('fr');

    expect(i18next.t('signInRules.days', { count: 999 })).toBe('999 jours');
  });
});

describe('the locale dates are written in', () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await setLanguage(null);
  });

  it("keeps an en-GB browser's region on an English screen, and the catalogue stays en", async () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-GB');
    await setLanguage('en');

    expect(dateLocale()).toBe('en-GB');
    expect(currentLocale()).toBe('en');
  });

  it('writes a language picked on that browser alone, never es-GB', async () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-GB');
    await setLanguage('es');

    expect(dateLocale()).toBe('es');
  });
});

describe('a value that ends its own sentence', () => {
  afterEach(async () => {
    await setLanguage(null);
  });

  const org = 'Ọ̀ṣun Galas Ltd.';

  it.each([
    ['en', 'Now working in Ọ̀ṣun Galas Ltd.'],
    ['es', 'Ahora trabaja en Ọ̀ṣun Galas Ltd.'],
    ['fr', 'Vous travaillez maintenant dans Ọ̀ṣun Galas Ltd.'],
    ['pt', 'Agora a trabalhar em Ọ̀ṣun Galas Ltd.'],
  ])('takes no second full stop in %s', async (locale, shown) => {
    await setLanguage(locale);

    expect(i18next.t('switcher.switched', { name: org })).toBe(shown);
  });

  it.each(['Party Time!', "Who's Next?", 'Galas…', 'Galas Ltd..'])(
    'keeps %j exactly as typed, with no full stop after it',
    async (name) => {
      await setLanguage('en');

      expect(i18next.t('switcher.switched', { name })).toBe(`Now working in ${name}`);
    },
  );

  it('gives a value ending in a letter the string’s full stop', async () => {
    await setLanguage('en');

    expect(i18next.t('switcher.switched', { name: 'Galas Ltd' })).toBe('Now working in Galas Ltd.');
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

    expect(
      i18next.t('switcher.labelSwitchWaiting', { name: 'Ìrè', role: 'Door team.', count: 2 }),
    ).toBe('Organisation: Ìrè, your role Door team. Switch organisation. 2 invitations waiting');
    expect(
      i18next.t('switcher.labelSwitchWaiting', { name: 'Ìrè', role: 'Door team.', count: 1 }),
    ).toBe('Organisation: Ìrè, your role Door team. Switch organisation. 1 invitation waiting');
  });
});
