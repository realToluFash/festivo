import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { followNumberLocales, followPluralLocales } from '@soirely/domain';
import { createInstance } from 'i18next';
import { beforeAll, expect, it } from 'vitest';

import en from '../i18n/locales/en.json';
import es from '../i18n/locales/es.json';
import fr from '../i18n/locales/fr.json';
import pt from '../i18n/locales/pt.json';
import { menuFigure } from './menuFigure.ts';

const i18n = createInstance();

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

it.each([
  ['en', 1326, '1,326'],
  ['fr', 1326, '1 326'],
  ['es', 1326, '1326'],
  ['en', 12_345, '12,345'],
  ['es', 12_345, '12.345'],
  ['fr', 12_345, '12 345'],
  ['en', 47, '47'],
  ['es', 47, '47'],
  ['fr', 47, '47'],
])('writes %s %d as %s, as the Members card sentence does', async (lng, count, figure) => {
  await i18n.changeLanguage(lng);

  expect(menuFigure(i18n, count)).toBe(figure);
  expect(i18n.t('membersScreen.card.people', { count })).toContain(figure);
});
