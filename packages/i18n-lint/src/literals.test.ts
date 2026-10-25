import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { findLiterals } from './literals.ts';
import { sourcesOf } from './sources.ts';
import { LITERAL_EXEMPT, ROOT, SURFACES } from './surfaces.ts';

/**
 * No user-facing text written as a literal.
 *
 * The check that catches the thing nothing else does: a string that renders
 * perfectly in English, has no key, and is simply absent in the other three
 * languages. No type error, no failing request, no log line.
 */
const exemptPaths = new Set(LITERAL_EXEMPT.map((e) => e.path));

describe.each(SURFACES.filter((s) => s.sources.length > 0).map((s) => [s.name, s] as const))(
  '%s',
  (_name, surface) => {
    it('has no user-facing string literals', () => {
      const offenders = sourcesOf(surface.sources)
        .filter(({ path }) => !exemptPaths.has(path))
        .flatMap(({ path, text }) =>
          findLiterals(path, text).map((f) => `${path}:${f.line} ${f.reason}: ${f.text}`),
        );

      expect(
        offenders,
        'Route it through t() and add the key to all four locales. If it genuinely cannot be translated, add it to LITERAL_EXEMPT in surfaces.ts with a reason.',
      ).toEqual([]);
    });
  },
);

/**
 * An exemption that suppresses nothing is deleted.
 *
 * This is what stops the list growing forever. A suppression nobody revisits is
 * the normal end state of every opt-out mechanism, so the check is that each
 * one is still load-bearing.
 */
it('has no stale exemptions', () => {
  const stale = LITERAL_EXEMPT.filter((exemption) => {
    const text = readFileSync(join(ROOT, exemption.path), 'utf8');

    return findLiterals(exemption.path, text).length === 0;
  }).map((e) => e.path);

  expect(stale, 'these no longer contain any literal — remove them from LITERAL_EXEMPT').toEqual(
    [],
  );
});

it('gives every exemption a reason', () => {
  const unreasoned = LITERAL_EXEMPT.filter((e) => e.because.trim().length < 20).map((e) => e.path);

  expect(unreasoned, 'an exemption without a reason is a suppression').toEqual([]);
});

/**
 * The scanner, against the shapes it has to get right.
 *
 * The wrapped case is the one that matters: the previous sweep used a
 * single-line regex, could not see prose broken across lines of markup, and
 * eleven strings passed every check and shipped.
 */
describe('the scanner', () => {
  const scan = (source: string) => findLiterals('fixture.tsx', source);

  it('finds text on one line', () => {
    expect(scan('const a = <Text>Save changes</Text>;')).toHaveLength(1);
  });

  it('finds prose WRAPPED across several lines, which a per-line regex cannot', () => {
    const wrapped = `
      const a = (
        <Text>
          This invitation link does not work. It may have expired, or been
          replaced by a newer one.
        </Text>
      );`;

    const found = scan(wrapped);

    expect(found).toHaveLength(1);
    expect(found[0]?.reason).toBe('text in markup');
  });

  it('finds a user-facing prop', () => {
    expect(scan('const a = <Input placeholder="Search guests" />;')).toHaveLength(1);
  });

  it('finds a template literal with no substitutions, which is a literal in disguise', () => {
    expect(scan('const a = <Input placeholder={`Search guests`} />;')).toHaveLength(1);
  });

  it('finds a prop declared on a later line than its tag', () => {
    const wrapped = `
      const a = (
        <Input
          value={v}
          placeholder="Search guests"
        />
      );`;

    expect(scan(wrapped)).toHaveLength(1);
  });

  it('passes text that goes through t()', () => {
    expect(scan("const a = <Text>{t('actions.save')}</Text>;")).toEqual([]);
  });

  it('passes a prop that goes through t()', () => {
    expect(scan("const a = <Input placeholder={t('guests.search')} />;")).toEqual([]);
  });

  /**
   * Punctuation and decoration are identical in every language. Flagging them
   * trains people to add exemptions, which is how a guard stops being read.
   */
  it.each(['←', '·', '—', '×', '42', '%', ':', '→ ←'])('passes the decoration %s', (symbol) => {
    expect(scan(`const a = <Text>${symbol}</Text>;`)).toEqual([]);
  });

  it('passes a single letter, which is an initial or a label and not prose', () => {
    expect(scan('const a = <Text>A</Text>;')).toEqual([]);
  });

  /**
   * The false positives a `>…<` regex invites. None of these is text, and all
   * three contain the characters such a pattern looks for.
   */
  it.each([
    ['an arrow function', 'const f = (a: number) => a > 1;'],
    ['a generic', 'const xs: Array<string> = [];'],
    ['a comparison', 'const ok = width > height && height < width;'],
  ])('passes %s', (_name, source) => {
    expect(scan(source)).toEqual([]);
  });

  it('passes a prop that is not user-facing', () => {
    expect(scan('const a = <Pressable accessibilityRole="button" />;')).toEqual([]);
  });

  it('passes a log message, which no reader sees', () => {
    expect(scan("console.warn('Resource read failed for the guest token');")).toEqual([]);
  });

  it('passes a translation key, which is the correct shape', () => {
    expect(scan("const key = 'guest.invalidTitle';")).toEqual([]);
  });

  it('passes children of a Trans component, where the children are the translation', () => {
    expect(scan('const a = <Trans>Hello <strong>world</strong></Trans>;')).toEqual([]);
  });

  /**
   * The line the PROSE is on, not the line the tag is on.
   *
   * Leading whitespace is part of a JSX text node, and the start position
   * skips it — so a developer following the message lands on the words rather
   * than on the opening tag several lines above them. Asserted because it is a
   * behaviour worth keeping, not an accident.
   */
  it('reports the line the words are on, not the line the tag is on', () => {
    const found = scan('const a = <Text>\n  Save changes\n</Text>;');

    expect(found[0]?.line).toBe(2);
  });
});
