import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { CATALOGUES, changedSince, flatten, LOCALES, untranslated } from './locale-status.mjs';

describe('a catalogue', () => {
  it('flattens to dotted keys, plural suffixes and all', () => {
    expect(flatten({ guests: { count_one: '{{count}} guest', title: 'Guests' } })).toEqual({
      'guests.count_one': '{{count}} guest',
      'guests.title': 'Guests',
    });
  });
});

// Translations now land in their own tickets, after the feature that added the English, so
// an English placeholder in fr.json is the normal state of a key nobody has translated yet.
describe('what is left to translate', () => {
  const english = {
    'auth.title': 'Sign in',
    'auth.code': 'Code',
    'app.name': 'Soirely',
    'n.count': '{{count}}',
  };

  it('finds keys missing from a locale, and keys still in English', () => {
    const french = {
      'auth.title': 'Sign in',
      'auth.code': 'Code',
      'app.name': 'Soirely',
      'n.count': '{{count}}',
    };
    expect(untranslated(english, french, ['auth.code', 'app.name'])).toEqual({
      missing: [],
      same: ['auth.title'],
    });
    expect(untranslated(english, {}, []).missing).toEqual(Object.keys(english));
  });

  it('does not count a string with no words as untranslated', () => {
    expect(
      untranslated(english, { ...english }, ['auth.title', 'auth.code', 'app.name']).same,
    ).toEqual([]);
  });
});

describe('English that moved since a translation', () => {
  const before = { 'auth.title': 'Sign in', 'auth.cta': 'Continue' };
  const now = {
    'auth.title': 'Sign in to Soirely',
    'auth.cta': 'Continue',
    'auth.new': 'Forgot it?',
  };

  it('is stale in a locale whose own text did not change with it', () => {
    const french = { 'auth.title': 'Se connecter', 'auth.cta': 'Continuer' };
    expect(changedSince(before, now, french, french)).toEqual({
      changed: ['auth.title', 'auth.new'],
      stale: ['auth.title'],
    });
  });

  it('is not stale once the locale was retranslated in the same range', () => {
    const frenchBefore = { 'auth.title': 'Se connecter' };
    const frenchNow = { 'auth.title': 'Se connecter à Soirely' };
    expect(changedSince(before, now, frenchBefore, frenchNow).stale).toEqual([]);
  });
});

describe('the list of strings meant to stay in English', () => {
  const allowed = JSON.parse(
    readFileSync(new URL('../docs/i18n/same-as-english.json', import.meta.url), 'utf8'),
  );

  it('names only real locales and real catalogues', () => {
    for (const [locale, keys] of Object.entries(allowed)) {
      expect(LOCALES.filter((l) => l !== 'en')).toContain(locale);
      for (const key of keys) expect(Object.keys(CATALOGUES)).toContain(key.split(':')[0]);
    }
  });
});
