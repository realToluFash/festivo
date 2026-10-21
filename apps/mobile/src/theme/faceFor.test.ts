import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { MONO, SANS, faceFor, faceStyle, facesLoaded } from './faceFor.ts';

describe('a weight draws from its own file', () => {
  it('gives each of the four design weights a different Instrument Sans file', () => {
    expect(['400', '500', '600', '700'].map((weight) => faceFor(weight))).toEqual([
      'InstrumentSans-Regular',
      'InstrumentSans-Medium',
      'InstrumentSans-SemiBold',
      'InstrumentSans-Bold',
    ]);
  });

  it('reads the keywords and an absent weight as the platform does', () => {
    expect(faceFor(undefined)).toBe('InstrumentSans-Regular');
    expect(faceFor('normal')).toBe('InstrumentSans-Regular');
    expect(faceFor('bold')).toBe('InstrumentSans-Bold');
    expect(faceFor(700)).toBe('InstrumentSans-Bold');
  });

  it('takes the nearest file for a weight the design does not ship', () => {
    expect(faceFor('300')).toBe('InstrumentSans-Regular');
    expect(faceFor('900')).toBe('InstrumentSans-Bold');
  });

  it('keeps JetBrains Mono to its two weights', () => {
    expect(faceFor('500', true)).toBe('JetBrainsMono-Medium');
    expect(faceFor('700', true)).toBe('JetBrainsMono-Bold');
    expect(faceFor('400', true)).toBe('JetBrainsMono-Medium');
    expect(faceFor('600', true)).toBe('JetBrainsMono-Bold');
  });
});

describe('a style reaches the platform with its face', () => {
  it('keeps the platform font until every face has loaded', () => {
    expect(faceStyle({ fontWeight: '600', fontSize: 16 })).toEqual({
      fontWeight: '600',
      fontSize: 16,
    });
  });

  it("names the weight's own file and sends no weight for a platform to resolve again", () => {
    facesLoaded();

    expect(faceStyle({ fontWeight: '600', fontSize: 16 })).toEqual({
      fontFamily: 'InstrumentSans-SemiBold',
      fontSize: 16,
    });
    expect(faceStyle({ fontWeight: '700' })).toEqual({ fontFamily: 'InstrumentSans-Bold' });
    expect(faceStyle({ fontWeight: '700' }, true)).toEqual({ fontFamily: 'JetBrainsMono-Bold' });
    expect(faceStyle({})).toEqual({ fontFamily: 'InstrumentSans-Regular' });
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
