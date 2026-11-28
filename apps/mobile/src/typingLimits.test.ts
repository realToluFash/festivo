import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/** React Native's maxLength counts UTF-16 units, not the letters a person sees (sc-54292). */
const ROOTS = ['src', 'app'];
const DIGITS_ONLY = ['src/steps/CodeBoxes.tsx'];

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === 'demo' ? [] : sources(path);
    }
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe('no field stops typing at a count of code units', () => {
  it('holds on every screen of the app outside the demos', () => {
    const offenders = ROOTS.flatMap(sources)
      .filter((path) => !DIGITS_ONLY.includes(path))
      .flatMap((path) =>
        readFileSync(path, 'utf8')
          .split('\n')
          .flatMap((line, index) => (/\bmaxLength\b/.test(line) ? [`${path}:${index + 1}`] : [])),
      );

    expect(offenders).toEqual([]);
  });
});
