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

import { LOCALES, ROOT, type Surface } from './surfaces.ts';

export type Catalogue = Record<string, unknown>;

export function load(surface: Surface, locale: string): Catalogue {
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
      if (!expected.includes(key)) extra.push({ locale, key });
    }
  }

  return { missing, extra };
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

/** The `{{name}}` slots in a message, sorted. */
export function slotsIn(text: string): string[] {
  return [...text.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]!).sort();
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
      const reference = expected.get(key);
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
 */
export function pluralFamilies(surface: Surface): IncompletePlural[] {
  const incomplete: IncompletePlural[] = [];

  for (const locale of LOCALES) {
    const keys = keysOf(load(surface, locale));

    for (const key of keys) {
      for (const [suffix, counterpart] of [
        ['_one', '_other'],
        ['_other', '_one'],
      ] as const) {
        if (!key.endsWith(suffix)) continue;

        const expected = key.slice(0, -suffix.length) + counterpart;
        if (!keys.includes(expected)) {
          incomplete.push({ locale, present: key, missing: expected });
        }
      }
    }
  }

  return incomplete;
}
