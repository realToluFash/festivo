import { describe, expect, it } from 'vitest';

import { WARNINGS, feedOf, langOf, said, sizeOf, usageStateOf } from './usageRules.ts';

describe('the app’s usage warning item', () => {
  it('gives assistant drafts three lines and storage two', () => {
    expect(said(WARNINGS.drafts80, 'en').lines).toEqual([
      '80 of 100 assistant drafts',
      'After your included assistant drafts, each draft costs 13 credits.',
      'Your included assistant drafts reset on 1 December.',
    ]);
    expect(said(WARNINGS.storage100, 'en')).toEqual({
      heading: 'Ire Events has used all its included storage',
      lines: ['2 GB of 2 GB storage', 'Uploads keep working, and nothing is charged.'],
    });
  });

  it('names no place, link or web address in any language', () => {
    for (const warning of Object.values(WARNINGS))
      for (const lang of ['en', 'fr', 'pt'] as const) {
        const words = said(warning, lang);
        expect([words.heading, ...words.lines].join(' ')).not.toMatch(
          /web|https?:|Plan and billing|Forfait|Plano|limit|blocked/i,
        );
      }
  });

  it('rounds a size down so it never reads as the included amount early', () => {
    expect(sizeOf(1_990_000_000, 'en')).toBe('1.9 GB');
  });

  it('puts 100% above 80% with an event item between them in the feed', () => {
    expect(feedOf('feed').map((item) => item.id)).toEqual(['drafts100', 'event', 'drafts80']);
  });

  it('opens on the 80% state in English for anything else', () => {
    expect(usageStateOf(undefined)).toBe('eighty');
    expect(langOf('opened')).toBe('en');
    expect(langOf('pt')).toBe('pt');
  });
});
