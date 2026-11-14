import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  type Catalogue,
  bareNumbers,
  emptyMessages,
  keyParity,
  pluralFamilies,
  slotParity,
  wordDrift,
} from './catalogues.ts';
import {
  LOCALES,
  NUMBER_CATALOGUES,
  ROOT,
  SHARED_WORDS,
  SURFACES,
  type SlotSyntax,
  type WordCopy,
} from './surfaces.ts';

/**
 * Every surface, the same four checks.
 *
 * Driven from the SURFACES registry rather than written per app, so adding a
 * surface adds its checks — the failure mode being a new client that quietly
 * has no parity guard at all.
 */
describe.each(SURFACES.map((s) => [s.name, s] as const))('%s', (_name, surface) => {
  it('has a catalogue for every declared locale', () => {
    const missing = LOCALES.filter(
      (locale) => !existsSync(join(ROOT, surface.catalogues, surface.file(locale))),
    );

    // A declared locale with no catalogue renders raw key paths to anybody who
    // selects it — which looks like text, and is not.
    expect(missing, `no catalogue for: ${missing.join(', ')}`).toEqual([]);
  });

  it('has the same keys in every locale', () => {
    const { missing, extra } = keyParity(surface);

    expect(
      missing.map((m) => `${m.locale}: ${m.key}`),
      'present in en and missing here — renders as its own key path',
    ).toEqual([]);

    expect(
      extra.map((m) => `${m.locale}: ${m.key}`),
      'here and not in en — either a typo or a key English forgot',
    ).toEqual([]);
  });

  it('has no empty messages', () => {
    expect(
      emptyMessages(surface).map((m) => `${m.locale}: ${m.key}`),
      'an empty message renders as nothing, which reads as a layout bug',
    ).toEqual([]);
  });

  it('uses the same interpolation slots for a key in every locale', () => {
    expect(
      slotParity(surface).map(
        (m) => `${m.locale}: ${m.key} has [${m.actual}], en has [${m.expected}]`,
      ),
    ).toEqual([]);
  });

  it('has complete plural families', () => {
    expect(
      pluralFamilies(surface).map((p) => `${p.locale}: ${p.present} has no ${p.missing}`),
    ).toEqual([]);
  });
});

describe.each(NUMBER_CATALOGUES.map((catalogue) => [catalogue.name, catalogue] as const))(
  '%s',
  (_name, catalogue) => {
    it('writes every number with its language’s format, never as bare digits', () => {
      expect(
        bareNumbers(catalogue).map((bare) => `${bare.locale}: ${bare.key} writes ${bare.slot}`),
        'a count, cap or total reads «1000000» where French writes « 1 000 000 » (sc-15361)',
      ).toEqual([]);
    });
  },
);

describe.each(SHARED_WORDS.map((shared) => [shared.what, shared] as const))(
  '%s',
  (_what, shared) => {
    it('read the same on every surface that keeps a copy', () => {
      expect(
        wordDrift(shared.copies).map(
          (drift) => `${drift.locale}: ${drift.word} reads ${JSON.stringify(drift.readings)}`,
        ),
        'change the word in every copy, or one surface lets through what another refuses',
      ).toEqual([]);
    });
  },
);

/**
 * The checks themselves, against catalogues built to be wrong.
 *
 * A guard nobody has watched fail is a guard nobody should trust — and three
 * of these four have shipped as real bugs on this product.
 */
describe('the checks catch what they are for', () => {
  const surfaceFor = (dir: string) => ({
    name: 'fixture',
    catalogues: dir,
    file: (locale: string) => `${locale}.json`,
    sources: [],
  });

  it('notices a key missing from one locale, and names it', () => {
    const { missing } = keyParity(surfaceFor('packages/i18n-lint/src/__fixtures__/missing-key'));

    expect(missing).toEqual([{ locale: 'fr', key: 'greeting' }]);
  });

  it('allows a plural form the locale has and English does not, and no other', () => {
    const surface = surfaceFor('packages/i18n-lint/src/__fixtures__/own-plural-form');

    expect(keyParity(surface)).toEqual({
      missing: [],
      extra: [
        { locale: 'fr', key: 'guests_few' },
        { locale: 'pt', key: 'greeting_many' },
      ],
    });
    expect(slotParity(surface)).toEqual([
      { locale: 'fr', key: 'guests_many', expected: ['count'], actual: ['total'] },
    ]);
  });

  it('notices a renamed interpolation slot', () => {
    const mismatches = slotParity(surfaceFor('packages/i18n-lint/src/__fixtures__/wrong-slot'));

    expect(mismatches).toEqual([
      { locale: 'fr', key: 'sendTo', expected: ['count'], actual: ['total'] },
    ]);
  });

  it('notices a plural family with only one half', () => {
    const incomplete = pluralFamilies(
      surfaceFor('packages/i18n-lint/src/__fixtures__/half-plural'),
    );

    expect(incomplete).toEqual([
      { locale: 'fr', present: 'guests_one', missing: 'guests_other' },
      { locale: 'pt', present: 'hosts_other', missing: 'hosts_one' },
    ]);
  });

  it("notices a plural family missing a form the locale's rules ask for", () => {
    const incomplete = pluralFamilies(
      surfaceFor('packages/i18n-lint/src/__fixtures__/missing-many'),
    );

    expect(incomplete).toEqual([
      { locale: 'fr', present: 'guests_one', missing: 'guests_many' },
      { locale: 'fr', present: 'guests_other', missing: 'guests_many' },
    ]);
  });

  it('notices a shared word one copy reads differently, or lacks', () => {
    const copy = (name: string, under: string): WordCopy => ({
      name,
      catalogues: '',
      file: () => '',
      under,
    });
    const read = (from: WordCopy, locale: string): Catalogue =>
      from.name === 'web'
        ? { roles: { owner: 'Owner', coordinator: 'Coordinator' } }
        : locale === 'es'
          ? { 'seeded_role.owner': 'Dueño' }
          : { 'seeded_role.owner': 'Owner', 'seeded_role.coordinator': 'Coordinator' };

    expect(wordDrift([copy('web', 'roles'), copy('api', 'seeded_role')], read)).toEqual([
      { locale: 'es', word: 'coordinator', readings: { web: 'Coordinator', api: null } },
      { locale: 'es', word: 'owner', readings: { web: 'Owner', api: 'Dueño' } },
    ]);
  });

  it.each([
    [
      'i18next',
      '',
      [
        { locale: 'fr', key: 'guests_other', slot: '{{count}}' },
        { locale: 'fr', key: 'cap', slot: '{{most}}' },
      ],
    ],
    [
      'icu',
      'icu.',
      [
        { locale: 'es', key: 'waiting', slot: '#' },
        { locale: 'es', key: 'party', slot: '#' },
        { locale: 'es', key: 'expiry', slot: '{minutes, number}' },
      ],
    ],
    ['plain', 'plain.', [{ locale: 'pt', key: 'expiry', slot: '{minutes}' }]],
  ] as const)(
    'notices a number written as bare digits in a %s catalogue',
    (syntax, prefix, bare) => {
      const catalogue = {
        name: 'fixture',
        catalogues: 'packages/i18n-lint/src/__fixtures__/bare-number',
        file: (locale: string) => `${prefix}${locale}.json`,
        syntax: syntax as SlotSyntax,
      };

      expect(bareNumbers(catalogue)).toEqual(bare);
    },
  );

  it('notices an empty message', () => {
    const empty = emptyMessages(surfaceFor('packages/i18n-lint/src/__fixtures__/empty-message'));

    expect(empty).toEqual([{ locale: 'fr', key: 'greeting' }]);
  });
});
