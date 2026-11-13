import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const here = join('src', 'demo', 'settings');
const read = (...path: string[]) => readFileSync(join(...path), 'utf8');
const summaryPage = read(here, 'SummaryPage.tsx');
const members = read(here, 'Members.tsx');
const parts = read('src', 'components', 'SettingsParts.tsx');

type Catalogue = { settings: { title: string; members: string }; frame: { backTo: string } };
const catalogue = (locale: string): Catalogue =>
  JSON.parse(read('src', 'i18n', 'locales', `${locale}.json`));
const backTo = (locale: string, place: string) =>
  catalogue(locale).frame.backTo.replace('{{place}}', place);

describe('a demo settings page’s back speaks its locale (sc-30410, #33288)', () => {
  it('leaves the default back unlabelled, so Back names Settings through t', () => {
    expect(summaryPage).toMatch(/back === undefined \? \{ onPress: shell\.toSettings \} : back/u);
    expect(summaryPage).toMatch(/<Back \{\.\.\.backTo\} \/>/u);
    expect(parts).toMatch(/const place = label \?\? t\('settings\.title'\);/u);
    expect(parts).toMatch(/accessibilityLabel=\{t\('frame\.backTo', \{ place \}\)\}/u);
  });

  it('gives the person page’s back the translated Members', () => {
    expect(members).toMatch(
      /label: t\('settings\.members'\), onPress: \(\) => openPerson\(null\)/u,
    );
  });

  it('passes no English literal into a back on any settings page', () => {
    for (const file of readdirSync(here).filter((name) => name.endsWith('.tsx'))) {
      const source = read(here, file);
      expect(source, file).not.toMatch(/<Back[^>]*label=["'{]\s*['"]/u);
      expect(source, file).not.toMatch(/\{ label: ['"][^'"]*['"], onPress/u);
    }
  });

  it.each(['fr', 'es', 'pt'])('reads the back in %s with no English in it', (locale) => {
    const { settings } = catalogue(locale);
    for (const place of [settings.title, settings.members]) {
      const read = backTo(locale, place);
      expect(read).not.toMatch(/Back|Settings|Members/u);
      expect(read).toContain(place);
    }
    expect(backTo('fr', catalogue('fr').settings.title)).toBe('Retour à Paramètres');
  });
});
