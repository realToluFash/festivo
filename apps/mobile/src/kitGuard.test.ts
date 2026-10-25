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

describe('screen reader focus moves on both platforms', () => {
  it('is moved only in screenReaderFocus.ts', () => {
    const offenders = sources(['src', 'app'])
      .filter(({ path }) => !path.endsWith('/screenReaderFocus.ts'))
      .filter(({ text }) => movesFocus(text))
      .map(({ path }) => path);

    expect(
      offenders,
      'Use moveScreenReaderFocus(view) from src/components/screenReaderFocus.ts.',
    ).toEqual([]);
  });

  it('notices a screen that moves focus itself', () => {
    expect(movesFocus('if (node != null) AccessibilityInfo.setAccessibilityFocus(node);')).toBe(
      true,
    );
    expect(movesFocus("AccessibilityInfo.sendAccessibilityEvent(view, 'focus');")).toBe(true);
    expect(movesFocus('moveScreenReaderFocus(ref.current);')).toBe(false);
  });
});

describe('a message is read out on both platforms', () => {
  // A live region means nothing to VoiceOver, so a message marked with one alone is silent on iOS (sc-10955).
  it('is marked only in ReadOut.tsx', () => {
    const offenders = sources(['src', 'app'])
      .filter(({ path }) => !path.endsWith('/ReadOut.tsx'))
      .filter(({ text }) => readsOut(text))
      .map(({ path }) => path);

    expect(
      offenders,
      'Use ReadOut, useReadOut or readOut from src/components/ReadOut.tsx.',
    ).toEqual([]);
  });

  it('notices a screen that marks a message itself', () => {
    expect(readsOut('<View accessibilityLiveRegion="polite">')).toBe(true);
    expect(readsOut('<Text style={styles.error} aria-live="polite">')).toBe(true);
    expect(readsOut('AccessibilityInfo.announceForAccessibility(words);')).toBe(true);
    expect(readsOut('<ReadOut words={saved}>')).toBe(false);
  });
});

describe('a screen reader skips the initials beside a name', () => {
  it('on both platforms, in every tile in the app', () => {
    const offenders = sources(['src', 'app']).flatMap(({ path, text }) =>
      [...text.matchAll(/\{initials\(/gu)]
        .filter(
          (match) => !hiddenTile(text.slice(text.lastIndexOf('<View', match.index), match.index)),
        )
        .map((match) => `${path}:${text.slice(0, match.index).split('\n').length}`),
    );

    expect(offenders).toEqual([]);
  });

  it('notices a tile Android still reads', () => {
    expect(
      hiddenTile('<View accessibilityElementsHidden importantForAccessibility="no"><Text>'),
    ).toBe(false);
    expect(hiddenTile('<View style={styles.tile}><Text>')).toBe(false);
    expect(
      hiddenTile(
        '<View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Text>',
      ),
    ).toBe(true);
  });
});

describe('a screen reader reaches what is inside a button', () => {
  // iOS reads a Pressable as one item, so a button inside another is out of VoiceOver's reach (sc-10712).
  it('in every Pressable in the app', () => {
    const offenders = sources(['src', 'app']).flatMap(({ path, text }) =>
      nestedPressables(text).map((line) => `${path}:${line}`),
    );

    expect(offenders, 'Make the outer press a sibling, not a parent.').toEqual([]);
  });

  it('notices a Pressable inside another', () => {
    expect(
      nestedPressables(
        '<Pressable onPress={() => close()}>\n  <Pressable onPress={x} />\n</Pressable>',
      ),
    ).toEqual([2]);
    expect(
      nestedPressables(
        '<Pressable onPress={x} />\n<Pressable style={a > b ? s : t}>\n</Pressable>',
      ),
    ).toEqual([]);
  });
});

describe('a field is read by the name it shows', () => {
  // sc-11238: a label chosen once for the eye and once for the reader drifted apart (WCAG 2.5.3, Label in Name).
  it('in every Field in the app', () => {
    const offenders = sources(['src', 'app']).flatMap(({ path, text }) =>
      fieldsReadByAnotherName(text).map((line) => `${path}:${line}`),
    );

    expect(offenders, 'Give the control the accessibilityLabel its Field shows.').toEqual([]);
  });

  it('notices a field read by another name', () => {
    expect(
      fieldsReadByAnotherName(
        "<Field label={t('a')}>\n  <CodeField accessibilityLabel={t('b')} />\n</Field>",
      ),
    ).toEqual([1]);
    expect(
      fieldsReadByAnotherName(
        "<Field label={t(x ? 'a' : 'b')} error={e}>\n  <CodeField accessibilityLabel={t(x ? 'a' : 'b')} />\n</Field>",
      ),
    ).toEqual([]);
    expect(
      fieldsReadByAnotherName(
        "<Field\n  label={t(\n    x ? 'a' : 'b',\n  )}\n>\n  <CodeField\n    accessibilityLabel={t(\n      x ? 'a' : 'b',\n    )}\n  />\n</Field>",
      ),
    ).toEqual([]);
    expect(
      fieldsReadByAnotherName("<Field label={t('a')}>\n  <TextField value={v} />\n</Field>"),
    ).toEqual([]);
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
  // The proof step's field is ConfirmItsYou's, named by the card that opens it (ways, contacts).
  const RECOVERY_CODE_FIELDS = ['devices.everywhere.code', '${idPrefix}.code'];

  it.each(RECOVERY_CODE_FIELDS)('%s', (testID) => {
    const fields = sources(['src', 'app']).flatMap(({ text }) =>
      selfClosing('CodeField', text).filter(
        (tag) =>
          tag.markup.includes(`testID="${testID}"`) ||
          tag.markup.includes(`testID={\`${testID}\`}`),
      ),
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

describe('a refused submit leaves the keyboard as it was', () => {
  // sc-9471: a field disabled while saving lost its focus, so a server refusal closed the keyboard and a client one did not.
  const HELD_FORMS = ['CreateOrganisation.tsx', 'PasswordCard.tsx', 'TimeZoneCard.tsx'];
  const FIELDS = ['TextField', 'PasswordField', 'CodeField'];

  it.each(HELD_FORMS)('%s holds its fields rather than disabling them', (file) => {
    const form = sources(['src/components']).find(({ path }) => path.endsWith(`/${file}`));
    const fields = FIELDS.flatMap((name) => selfClosing(name, form?.text ?? ''));

    expect(fields.length, `fields in ${file}`).toBeGreaterThan(0);
    expect(
      fields.filter((tag) => /\beditable=/u.test(tag.markup)).map((tag) => `${file}:${tag.line}`),
      'Pass submitting={saving}: editable={false} drops the focus and the keyboard.',
    ).toEqual([]);
    expect(
      fields
        .filter((tag) => tag.markup.includes('onSubmitEditing={() => void'))
        .filter((tag) => !tag.markup.includes('submitBehavior="submit"'))
        .map((tag) => `${file}:${tag.line}`),
      'A field that submits the form keeps its focus on return.',
    ).toEqual([]);
    expect(
      (form?.text ?? '')
        .split('\n')
        .map((line, index) => ({ line, at: `${file}:${index + 1}` }))
        .filter(({ line }) => /\.current\?\.focus\(\)/u.test(line))
        .filter(({ line }) => !line.includes('onSubmitEditing='))
        .map(({ at }) => at),
      'A refusal focuses through focusChecked or focusRefused: focus() skips a field Android left focused with the keys hidden.',
    ).toEqual([]);
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

function movesFocus(text: string): boolean {
  return /\b(setAccessibilityFocus|sendAccessibilityEvent)\(/u.test(text);
}

function readsOut(text: string): boolean {
  return /\baccessibilityLiveRegion\b|\baria-live\b|\bannounceForAccessibility(WithOptions)?\(/u.test(
    text,
  );
}

/** importantForAccessibility="no" leaves an Android tile's letters to be read; only its descendants hidden skips them. */
function hiddenTile(markup: string): boolean {
  return (
    /\baccessibilityElementsHidden\b/u.test(markup) &&
    /\bimportantForAccessibility="no-hide-descendants"/u.test(markup)
  );
}

/** The line of every Pressable that opens inside another one, read tag by tag. */
function nestedPressables(text: string): number[] {
  const nested: number[] = [];
  let depth = 0;

  for (const match of text.matchAll(/(?<![\w.])<(\/?)Pressable\b/gu)) {
    if (match[1] === '/') {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth > 0) nested.push(text.slice(0, match.index).split('\n').length);
    if (!selfCloses(text, match.index)) depth += 1;
  }

  return nested;
}

/** The line of every Field whose control carries an accessibilityLabel other than the Field's label. */
function fieldsReadByAnotherName(text: string): number[] {
  return [...text.matchAll(/(?<![\w.])<Field\b/gu)].flatMap((match) => {
    const body = text.slice(match.index, text.indexOf('</Field>', match.index));
    const label = propValue(body.slice(0, tagEnd(body, 0)), 'label');
    const read = propValue(body.slice(tagEnd(body, 0)), 'accessibilityLabel');

    return read == null || read.replace(/\s+/gu, '') === label?.replace(/\s+/gu, '')
      ? []
      : [text.slice(0, match.index).split('\n').length];
  });
}

/** A prop's value as written, its braces balanced, or null when the markup does not set it. */
function propValue(markup: string, name: string): string | null {
  const start = markup.search(new RegExp(`\\b${name}=`, 'u'));
  if (start === -1) return null;

  const from = start + name.length + 1;
  if (markup[from] !== '{') return markup.slice(from).split(/[\s>]/u)[0] ?? '';

  let braces = 0;
  for (let at = from; at < markup.length; at += 1) {
    if (markup[at] === '{') braces += 1;
    else if (markup[at] === '}' && --braces === 0) return markup.slice(from, at + 1);
  }

  return markup.slice(from);
}

/** Where the tag opening at `start` ends, skipping any `>` inside a prop's braces. */
function tagEnd(text: string, start: number): number {
  let braces = 0;

  for (let at = start + 1; at < text.length; at += 1) {
    if (text[at] === '{') braces += 1;
    else if (text[at] === '}') braces -= 1;
    else if (text[at] === '>' && braces === 0) return at + 1;
  }

  return text.length;
}

/** Whether the tag opening at `start` ends in `/>`, skipping any `>` inside a prop's braces. */
function selfCloses(text: string, start: number): boolean {
  return text.slice(start, tagEnd(text, start)).endsWith('/>');
}
