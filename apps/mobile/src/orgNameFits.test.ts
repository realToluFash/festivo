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
const PILL = readFileSync(join(import.meta.dirname, 'components', 'OrgPill.tsx'), 'utf8');
const COVER = readFileSync(join(import.meta.dirname, 'components', 'TodayCover.tsx'), 'utf8');
const SPACED = 'Adeyemi Okafor Events '.repeat(5).slice(0, 99).concat('X');
const WORD = 'A'.repeat(100);

describe('a 100-character organisation name in the frame (sc-486)', () => {
  it('shows on one line, or two at the accessibility sizes, cut with an ellipsis, in the pill (sc-13496)', () => {
    expect(FRAME.match(/const lines = useNameLines\(\);/gu)).toHaveLength(1);
    expect(FRAME).toMatch(/<WhitePill\b(?:(?!\/>)[\s\S])*\slines=\{lines\}/u);
    expect(PILL).toMatch(/numberOfLines=\{lines \?\? \(wrap \? undefined : 1\)\}/u);
  });

  it("keeps Today's cover pill beside an upright tablet's tabs to one line, or its tile, as the frame's (sc-38149)", () => {
    expect(COVER).toMatch(/usePillFit\(org\.name, org\.waiting, maxWidth, large\)/u);
    expect(COVER).toMatch(/const wrap = phone \|\| large;/u);
    expect(COVER).not.toMatch(/<OpenerWords[^>]*\swrap\s/u);
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
