import { describe, expect, it } from 'vitest';

import {
  WARNINGS,
  feedOf,
  langOf,
  percentOf,
  said,
  sizeOf,
  usageStateOf,
  warningKeyOf,
  whenOf,
} from './usageWarning.ts';

describe('sizeOf', () => {
  it('rounds down to one decimal in the largest unit at least 1', () => {
    expect(sizeOf(1_640_000_000, 'en')).toBe('1.6 GB');
    expect(sizeOf(2_030_000_000, 'en')).toBe('2 GB');
    expect(sizeOf(1_990_000_000, 'en')).toBe('1.9 GB');
    expect(sizeOf(950_000_000, 'en')).toBe('950 MB');
    expect(sizeOf(1_250_000_000_000, 'en')).toBe('1.2 TB');
  });

  it('shows MB below 1 MB', () => {
    expect(sizeOf(400_000, 'en')).toBe('0.4 MB');
  });

  it('formats the unit in the language', () => {
    expect(sizeOf(1_640_000_000, 'fr')).toMatch(/^1,6[\u00a0\u202f]Go$/);
  });
});

describe('percentOf', () => {
  it('goes through Intl, so French takes its no-break space', () => {
    expect(percentOf(80, 'en')).toBe('80%');
    expect(percentOf(80, 'fr')).toMatch(/^80[\u00a0\u202f]%$/);
  });
});

describe('said', () => {
  it('gives assistant drafts three lines, the reset line last', () => {
    const at80 = said(WARNINGS.drafts80, 'en');

    expect(at80.heading).toBe('Ire Events has used 80% of its included assistant drafts');
    expect(at80.lines).toEqual([
      '80 of 100 assistant drafts',
      'After your included assistant drafts, each draft costs 13 credits.',
      'Your included assistant drafts reset on 1 December.',
    ]);
    expect(said(WARNINGS.drafts100, 'en').lines[1]).toBe(
      'Each assistant draft now costs 13 credits until your included drafts reset.',
    );
  });

  it('gives storage two lines and no reset line', () => {
    expect(said(WARNINGS.storage80, 'en').lines).toEqual([
      '1.6 GB of 2 GB storage',
      'Uploads keep working, and nothing is charged.',
    ]);
    expect(said(WARNINGS.storage100, 'en').heading).toBe(
      'Ire Events has used all its included storage',
    );
  });

  it('never says limit, full, out of or blocked, and the heading has no full stop', () => {
    for (const warning of Object.values(WARNINGS)) {
      const words = said(warning, 'en');
      expect(words.heading).not.toMatch(/\.$/);
      expect([words.heading, ...words.lines].join(' ')).not.toMatch(/limit|full|out of|blocked/i);
    }
  });

  it('runs the stand-ins about 30% longer than the English', () => {
    for (const warning of Object.values(WARNINGS)) {
      const en = [said(warning, 'en').heading, ...said(warning, 'en').lines].join(' ').length;
      for (const lang of ['fr', 'pt'] as const) {
        const long = [said(warning, lang).heading, ...said(warning, lang).lines].join(' ').length;
        expect(long / en).toBeGreaterThan(1.15);
      }
    }
  });
});

describe('the states', () => {
  it('puts 100% above 80% with an event item between them in the feed', () => {
    expect(feedOf('feed').map((item) => item.id)).toEqual(['drafts100', 'event', 'drafts80']);
  });

  it('falls back to the 80% state, English and drafts at 80%', () => {
    expect(usageStateOf('nonsense')).toBe('eighty');
    expect(langOf('email', null)).toBe('en');
    expect(langOf('fr', null)).toBe('fr');
    expect(langOf('emailPhone', 'pt')).toBe('pt');
    expect(warningKeyOf(null)).toBe('drafts80');
  });
});

describe('whenOf', () => {
  it('shows today as a time and an earlier day as a date, in the shown language', () => {
    const atTime = (time: string) => `[${time}]`;
    const [today, , friday] = feedOf('feed').map((item) => item.createdAt) as [
      string,
      string,
      string,
    ];

    expect(whenOf(today, 'en', atTime)).toMatch(/^\[14[:.h]05\]$/);
    expect(whenOf(friday, 'fr', atTime)).toMatch(/nov/i);
    expect(whenOf(friday, 'fr', atTime)).not.toMatch(/Fri|Nov\b/);
    expect(whenOf(friday, 'pt', atTime)).not.toMatch(/Fri|Nov\b/);
  });
});
