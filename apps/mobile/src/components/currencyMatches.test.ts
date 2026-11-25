import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { currencyMatches } from './currencyMatches.ts';

const CHOICES = [
  { code: 'BRL', name: 'Real brasileiro' },
  { code: 'EUR', name: 'Euro' },
  { code: 'ISK', name: 'Íslensk króna' },
  { code: 'NGN', name: 'Naira' },
];

describe('the search on an event’s Currency edit (sc-48600)', () => {
  it('finds a currency by its name in any case', () => {
    expect(currencyMatches(CHOICES, 'REAL').shown.map((one) => one.code)).toEqual(['BRL']);
  });

  it('finds a currency by its code in any case', () => {
    expect(currencyMatches(CHOICES, 'ngn').shown.map((one) => one.code)).toEqual(['NGN']);
  });

  it('sets accents aside, both ways', () => {
    expect(currencyMatches(CHOICES, 'islensk krona').shown.map((one) => one.code)).toEqual(['ISK']);
    expect(currencyMatches(CHOICES, 'Bràsileiro').shown.map((one) => one.code)).toEqual(['BRL']);
  });

  it('offers every currency with nothing typed, and has nothing unmatched', () => {
    expect(currencyMatches(CHOICES, '  ')).toEqual({ shown: CHOICES, unmatched: null });
  });

  it('names what was typed when nothing matches', () => {
    expect(currencyMatches(CHOICES, ' zzz ')).toEqual({ shown: [], unmatched: 'zzz' });
  });

  it('draws the empty line with Clear search in place of the list, and reads it out', () => {
    const view = readFileSync(join(import.meta.dirname, 'EventEdits.tsx'), 'utf8');
    const body = view.slice(view.indexOf('export function CurrencyView'));
    const currency = body.slice(0, body.indexOf('\nexport function', 1));
    expect(currency).toContain("t('eventEdit.noCurrency', { typed: unmatched })");
    expect(currency).toContain('useReadOut(none)');
    expect(currency).toMatch(
      /testID="event\.edit\.currency\.none"[\s\S]*t\('eventsSearch\.clearSearch'\)\} onPress=\{\(\) => setTyped\(''\)\}/u,
    );
  });
});
