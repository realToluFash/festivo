import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Two shapes that crash this app on web, caught at the source.
 *
 * A `Text` nested inside a `Text`, and a `Text` given an `onPress`, both
 * crashed the previous build on React Native Web because of how the font mapper
 * resolves weights. Neither crashes on iOS or Android, so the pattern gets
 * written, reviewed, merged and shipped, and only the web build falls over.
 *
 * Twelve lines of check for a whole class of defect, permanently — and the
 * reason it is a scanner rather than a regex per line is the previous sweep:
 * it used a single-line pattern, could not see prose WRAPPED across several
 * lines of markup, and eleven cases passed every check and shipped.
 */
const ROOTS = ['src', 'app'];

interface Source {
  path: string;
  text: string;
}

describe('no Text nested inside a Text', () => {
  it('holds across every screen and component, including markup wrapped over lines', () => {
    const offenders = sources().flatMap(({ path, text }) =>
      nestedTextAt(strip(text)).map((line) => `${path}:${line}`),
    );

    expect(
      offenders,
      'A Text inside a Text crashes on React Native Web. Use sibling Text elements in a View.',
    ).toEqual([]);
  });

  /** The scanner itself, because a guard that cannot fail protects nothing. */
  it('finds a nesting written across several lines', () => {
    const wrapped = `
      <Text>
        Some prose that runs on, and then
        <Text weight="bold">emphasis</Text>
        and more prose.
      </Text>`;

    expect(nestedTextAt(strip(wrapped))).not.toEqual([]);
  });

  it('does not fire on siblings, which is the correct shape', () => {
    const siblings = `
      <View>
        <Text>One</Text>
        <Text weight="bold">Two</Text>
      </View>`;

    expect(nestedTextAt(strip(siblings))).toEqual([]);
  });

  it('does not fire on a self-closing Text', () => {
    expect(nestedTextAt(strip('<Text><Text />'))).not.toEqual([]);
    expect(nestedTextAt(strip('<View><Text /><Text /></View>'))).toEqual([]);
  });
});

describe('no onPress on a Text', () => {
  it('holds across every screen and component', () => {
    const offenders = sources().flatMap(({ path, text }) =>
      pressableTextAt(strip(text)).map((line) => `${path}:${line}`),
    );

    expect(
      offenders,
      'A Text with onPress crashes on React Native Web. Wrap a Text in a Pressable instead.',
    ).toEqual([]);
  });

  it('finds an onPress declared on a later line than the tag', () => {
    const wrapped = `
      <Text
        weight="medium"
        onPress={handle}
      >Tap</Text>`;

    expect(pressableTextAt(strip(wrapped))).not.toEqual([]);
  });

  it('does not fire on a Pressable wrapping a Text, which is the fix', () => {
    const correct = `
      <Pressable onPress={handle}>
        <Text weight="medium">Tap</Text>
      </Pressable>`;

    expect(pressableTextAt(strip(correct))).toEqual([]);
  });
});

describe('every TextInput takes its face from inputFaced()', () => {
  it('holds across every screen and component', () => {
    const offenders = sources().flatMap(({ path, text }) =>
      unfacedInputAt(strip(text)).map((line) => `${path}:${line}`),
    );

    expect(
      offenders,
      'A TextInput draws in the platform font, and on Android drops Bold text once its text is handed again, unless its style goes through inputFaced().',
    ).toEqual([]);
  });

  it('finds an input whose style skips inputFaced(), written across lines', () => {
    const raw = `
      <TextInput
        value={value}
        style={[styles.input, wrong && styles.wrong]}
      />`;

    expect(unfacedInputAt(strip(raw))).not.toEqual([]);
    expect(unfacedInputAt(strip('<TextInput value={value} />'))).not.toEqual([]);
    expect(unfacedInputAt(strip('<TextInput style={faced([styles.input])} />'))).not.toEqual([]);
  });

  it('does not fire on an input styled through inputFaced()', () => {
    expect(unfacedInputAt(strip('<TextInput style={inputFaced([styles.input])} />'))).toEqual([]);
  });
});

/** Lines where a `<TextInput` opens without `style={inputFaced(`. */
function unfacedInputAt(text: string): number[] {
  const found: number[] = [];
  const pattern = /(?<![A-Za-z0-9_])<TextInput(?![A-Za-z0-9_])/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) != null) {
    const end = text.indexOf('/>', match.index);
    const tag = end === -1 ? text.slice(match.index) : text.slice(match.index, end);

    if (!/\bstyle=\{inputFaced\(/.test(tag))
      found.push(text.slice(0, match.index).split('\n').length);
  }

  return found;
}

/**
 * Comments and string literals removed, so a rule written about the pattern in
 * prose does not report itself. Newlines are preserved so line numbers survive.
 */
function strip(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length))
    .replace(/`(?:\\.|[^`\\])*`/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/'(?:\\.|[^'\\])*'/g, (m) => ' '.repeat(m.length))
    .replace(/"(?:\\.|[^"\\])*"/g, (m) => ' '.repeat(m.length));
}

/** Lines where a `<Text` opens while another is already open. */
function nestedTextAt(text: string): number[] {
  const found: number[] = [];
  let depth = 0;

  for (const tag of tags(text)) {
    if (tag.kind === 'close') {
      depth = Math.max(0, depth - 1);
      continue;
    }

    // The depth check comes FIRST, before the self-closing skip: `<Text />`
    // inside a `<Text>` is still a Text inside a Text, and skipping the whole
    // tag missed it. Only the depth INCREMENT is skipped, because a
    // self-closing tag opens nothing.
    if (depth > 0) found.push(tag.line);

    if (!tag.selfClosing) depth += 1;
  }

  return found;
}

/** Lines where a `<Text` carries onPress or onLongPress anywhere in its tag. */
function pressableTextAt(text: string): number[] {
  return tags(text)
    .filter((tag) => tag.kind === 'open' && /\bon(Press|LongPress)\b/.test(tag.attributes))
    .map((tag) => tag.line);
}

interface Tag {
  kind: 'open' | 'close';
  selfClosing: boolean;
  attributes: string;
  line: number;
}

/**
 * Every `<Text …>` and `</Text>` in the file, with the whole tag read across
 * however many lines it spans. This is the part a per-line regex cannot do.
 */
function tags(text: string): Tag[] {
  const found: Tag[] = [];
  // `<Text` or `</Text`, but not `<TextInput`: the boundary check is what keeps
  // every TextInput in the codebase out of the results.
  const pattern = /<(\/?)Text(?![A-Za-z0-9_])/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) != null) {
    const start = match.index;
    const end = text.indexOf('>', start);
    const tag = end === -1 ? text.slice(start) : text.slice(start, end + 1);

    found.push({
      kind: match[1] === '/' ? 'close' : 'open',
      selfClosing: tag.trimEnd().endsWith('/>'),
      attributes: tag,
      line: text.slice(0, start).split('\n').length,
    });
  }

  return found;
}

function sources(): Source[] {
  const base = join(import.meta.dirname, '..');
  const found: Source[] = [];

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        walk(path);
      } else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) {
        found.push({ path: path.slice(base.length + 1), text: readFileSync(path, 'utf8') });
      }
    }
  };

  for (const root of ROOTS) walk(join(base, root));

  return found;
}
