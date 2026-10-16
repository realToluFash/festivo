import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// The kit only holds if screens cannot quietly go around it, so its rules are read from the source.
const KIT_STYLES = [
  'cta',
  'ctaOff',
  'ctaBusy',
  'input',
  'inputWrong',
  'inputWithReveal',
  'reveal',
  'code',
  'fieldError',
  'mark',
  'footnote',
  'footnoteAction',
  'card',
  'brandRow',
  'phoneContent',
  'portraitContent',
  'landscapeContent',
];

describe('every field carries the caret colour', () => {
  it('in every TextInput in the app', () => {
    const offenders = sources(['src', 'app']).flatMap(({ path, text }) =>
      textInputs(text)
        .filter((tag) => !caretSet(tag.markup))
        .map((tag) => `${path}:${tag.line}`),
    );

    expect(
      offenders,
      'Spread FIELD_DEFAULTS, CODE_PROPS or passwordProps() from src/kit/fields.ts.',
    ).toEqual([]);
  });

  it('notices a TextInput that leaves the caret to the platform', () => {
    expect(
      textInputs('<TextInput\n  style={styles.input}\n/>').filter((tag) => !caretSet(tag.markup)),
    ).toHaveLength(1);
    expect(textInputs('const input = useRef<TextInput>(null);')).toHaveLength(0);
    expect(
      textInputs('<TextInput {...FIELD_DEFAULTS} style={x} />').filter(
        (tag) => !caretSet(tag.markup),
      ),
    ).toHaveLength(0);
  });
});

describe('a screen is a composition of the kit', () => {
  it('takes its fields from the kit, never a bare TextInput', () => {
    const offenders = sources(['app'])
      .filter(({ text }) =>
        /import\s*\{[^}]*(?<!type )\bTextInput\b[^}]*\}\s*from\s*'react-native'/u.test(text),
      )
      .map(({ path }) => path);

    expect(offenders, 'Use TextField, PasswordField or CodeField from src/components.').toEqual([]);
  });

  it('keeps no local copy of a style the kit provides', () => {
    const offenders = sources(['app']).flatMap(({ path, text }) =>
      KIT_STYLES.filter((key) => new RegExp(`^\\s{2}${key}: `, 'mu').test(text)).map(
        (key) => `${path}: ${key}`,
      ),
    );

    expect(offenders).toEqual([]);
  });
});

interface Source {
  path: string;
  text: string;
}

function sources(roots: readonly string[]): Source[] {
  return roots.flatMap((root) => walk(join(__dirname, '..', root)));
}

function walk(directory: string): Source[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory())
      return entry.name.startsWith('.') || entry.name === 'node_modules' ? [] : walk(path);
    if (!/\.tsx?$/u.test(entry.name) || entry.name.includes('.test.')) return [];

    return [{ path, text: readFileSync(path, 'utf8') }];
  });
}

/** A TextInput is always self-closing here, so its markup runs to the next `/>`. */
function textInputs(text: string): { line: number; markup: string }[] {
  // Not after an identifier, so a type argument such as useRef<TextInput> is not markup.
  return [...text.matchAll(/(?<![\w.])<TextInput\b/gu)].map((match) => {
    const start = match.index;
    const end = text.indexOf('/>', start);

    return { line: text.slice(0, start).split('\n').length, markup: text.slice(start, end) };
  });
}

function caretSet(markup: string): boolean {
  return (
    /\{\.\.\.(FIELD_DEFAULTS|CODE_PROPS|passwordProps\()/u.test(markup) ||
    /\bcursorColor=/u.test(markup)
  );
}
