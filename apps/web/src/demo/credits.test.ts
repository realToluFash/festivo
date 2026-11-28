import { describe, expect, it } from 'vitest';

import {
  FEW_ENTRIES,
  type LedgerEntry,
  SAMPLE_BALANCE,
  SAMPLE_ENTRIES,
  balanceOf,
  creditsIn,
  ledgerLines,
  lineDate,
  moreShownSaid,
  signed,
} from './credits.ts';

const words = (entries: readonly LedgerEntry[], lang: 'en' | 'fr' = 'en', locale = 'en-GB') =>
  ledgerLines(entries).map((line) => line.words(lang, locale));

describe('The Credits ledger (sc-99054)', () => {
  it('puts a day’s use where that day’s latest entry of its channel is', () => {
    expect(words(SAMPLE_ENTRIES).slice(0, 3)).toEqual([
      'WhatsApp · 2 messages',
      'Credits bought',
      'Assistant · 1 draft',
    ]);
  });

  it('sums a day’s use of one channel into one line, whatever the category, never another channel', () => {
    const lines = ledgerLines(SAMPLE_ENTRIES);
    const day = lines.slice(3, 5).map((line) => [line.words('en', 'en-GB'), line.credits]);

    expect(day).toEqual([
      ['SMS · 40 parts', -360],
      ['WhatsApp · 120 messages', -360],
    ]);
  });

  it('names every kind in the board’s words, never its internal name', () => {
    const shown = words(SAMPLE_ENTRIES).slice(0, 12);

    for (const line of [
      'Added by Soirely support',
      'Credits returned for failed messages',
      'Credit pack refunded',
      'Included credits',
    ]) {
      expect(shown).toContain(line);
    }
    expect(shown.join(' ')).not.toMatch(/refunded_|lapsed|granted|used/u);
  });

  it('makes no line for an entry of 0 credits, and keeps every other', () => {
    const lines = ledgerLines(SAMPLE_ENTRIES);

    expect(lines.some((line) => line.id === 'e-lapsed-oct')).toBe(false);
    expect(lines.some((line) => line.id === 'e-included-nov')).toBe(true);
  });

  it('keeps the balance the sum of the ledger', () => {
    expect(balanceOf(SAMPLE_ENTRIES)).toBe(SAMPLE_BALANCE);
    expect(ledgerLines(SAMPLE_ENTRIES).reduce((sum, line) => sum + line.credits, 0)).toBe(
      SAMPLE_BALANCE,
    );
    expect(ledgerLines(SAMPLE_ENTRIES).length).toBeGreaterThan(100);
    expect(ledgerLines(FEW_ENTRIES)).toHaveLength(3);
  });

  it('dates a line in the organisation’s time zone, not UTC', () => {
    const late: LedgerEntry = {
      id: 'late',
      at: '2026-10-31T23:30:00Z',
      kind: 'used',
      channel: 'sms',
      units: 1,
      credits: -9,
    };

    expect(lineDate(late.at, 'en-GB')).toBe('1 Nov 2026');
    expect(ledgerLines([late])[0]?.id).toBe('used-sms:2026-11-01');
  });

  it('writes counts, signs and plurals for the reader’s locale', () => {
    expect(signed(-1000, 'en-GB')).toBe('−1,000');
    expect(signed(1000, 'es')).toBe('+1000');
    expect(signed(10000, 'es')).toBe('+10.000');
    expect(signed(1000, 'fr').replace(/\s/gu, ' ')).toBe('+1 000');
    expect(creditsIn(0, 'fr', 'fr')).toBe('0 crédit');
    expect(creditsIn(0, 'en', 'en-GB')).toBe('0 credits');
    expect(moreShownSaid(1, 'en', 'en-GB')).toBe('1 more credit entry shown.');
    expect(moreShownSaid(50, 'en', 'en-GB')).toBe('50 more credit entries shown.');
    expect(words(SAMPLE_ENTRIES, 'fr', 'fr')).toContain(
      'Crédits restitués pour les messages en échec',
    );
  });
});
