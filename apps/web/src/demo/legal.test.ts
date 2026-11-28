import { describe, expect, it } from 'vitest';

import { type Block, LEGAL_LANGS, documentFor, legalPath, longDate, updatedLine } from './legal.ts';

const words = (blocks: readonly Block[]) =>
  blocks
    .flatMap((block) =>
      block.kind === 'p'
        ? block.runs.map((run) => (typeof run === 'string' ? run : run.words))
        : 'items' in block
          ? block.items
          : [block.words],
    )
    .join(' ');

describe('the legal pages’ words (sc-28982)', () => {
  it('writes the effective date as each locale’s long date, never all numbers', () => {
    expect(longDate('en')).toBe('November 4, 2026');
    expect(longDate('es')).toBe('4 de noviembre de 2026');
    expect(longDate('fr')).toBe('4 novembre 2026');
    expect(longDate('pt')).toBe('4 de novembro de 2026');
    for (const lang of LEGAL_LANGS) expect(longDate(lang)).not.toMatch(/^\d+\/\d+/u);
  });

  it('says when it was last updated in the page’s language', () => {
    expect(updatedLine('en')).toBe('Last updated November 4, 2026');
    expect(updatedLine('pt')).toBe('Last updated November 4, 2026');
    expect(updatedLine('fr')).toBe('[Dernière mise à jour\u00a0: 4 novembre 2026]');
  });

  it('keeps the language on a link only where the demo has the sample', () => {
    expect(legalPath('terms')).toBe('/demo/terms');
    expect(legalPath('privacy', 'fr')).toBe('/demo/privacy?state=fr');
    expect(legalPath('privacy', 'es')).toBe('/demo/privacy');
  });

  it.each(['terms', 'privacy'] as const)(
    'gives the %s sample a heading, lists and a link to the other, in English and French',
    (doc) => {
      for (const lang of ['en', 'fr'] as const) {
        const { blocks } = documentFor(doc, lang);
        const kinds = new Set(blocks.map((block) => block.kind));
        expect([...kinds].sort()).toEqual(['h2', 'h3', 'ol', 'p', 'ul']);
        expect(blocks.filter((block) => block.kind === 'h2' && block.middle)).toHaveLength(1);
        const link = blocks
          .flatMap((block) => (block.kind === 'p' ? block.runs : []))
          .find((run) => typeof run !== 'string');
        expect(link).toMatchObject({ to: doc === 'terms' ? 'privacy' : 'terms' });
      }
    },
  );

  it('writes no em dash and no time of night in the samples', () => {
    for (const doc of ['terms', 'privacy'] as const)
      for (const lang of ['en', 'fr'] as const)
        expect(words(documentFor(doc, lang).blocks)).not.toMatch(/—|night|nuit|soirée/iu);
  });
});
