import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { followNumberLocales, followPluralLocales } from '@soirely/domain';
import { createInstance } from 'i18next';
import { beforeAll, expect, it } from 'vitest';

import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import pt from './locales/pt.json';

const i18n = createInstance();

// The plural-rules and number lines of src/intl.ts, which as a whole does not load outside Hermes.
const POLYFILL = [
  ...readFileSync(join(import.meta.dirname, '../intl.ts'), 'utf8').matchAll(
    /^import '(@formatjs\/intl-(?:pluralrules|numberformat)\/[^']+)';$/gmu,
  ),
].map(([, specifier]) => specifier!);

beforeAll(async () => {
  for (const specifier of POLYFILL) await import(specifier);
  await i18n.init({
    resources: Object.fromEntries(
      Object.entries({ en, es, fr, pt }).map(([code, translation]) => [code, { translation }]),
    ),
    lng: 'en',
    interpolation: { escapeValue: false },
  });
  followPluralLocales(i18n.services.pluralResolver);
  followNumberLocales(i18n.services.formatter!);
});

it('counts with the polyfill, not the engine', () => {
  expect(POLYFILL[0]).toBe('@formatjs/intl-pluralrules/polyfill-force.js');
  expect((Intl.PluralRules as unknown as { polyfilled?: boolean }).polyfilled).toBe(true);
});

it.each([
  ['es', 0, 'other'],
  ['es', 1, 'one'],
  ['es', 2, 'other'],
  ['es', 25, 'other'],
  ['es', 1_000_000, 'many'],
  ['es', 2_000_000, 'many'],
  ['es', 1_000_001, 'other'],
  ['fr', 0, 'one'],
  ['fr', 1, 'one'],
  ['fr', 2, 'other'],
  ['fr', 25, 'other'],
  ['fr', 1_000_000, 'many'],
  ['pt-PT', 0, 'other'],
  ['pt-PT', 1, 'one'],
  ['pt-PT', 2, 'other'],
  ['pt-PT', 25, 'other'],
  ['pt-PT', 1_000_000, 'many'],
  ['en', 1_000_000, 'other'],
])('reads %s %d as %s', (locale, count, category) => {
  expect(new Intl.PluralRules(locale).select(count)).toBe(category);
});

it.each([
  ['es', '1.000.000 de elementos'],
  ['fr', '1\u202f000\u202f000 d’éléments'],
  ['pt', '1\u00a0000\u00a0000 de itens'],
])('picks the _many copy for a million in %s', (lng, copy) => {
  expect(i18n.t('layouts.itemCount', { lng, count: 1_000_000 })).toBe(copy);
});

it('writes numbers with the polyfill, not the engine', () => {
  expect(POLYFILL).toContain('@formatjs/intl-numberformat/polyfill-force.js');
  expect((Intl.NumberFormat as unknown as { polyfilled?: boolean }).polyfilled).toBe(true);
});

it.each([
  ['en', '1,000 items', '10,000 items'],
  ['es', '1000 elementos', '10.000 elementos'],
  ['fr', '1 000 éléments', '10 000 éléments'],
  ['pt', '1000 itens', '10 000 itens'],
])('writes a thousand and ten thousand as %s does', (lng, thousand, tenThousand) => {
  expect([
    i18n.t('layouts.itemCount', { lng, count: 1000 }),
    i18n.t('layouts.itemCount', { lng, count: 10_000 }),
  ]).toEqual([thousand, tenThousand]);
});
