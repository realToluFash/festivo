import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { FRESHNESS_KEYS } from './serviceFreshness.ts';
import { NEEDS_CONNECTION_KEYS, NOT_SENT_KEYS } from './serviceTaps.ts';

const PLURALS = new Set<string>([FRESHNESS_KEYS.noConnectionWaiting, NOT_SENT_KEYS.undoExpired]);

function keys(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (typeof value === 'object' && value != null) return Object.values(value).flatMap(keys);

  return [];
}

const KEYS = [...keys(FRESHNESS_KEYS), ...keys(NOT_SENT_KEYS), ...keys(NEEDS_CONNECTION_KEYS)];

function lookup(catalogue: unknown, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>((at, part) => (at as Record<string, unknown> | undefined)?.[part], catalogue);
}

describe.each(['web', 'mobile'])('every sc-4028 line in the %s catalogues', (app) => {
  it.each(['en', 'es', 'fr', 'pt'])('is in %s', (locale) => {
    const catalogue = JSON.parse(
      readFileSync(
        resolve(__dirname, `../../../apps/${app}/src/i18n/locales/${locale}.json`),
        'utf8',
      ),
    ) as unknown;

    for (const key of KEYS) {
      const forms = PLURALS.has(key) ? [`${key}_one`, `${key}_other`] : [key];

      for (const form of forms) expect(typeof lookup(catalogue, form), form).toBe('string');
    }
  });
});
