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
      selfClosing('TextInput', text)
        .filter((tag) => !caretSet(tag.markup))
        .map((tag) => `${path}:${tag.line}`),
    );

    expect(
      offenders,
      'Spread FIELD_DEFAULTS, codeProps() or passwordProps() from src/kit/fields.ts.',
    ).toEqual([]);
  });

  it('notices a TextInput that leaves the caret to the platform', () => {
    expect(
      selfClosing('TextInput', '<TextInput\n  style={styles.input}\n/>').filter(
        (tag) => !caretSet(tag.markup),
      ),
    ).toHaveLength(1);
    expect(selfClosing('TextInput', 'const input = useRef<TextInput>(null);')).toHaveLength(0);
    expect(
      selfClosing('TextInput', '<TextInput {...FIELD_DEFAULTS} style={x} />').filter(
        (tag) => !caretSet(tag.markup),
      ),
    ).toHaveLength(0);
  });
});

describe('the account cards share one frame', () => {
  it('draws the card frame only in cardFrame.ts', () => {
    const offenders = sources(['src', 'app'])
      .filter(({ path }) => !path.endsWith('cardFrame.ts'))
      .filter(({ text }) => /padding: tokens\.space3xl, maxWidth: 640\b/u.test(text))
      .map(({ path }) => path);

    expect(offenders, 'Use cardFrame(kind) from src/components/cardFrame.ts.').toEqual([]);
  });
});

describe('changing the layout keeps the form', () => {
  // A frame that returns a different tree per layout remounts the form, and a rotation throws away what was typed.
  it('is one tree at every size in AuthFrame', () => {
    const frame = sources(['src/components']).find(({ path }) => path.endsWith('AuthFrame.tsx'));

    expect(frame, 'AuthFrame.tsx').toBeDefined();
    expect(frame?.text.match(/<Screen\b/gu)?.length, 'one <Screen>, not one per layout').toBe(1);
  });
});

describe('the app runs on Hermes', () => {
  // Hermes lacks these: a screen that calls one without its polyfill crashes on open (sc-509 QA, #1113).
  const POLYFILLED = { ListFormat: 'intl-listformat', DisplayNames: 'intl-displaynames' } as const;

  it('polyfills every Intl API it calls that Hermes lacks', () => {
    const polyfills = readFileSync(join(import.meta.dirname, 'intl.ts'), 'utf8');
    const missing = Object.entries(POLYFILLED).filter(
      ([api, pkg]) =>
        sources(['src', 'app']).some(({ text }) => text.includes(`Intl.${api}`)) &&
        !polyfills.includes(`@formatjs/${pkg}/polyfill.js`),
    );

    expect(missing.map(([api]) => api)).toEqual([]);
  });
});

describe('a field that takes a recovery code gets the full keyboard', () => {
  // sc-124 QA #1616: these fields fell back to the number pad, and a recovery code has letters and a hyphen.
  const RECOVERY_CODE_FIELDS = ['devices.everywhere.code', 'ways.code'];

  it.each(RECOVERY_CODE_FIELDS)('%s', (testID) => {
    const fields = sources(['src', 'app']).flatMap(({ text }) =>
      selfClosing('CodeField', text).filter((tag) => tag.markup.includes(`testID="${testID}"`)),
    );

    expect(fields, `one CodeField with testID "${testID}"`).toHaveLength(1);
    expect(takesRecoveryCode(fields[0]?.markup ?? '')).toBe(true);
  });

  it('notices a CodeField that leaves it out', () => {
    expect(takesRecoveryCode('<CodeField\n  wrong={false}\n  testID="ways.code"\n')).toBe(false);
    expect(takesRecoveryCode('<CodeField takesRecoveryCode={false} testID="ways.code" ')).toBe(
      false,
    );
    expect(takesRecoveryCode('<CodeField\n  takesRecoveryCode\n  testID="ways.code"\n')).toBe(true);
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

/** A TextInput or CodeField is always self-closing here, so its markup runs to the next `/>`. */
function selfClosing(name: string, text: string): { line: number; markup: string }[] {
  // Not after an identifier, so a type argument such as useRef<TextInput> is not markup.
  return [...text.matchAll(new RegExp(`(?<![\\w.])<${name}\\b`, 'gu'))].map((match) => {
    const start = match.index;
    const end = text.indexOf('/>', start);

    return { line: text.slice(0, start).split('\n').length, markup: text.slice(start, end) };
  });
}

function caretSet(markup: string): boolean {
  return (
    /\{\.\.\.(FIELD_DEFAULTS|codeProps\(|passwordProps\()/u.test(markup) ||
    /\bcursorColor=/u.test(markup)
  );
}

function takesRecoveryCode(markup: string): boolean {
  return /\btakesRecoveryCode(?!=\{false\})\b/u.test(markup);
}
