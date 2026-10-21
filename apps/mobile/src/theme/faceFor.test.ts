import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { MONO, SANS, faceFor } from './faceFor.ts';

describe('a weight draws from its own file', () => {
  it('gives each of the four design weights a different Instrument Sans file', () => {
    expect(['400', '500', '600', '700'].map((weight) => faceFor(weight))).toEqual([
      { family: 'InstrumentSans-Regular', weight: 400 },
      { family: 'InstrumentSans-Medium', weight: 500 },
      { family: 'InstrumentSans-SemiBold', weight: 600 },
      { family: 'InstrumentSans-Bold', weight: 700 },
    ]);
  });

  it('reads the keywords and an absent weight as the platform does', () => {
    expect(faceFor(undefined).family).toBe('InstrumentSans-Regular');
    expect(faceFor('normal').family).toBe('InstrumentSans-Regular');
    expect(faceFor('bold').family).toBe('InstrumentSans-Bold');
    expect(faceFor(700).family).toBe('InstrumentSans-Bold');
  });

  it('takes the nearest file for a weight the design does not ship', () => {
    expect(faceFor('300').family).toBe('InstrumentSans-Regular');
    expect(faceFor('900').family).toBe('InstrumentSans-Bold');
  });

  it('keeps JetBrains Mono to its two weights', () => {
    expect(faceFor('500', true)).toEqual({ family: 'JetBrainsMono-Medium', weight: 500 });
    expect(faceFor('700', true)).toEqual({ family: 'JetBrainsMono-Bold', weight: 700 });
    expect(faceFor('400', true).family).toBe('JetBrainsMono-Medium');
    expect(faceFor('600', true).family).toBe('JetBrainsMono-Bold');
  });
});

describe('the faces ship inside the app', () => {
  const fonts = join(import.meta.dirname, '../../assets/fonts');
  const fontsSource = readFileSync(join(import.meta.dirname, 'fonts.ts'), 'utf8');

  it.each([
    ['instrument-sans', Object.values(SANS)],
    ['jetbrains-mono', Object.values(MONO)],
  ])('bundles every %s file the mapper names, beside its licence', (folder, families) => {
    expect(readFileSync(join(fonts, folder, 'OFL.txt'), 'utf8')).toContain(
      'SIL Open Font License, Version 1.1',
    );

    for (const family of families) {
      expect(existsSync(join(fonts, folder, `${family}.ttf`)), family).toBe(true);
      expect(fontsSource, family).toContain(`${folder}/${family}.ttf`);
    }
  });
});
