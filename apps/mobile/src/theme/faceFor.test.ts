import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  GOOGLE_SANS,
  MONO,
  SANS,
  faceFor,
  faceStyle,
  facesLoaded,
  inputFaceStyle,
} from './faceFor.ts';

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
    expect(faceFor('500', 'mono')).toBe('JetBrainsMono-Medium');
    expect(faceFor('700', 'mono')).toBe('JetBrainsMono-Bold');
    expect(faceFor('400', 'mono')).toBe('JetBrainsMono-Medium');
    expect(faceFor('600', 'mono')).toBe('JetBrainsMono-Bold');
  });

  it("sets Google's button in Google Sans Medium, whatever weight it is asked for", () => {
    expect(['400', '500', '600', '700'].map((weight) => faceFor(weight, 'googleSans'))).toEqual(
      Array(4).fill('GoogleSans-Medium'),
    );
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
    expect(faceStyle({ fontWeight: '700' }, 'mono')).toEqual({ fontFamily: 'JetBrainsMono-Bold' });
    expect(faceStyle({})).toEqual({ fontFamily: 'InstrumentSans-Regular' });
  });

  it("leaves the platform's own font, and its weight, to the system family", () => {
    facesLoaded();

    expect(faceStyle({ fontWeight: '500', fontSize: 20 }, 'system')).toEqual({
      fontWeight: '500',
      fontSize: 20,
    });
  });
});

describe("a field's style reaches the platform with its face", () => {
  it('states a regular upright weight on Android, which the span over handed text reads, whatever file the weight chose', () => {
    facesLoaded();

    expect(inputFaceStyle({ fontSize: 16 }, 'sans', 'android')).toEqual({
      fontFamily: 'InstrumentSans-Regular',
      fontSize: 16,
      fontWeight: 'normal',
      fontStyle: 'normal',
    });
    expect(inputFaceStyle({ fontWeight: '700' }, 'sans', 'android')).toEqual({
      fontFamily: 'InstrumentSans-Bold',
      fontWeight: 'normal',
      fontStyle: 'normal',
    });
  });

  it('leaves the iPhone and the web as faced() has them', () => {
    expect(inputFaceStyle({ fontWeight: '700' }, 'sans', 'ios')).toEqual(
      faceStyle({ fontWeight: '700' }),
    );
    expect(inputFaceStyle({ fontSize: 16 }, 'mono', 'web')).toEqual(
      faceStyle({ fontSize: 16 }, 'mono'),
    );
  });
});

describe('the faces ship inside the app', () => {
  const fonts = join(import.meta.dirname, '../../assets/fonts');
  const fontsSource = readFileSync(join(import.meta.dirname, 'fonts.ts'), 'utf8');

  it.each([
    ['instrument-sans', Object.values(SANS)],
    ['jetbrains-mono', Object.values(MONO)],
    ['google-sans', Object.values(GOOGLE_SANS)],
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
