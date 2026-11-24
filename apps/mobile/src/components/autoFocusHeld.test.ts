import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(join('src', 'components', file), 'utf8');
const field = read('Field.tsx');
const hook = /export function useAutoFocusHeld\([\s\S]*?\n\}/u.exec(field)?.[0] ?? '';

describe('an Android field that opens focused takes typing at once (sc-91027)', () => {
  it('takes focus again as the keys rise and once its window has arrived', () => {
    expect(hook).toMatch(/useState\(\(\) => Platform\.OS === 'android' && autoFocus === true\)/u);
    expect(hook).toMatch(/Keyboard\.addListener\('keyboardDidShow', retake\)/u);
    expect(hook).toMatch(
      /setTimeout\(\(\) => \{\s+risen\.remove\(\);\s+retake\(\);\s+\}, OPENED_FIELD_SETTLED_MS\)/u,
    );
  });

  it('never takes focus from another field', () => {
    expect(hook).toMatch(
      /const holder = TextInput\.State\.currentlyFocusedInput\(\);\s+if \(holder == null \|\| holder === field\) raiseKeysOn\(field\);/u,
    );
  });

  it('holds every field kind that can open focused', () => {
    expect(field.match(/const opened = useAutoFocusHeld\(rest\.autoFocus\);/gu)).toHaveLength(2);
    expect(field.match(/ref=\{bothRefs\(opened, ref\)\}/gu)).toHaveLength(2);
    const password = read('PasswordField.tsx');
    expect(password).toMatch(/const opened = useAutoFocusHeld\(rest\.autoFocus\);/u);
    expect(password).toMatch(/ref=\{bothRefs\(opened, ref\)\}/u);
  });
});
