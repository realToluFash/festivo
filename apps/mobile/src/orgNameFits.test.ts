import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createInstance } from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';

import en from './i18n/locales/en.json';
import es from './i18n/locales/es.json';
import fr from './i18n/locales/fr.json';
import pt from './i18n/locales/pt.json';

const i18n = createInstance();

beforeAll(async () => {
  await i18n.init({
    resources: Object.fromEntries(
      Object.entries({ en, es, fr, pt }).map(([code, translation]) => [code, { translation }]),
    ),
    lng: 'en',
    interpolation: { escapeValue: false },
  });
});

const FRAME = readFileSync(join(import.meta.dirname, 'components', 'AppFrame.tsx'), 'utf8');
const SPACED = 'Adeyemi Okafor Events '.repeat(5).slice(0, 99).concat('X');
const WORD = 'A'.repeat(100);

/** Each `<Text …>` element whose only child is `{<expression>}`, as its opening tag. */
function textsShowing(expression: string): string[] {
  const escaped = expression.replaceAll('.', '\\.');

  return [
    ...FRAME.matchAll(new RegExp(`<Text\\b([^>]*)>\\s*\\{${escaped}\\}\\s*</Text>`, 'gu')),
  ].map(([, attributes]) => attributes ?? '');
}

describe('a 100-character organisation name in the frame (sc-486)', () => {
  it('shows on one line, cut with an ellipsis, in the pill, the rail and every switcher row', () => {
    const texts = textsShowing('organisation.name');

    expect(texts).toHaveLength(2);
    for (const attributes of texts) expect(attributes).toMatch(/numberOfLines=\{1\}/u);
    expect(FRAME).toMatch(/muted numberOfLines=\{1\}>\s*\{t\('switcher\.yourRole'/u);
    expect(FRAME).toMatch(/muted numberOfLines=\{1\}>\s*\{t\('frame\.organisation'\)\}/u);
  });

  it.each([
    ['with spaces', SPACED],
    ['with none', WORD],
  ])('keeps the whole name, %s, in the switcher label in all four locales', (_, name) => {
    expect(name).toHaveLength(100);
    for (const lng of ['en', 'es', 'fr', 'pt']) {
      expect(i18n.t('switcher.labelSwitch', { lng, name, role: 'Owner' })).toContain(name);
    }
  });
});
