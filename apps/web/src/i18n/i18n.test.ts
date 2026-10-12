import { LOCALE_CODES } from '@soirely/domain';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { LANGUAGE_KEY, currentLocale, setLanguage, storedLanguage } from './index.ts';

/**
 * The catalogues, and resolution.
 *
 * sc-51 adds the full parity guard across every surface. These are the web
 * app's own: the ones that would let a broken catalogue ship from this package
 * alone.
 */
const LOCALES_DIR = join(import.meta.dirname, 'locales');

function catalogue(locale: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(LOCALES_DIR, `${locale}.json`), 'utf8')) as Record<
    string,
    unknown
  >;
}

function keys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value == null) return [prefix];

  return Object.entries(value).flatMap(([k, v]) => keys(v, prefix === '' ? k : `${prefix}.${k}`));
}

describe('catalogues', () => {
  it('has a file for every locale the product declares, and no others', () => {
    const files = readdirSync(LOCALES_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace('.json', ''))
      .sort();

    expect(files).toEqual([...LOCALE_CODES].sort());
  });

  /**
   * A key in English and missing elsewhere renders as its own path — `nav.events`
   * on the screen of somebody reading French. Nothing throws, so only a test
   * catches it.
   */
  it('has identical key sets across every locale', () => {
    const reference = keys(catalogue('en')).sort();

    for (const locale of LOCALE_CODES) {
      if (locale === 'en') continue;

      const actual = keys(catalogue(locale)).sort();

      expect(
        actual.filter((k) => !reference.includes(k)),
        `extra in ${locale}`,
      ).toEqual([]);
      expect(
        reference.filter((k) => !actual.includes(k)),
        `missing from ${locale}`,
      ).toEqual([]);
    }
  });

  /**
   * `{{count}}` in one locale and `{{total}}` in another interpolates to
   * nothing in the second — a sentence with a hole in it, rendered fluently.
   */
  it('uses the same interpolation slots for a key in every locale', () => {
    const slots = (text: string): string[] =>
      [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]!).sort();

    const flat = (locale: string): Map<string, string> => {
      const out = new Map<string, string>();
      const walk = (value: unknown, prefix: string): void => {
        if (typeof value === 'string') {
          out.set(prefix, value);
        } else if (typeof value === 'object' && value != null) {
          for (const [k, v] of Object.entries(value)) walk(v, prefix === '' ? k : `${prefix}.${k}`);
        }
      };
      walk(catalogue(locale), '');

      return out;
    };

    const reference = flat('en');

    for (const locale of LOCALE_CODES) {
      if (locale === 'en') continue;

      for (const [key, text] of flat(locale)) {
        expect(slots(text), `${key} in ${locale}`).toEqual(slots(reference.get(key) ?? ''));
      }
    }
  });

  /**
   * A count key with `_one` and no `_other` falls back to the key path for
   * every number except one, which is the plural most readers will see.
   */
  it('has complete plural families', () => {
    for (const locale of LOCALE_CODES) {
      const all = keys(catalogue(locale));

      for (const key of all) {
        if (key.endsWith('_one')) {
          expect(all, `${key} in ${locale}`).toContain(key.replace(/_one$/, '_other'));
        }
        if (key.endsWith('_other')) {
          expect(all, `${key} in ${locale}`).toContain(key.replace(/_other$/, '_one'));
        }
      }
    }
  });
});

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
});
