import { LOCALE_CODES } from '@soirely/domain';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The catalogues. The same four checks as the web client's, deliberately.
 *
 * Duplicated for now rather than shared, because sharing them needs a place to
 * put them and sc-51 is where that place is decided. Two copies of a check is a
 * smaller problem than one surface having no check, and the duplication is
 * visible rather than quiet.
 */
const DIR = join(import.meta.dirname, 'locales');

function catalogue(locale: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(DIR, `${locale}.json`), 'utf8')) as Record<string, unknown>;
}

function paths(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value == null) return [prefix];

  return Object.entries(value).flatMap(([k, v]) => paths(v, prefix === '' ? k : `${prefix}.${k}`));
}

function strings(locale: string): Map<string, string> {
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
}

it('has a file for every declared locale and no others', () => {
  const files = readdirSync(DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace('.json', ''))
    .sort();

  expect(files).toEqual([...LOCALE_CODES].sort());
});

describe('parity', () => {
  /** A key missing from a locale renders as its own path — fluent-looking rubbish. */
  it('has identical key sets across every locale', () => {
    const reference = paths(catalogue('en')).sort();

    for (const locale of LOCALE_CODES) {
      if (locale === 'en') continue;
      const actual = paths(catalogue(locale)).sort();

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

  /** `{{count}}` in one and `{{total}}` in another leaves a hole in a sentence. */
  it('uses the same interpolation slots per key in every locale', () => {
    const slots = (text: string): string[] =>
      [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]!).sort();
    const reference = strings('en');

    for (const locale of LOCALE_CODES) {
      if (locale === 'en') continue;

      for (const [key, text] of strings(locale)) {
        expect(slots(text), `${key} in ${locale}`).toEqual(slots(reference.get(key) ?? ''));
      }
    }
  });

  /** `_one` with no `_other` falls back for every number except one. */
  it('has complete plural families', () => {
    for (const locale of LOCALE_CODES) {
      const all = paths(catalogue(locale));

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

  /**
   * Every key a screen asks for exists.
   *
   * The layouts screen resolves `layouts.${kind}` from a variable, which no
   * static check can follow — so the three are asserted by name here.
   */
  it('has a description for each of the three layout kinds', () => {
    for (const locale of LOCALE_CODES) {
      const all = paths(catalogue(locale));

      for (const kind of ['phone', 'tabletPortrait', 'tabletLandscape']) {
        expect(all, `layouts.${kind} in ${locale}`).toContain(`layouts.${kind}`);
      }
    }
  });
});
