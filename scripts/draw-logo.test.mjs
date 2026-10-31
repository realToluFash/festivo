import { execFileSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import { tokens } from '../docs/design/tokens.mjs';
import { IMAGES, onDisk, pixels } from './draw-logo.mjs';
import { decodePng } from './qa-env.mjs';

describe('the logo images', () => {
  for (const [path, image] of Object.entries(IMAGES)) {
    it(`${path} is the symbol as drawn from the tokens`, () => {
      const drawn = pixels(image);
      const disk = decodePng(onDisk(path));

      expect(disk.size).toBe(drawn.size);
      expect(disk.channels).toBe(drawn.channels);
      expect(
        disk.data.equals(drawn.data),
        `${path} has drifted — run: node scripts/draw-logo.mjs`,
      ).toBe(true);
    });
  }

  it('gives iOS one 1024 px icon with no alpha channel', () => {
    const icon = onDisk('apps/mobile/assets/icon.png');

    expect(icon.readUInt32BE(16)).toBe(1024);
    expect(icon.readUInt32BE(20)).toBe(1024);
    expect(icon[25]).toBe(2);
  });
});

describe('the brand colours', () => {
  const brand = [
    tokens.colorBrandInk,
    tokens.colorBrandPomegranate,
    tokens.colorBrandSaffron,
    tokens.colorBrandJade,
    tokens.colorBrandUltramarine,
  ];

  it('leave the app ink and the action green as they were', () => {
    expect(tokens.colorInk).toBe('#15171C');
    expect(tokens.colorAccent).toBe('#1E9A64');
  });

  it('are named nowhere but the tokens and the files generated from them', () => {
    const named = execFileSync(
      'git',
      ['grep', '-l', '-i', ...brand.flatMap((hex) => ['-e', hex]), '--', ':!*.png'],
      { encoding: 'utf8' },
    )
      .split('\n')
      .filter(Boolean);

    expect(named.sort()).toEqual([
      'apps/mobile/src/theme/tokens.ts',
      'apps/web/src/tokens.css',
      'docs/design/tokens.mjs',
    ]);
  });
});
