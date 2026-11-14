import { describe, expect, it } from 'vitest';

import { tokens } from '../docs/design/tokens.mjs';
import {
  IMAGES,
  MOBILE_GEOMETRY,
  SVGS,
  mobileGeometry,
  onDisk,
  pixels,
  rgb,
} from './draw-logo.mjs';
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

  for (const [path, draw] of Object.entries(SVGS)) {
    it(`${path} is the wordmark as drawn from the tokens`, () => {
      expect(
        onDisk(path).toString('utf8'),
        `${path} has drifted — run: node scripts/draw-logo.mjs`,
      ).toBe(draw());
    });
  }

  it(`${MOBILE_GEOMETRY} is the wordmark's outlines as drawn`, () => {
    expect(onDisk(MOBILE_GEOMETRY).toString('utf8')).toBe(mobileGeometry());
  });

  it('gives iOS one 1024 px icon with no alpha channel and square green corners', () => {
    const icon = onDisk('apps/mobile/assets/icon.png');
    const { data } = decodePng(icon);

    expect(icon.readUInt32BE(16)).toBe(1024);
    expect(icon.readUInt32BE(20)).toBe(1024);
    expect(icon[25]).toBe(2);
    expect([...data.subarray(0, 3)]).toEqual(rgb(tokens.colorAccent));
  });
});

describe('the logo colours', () => {
  it('leave the app ink and the action green as they were', () => {
    expect(tokens.colorInk).toBe('#15171C');
    expect(tokens.colorAccent).toBe('#1E9A64');
  });

  it('draw the wordmark and the lockup in the ink alone', () => {
    for (const draw of Object.values(SVGS)) {
      const fills = new Set([...draw().matchAll(/fill="([^"]+)"/g)].map(([, fill]) => fill));

      expect([...fills]).toEqual([tokens.colorInk]);
    }
  });

  it('draw every icon and launch image in white on the green, and nothing else', () => {
    const green = rgb(tokens.colorAccent);
    const white = rgb(tokens.colorInkOnDark);
    for (const path of Object.keys(IMAGES)) {
      const { channels, data } = decodePng(onDisk(path));
      let strays = 0;
      for (let at = 0; at < data.length; at += channels) {
        if (channels === 4 && data[at + 3] === 0) {
          continue;
        }
        const share = (data[at] - green[0]) / (white[0] - green[0]);
        const off = [1, 2].some(
          (c) => Math.abs(data[at + c] - (green[c] + share * (white[c] - green[c]))) > 1,
        );
        if (off || share < 0 || share > 1) {
          strays++;
        }
      }

      expect(strays, `${path} has a pixel that is neither white, green nor between them`).toBe(0);
    }
  });
});
