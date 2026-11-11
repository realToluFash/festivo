/**
 * The three ways a set of catalogues disagrees, as pure functions.
 *
 * Each describes a failure that renders FLUENTLY in the wrong way — none of
 * them throws, none produces a log line, and the reader who notices is the one
 * reading the language nobody on the team reads. That is why they are tests and
 * not conventions.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  LOCALES,
  NUMBER_SLOTS,
  ROOT,
  type NumberCatalogue,
  type Surface,
  type WordCopy,
} from './surfaces.ts';

export type Catalogue = Record<string, unknown>;

const PLURAL_CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'];

/** `guests_many` is the `many` form of `guests`; every check that reads a suffix asks here. */
export function pluralForm(key: string): { base: string; category: string } | null {
  const cut = key.lastIndexOf('_');
  if (cut <= 0) return null;

  const category = key.slice(cut + 1);

  return PLURAL_CATEGORIES.includes(category) ? { base: key.slice(0, cut), category } : null;
}

export function load(surface: Pick<Surface, 'catalogues' | 'file'>, locale: string): Catalogue {
  const path = join(ROOT, surface.catalogues, surface.file(locale));

  return JSON.parse(readFileSync(path, 'utf8')) as Catalogue;
}

/** Every leaf key, dotted. */
export function keysOf(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value == null) return [prefix];

  return Object.entries(value).flatMap(([k, v]) => keysOf(v, prefix === '' ? k : `${prefix}.${k}`));
}

/** Every leaf string, by dotted key. */
export function stringsOf(catalogue: Catalogue): Map<string, string> {
  const out = new Map<string, string>();

  const walk = (value: unknown, prefix: string): void => {
    if (typeof value === 'string') {
      out.set(prefix, value);
    } else if (typeof value === 'object' && value != null) {
      for (const [k, v] of Object.entries(value)) {
        walk(v, prefix === '' ? k : `${prefix}.${k}`);
      }
    }
  };

  walk(catalogue, '');

  return out;
}

export interface MissingKey {
  locale: string;
  key: string;
}

/**
 * Keys present in the reference locale and absent elsewhere, and the reverse.
 *
 * Named individually rather than counted: "3 keys missing from fr" sends
 * somebody diffing two files by hand, which is the step at which this stops
 * being used.
 */
export function keyParity(
  surface: Surface,
  reference = 'en',
): {
  missing: MissingKey[];
  extra: MissingKey[];
} {
  const expected = keysOf(load(surface, reference));
  const missing: MissingKey[] = [];
  const extra: MissingKey[] = [];

  for (const locale of LOCALES) {
    if (locale === reference) continue;

    const actual = keysOf(load(surface, locale));

    for (const key of expected) {
      if (!actual.includes(key)) missing.push({ locale, key });
    }
    for (const key of actual) {
      if (!expected.includes(key) && ownPluralOf(key, locale, expected) == null) {
        extra.push({ locale, key });
      }
    }
  }

  return { missing, extra };
}

/** A form the locale has and the reference does not: without it, i18next falls back to the reference. */
function ownPluralOf(key: string, locale: string, expected: readonly string[]): string | null {
  const form = pluralForm(key);
  if (form == null) return null;

  const categories = new Intl.PluralRules(locale).resolvedOptions().pluralCategories as string[];
  const other = `${form.base}_other`;

  return categories.includes(form.category) && expected.includes(other) ? other : null;
}

/** An empty message renders as nothing at all, which reads as a layout bug. */
export function emptyMessages(surface: Surface): MissingKey[] {
  return LOCALES.flatMap((locale) =>
    [...stringsOf(load(surface, locale))]
      .filter(([, text]) => text.trim() === '')
      .map(([key]) => ({ locale, key })),
  );
}

export interface SlotMismatch {
  locale: string;
  key: string;
  expected: string[];
  actual: string[];
}

const I18NEXT_SLOT = /\{\{\s*([\w.]+)\s*(?:,\s*([^}]*?))?\s*\}\}/g;

/** The `{{name}}` slots in a message with any format, as `count, number`, sorted. */
export function slotsIn(text: string): string[] {
  return [...text.matchAll(I18NEXT_SLOT)]
    .map(([, name, format]) => (format == null ? name! : `${name}, ${format}`))
    .sort();
}

/**
 * A slot named differently in one locale interpolates to nothing there — a
 * sentence with a hole in it, rendered fluently.
 */
export function slotParity(surface: Surface, reference = 'en'): SlotMismatch[] {
  const expected = stringsOf(load(surface, reference));
  const mismatches: SlotMismatch[] = [];

  for (const locale of LOCALES) {
    if (locale === reference) continue;

    for (const [key, text] of stringsOf(load(surface, locale))) {
      const reference =
        expected.get(key) ?? expected.get(ownPluralOf(key, locale, [...expected.keys()]) ?? '');
      if (reference == null) continue;

      const want = slotsIn(reference);
      const got = slotsIn(text);

      if (want.join('|') !== got.join('|')) {
        mismatches.push({ locale, key, expected: want, actual: got });
      }
    }
  }

  return mismatches;
}

/** The forms i18next picks from in this locale: es, fr and pt use `_many` for large round numbers, 1 000 000 in French. */
function pluralCategoriesOf(locale: string): readonly string[] {
  return new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
}

export interface IncompletePlural {
  locale: string;
  present: string;
  missing: string;
}

/**
 * A count key with `_one` and no `_other` falls back to the key path for every
 * number except one — which is the plural most readers will see most often.
 *
 * Checked in BOTH directions. `_other` alone is the same bug wearing the other
 * hat, and it is the more likely one: somebody writes the general case first.
 * And against the locale's own rules, so a family missing `_many` in es, fr or
 * pt is caught too (sc-3980).
 */
export function pluralFamilies(surface: Surface): IncompletePlural[] {
  const incomplete: IncompletePlural[] = [];

  for (const locale of LOCALES) {
    const keys = keysOf(load(surface, locale));
    const categories = new Set(['one', 'other', ...pluralCategoriesOf(locale)]);

    for (const key of keys) {
      const form = pluralForm(key);
      if (form == null || (form.category !== 'one' && form.category !== 'other')) continue;

      for (const category of categories) {
        const expected = `${form.base}_${category}`;
        if (category !== form.category && !keys.includes(expected)) {
          incomplete.push({ locale, present: key, missing: expected });
        }
      }
    }
  }

  return incomplete;
}

export interface WordDrift {
  locale: string;
  word: string;
  /** What each copy reads, by the copy's name; null where it has no such word. */
  readings: Record<string, string | null>;
}

/** A word one copy lacks, or reads differently from the others, in any locale. */
export function wordDrift(
  copies: readonly WordCopy[],
  read: (copy: WordCopy, locale: string) => Catalogue = load,
): WordDrift[] {
  return LOCALES.flatMap((locale) => {
    const found = copies.map((copy) => wordsUnder(stringsOf(read(copy, locale)), copy.under));
    const words = [...new Set(found.flatMap((each) => [...each.keys()]))].sort();

    return words.flatMap((word) => {
      const readings = found.map((each) => each.get(word) ?? null);

      return new Set(readings).size === 1
        ? []
        : [
            {
              locale,
              word,
              readings: Object.fromEntries(
                copies.map((copy, index) => [copy.name, readings[index] ?? null]),
              ),
            },
          ];
    });
  });
}

function wordsUnder(strings: Map<string, string>, under: string): Map<string, string> {
  const prefix = `${under}.`;

  return new Map(
    [...strings]
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, text]) => [key.slice(prefix.length), text]),
  );
}

export interface BareNumber {
  locale: string;
  key: string;
  /** The slot as written, or `#` for an ICU plural's own number. */
  slot: string;
}

const ICU_SLOT = /\{\s*(\w+)\s*(?:,\s*(\w+)\s*(?:,\s*([^{}]*?))?)?\s*\}/g;

const COUNTING_ARGUMENT = /^\{\s*\w+\s*,\s*(?:plural|selectordinal)\s*,/;

/** `#` is the count only inside a plural or selectordinal branch; elsewhere it is a literal. */
function countsWithHash(text: string): boolean {
  const counting: boolean[] = [];

  for (let at = 0; at < text.length; at++) {
    const char = text[at];

    if (char === '{') counting.push(COUNTING_ARGUMENT.test(text.slice(at)));
    else if (char === '}') counting.pop();
    else if (char === '#' && counting.includes(true)) return true;
  }

  return false;
}

/** Whether a slot writes a number as bare digits, by the syntax its catalogue is in. */
function bareIn(text: string, syntax: NumberCatalogue['syntax']): string[] {
  if (syntax === 'i18next') {
    return [...text.matchAll(I18NEXT_SLOT)]
      .filter(([, name, format]) => NUMBER_SLOTS.includes(name!) && format?.trim() !== 'number')
      .map(([slot]) => slot);
  }

  const slots = [...text.matchAll(ICU_SLOT)].filter(([, name]) => NUMBER_SLOTS.includes(name!));

  if (syntax === 'plain') return slots.map(([slot]) => slot);

  // `#` and a plain `{n, number}` ignore CLDR's minimum grouping and write «1.000» in es.
  return [
    ...slots
      .filter(
        ([, , type, style]) =>
          type !== 'plural' &&
          type !== 'select' &&
          !(type === 'number' && style === '::group-auto'),
      )
      .map(([slot]) => slot),
    ...(countsWithHash(text) ? ['#'] : []),
  ];
}

/** "1000000 de personnes" where French writes « 1 000 000 de personnes » (sc-15361). */
export function bareNumbers(
  catalogue: NumberCatalogue,
  read: (catalogue: NumberCatalogue, locale: string) => Catalogue = load,
): BareNumber[] {
  return LOCALES.flatMap((locale) =>
    [...stringsOf(read(catalogue, locale))].flatMap(([key, text]) =>
      bareIn(text, catalogue.syntax).map((slot) => ({ locale, key, slot })),
    ),
  );
}
