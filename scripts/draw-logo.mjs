#!/usr/bin/env node
// Edit the geometry or a brand token, then run this: draw-logo.test.mjs fails on an image not redrawn.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { tokens } from '../docs/design/tokens.mjs';
import { encodePng } from './qa-env.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const BOX = 48;
const DOT = 15;
const EDGE = 6;
const PITCH = 21;

const DOTS = [
  { x: 0, y: 0, colour: tokens.colorBrandPomegranate },
  { x: 1, y: 0, colour: tokens.colorBrandSaffron },
  { x: 1, y: 1, colour: tokens.colorBrandJade },
  { x: 0, y: 1, colour: tokens.colorBrandUltramarine },
];

export const IMAGES = {
  'apps/mobile/assets/icon.png': { size: 1024, box: 768, ground: 'full' },
  // The dots must stay inside Android's 66 dp safe zone of 108.
  'apps/mobile/assets/adaptive-icon.png': { size: 1024, box: (62.4 / 108) * 1024 },
  'apps/mobile/assets/adaptive-icon-mono.png': {
    size: 1024,
    box: (62.4 / 108) * 1024,
    mono: '#FFFFFF',
  },
  'apps/mobile/assets/splash-icon.png': { size: 960, box: (84 / 36) * BOX * 4, ground: 'full' },
  'apps/mobile/assets/launch-tile.png': {
    size: 360,
    box: 270,
    ground: 'tile',
    corners: 'continuous',
  },
  'apps/web/public/apple-touch-icon.png': { size: 180, box: 135, ground: 'full' },
  // A box the favicon's size puts every dot edge on a whole pixel.
  'apps/web/public/favicon-32.png': { size: 32, box: 32, ground: 'tile', corners: 0.22 },
  'apps/web/public/favicon-16.png': { size: 16, box: 16, ground: 'tile', corners: 0.22 },
};

function rgb(hex) {
  const value = parseInt(hex.slice(1), 16);

  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function insideTile(x, y, size, corners) {
  if (corners === 'continuous') {
    const half = size / 2;

    return Math.abs((x - half) / half) ** 5 + Math.abs((y - half) / half) ** 5 <= 1;
  }
  const radius = corners * size;
  const cx = Math.min(Math.max(x, radius), size - radius);
  const cy = Math.min(Math.max(y, radius), size - radius);

  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

/** One pixel's colour at a point: a dot, the ink ground, or nothing. */
function sample(image, x, y) {
  const { size, box, ground, corners, mono } = image;
  const unit = box / BOX;
  const origin = (size - box) / 2;
  for (const dot of DOTS) {
    const cx = origin + (EDGE + DOT / 2 + dot.x * PITCH) * unit;
    const cy = origin + (EDGE + DOT / 2 + dot.y * PITCH) * unit;
    if ((x - cx) ** 2 + (y - cy) ** 2 <= ((DOT / 2) * unit) ** 2) {
      return rgb(mono ?? dot.colour);
    }
  }
  if (ground === 'full' || (ground === 'tile' && insideTile(x, y, size, corners))) {
    return rgb(tokens.colorBrandInk);
  }

  return null;
}

/** The image as rows of RGB or RGBA bytes, each pixel the average of a grid of samples. */
export function pixels(image) {
  const { size } = image;
  const opaque = image.ground === 'full';
  const channels = opaque ? 3 : 4;
  const grid = size >= 512 ? 4 : 16;
  const out = Buffer.alloc(size * size * channels);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const at = (py * size + px) * channels;
      const probes = [
        sample(image, px + 0.5, py + 0.5),
        sample(image, px, py),
        sample(image, px + 1, py),
        sample(image, px, py + 1),
        sample(image, px + 1, py + 1),
      ];
      if (probes.every((probe) => probe?.join() === probes[0]?.join())) {
        if (probes[0] != null) {
          out.set(probes[0], at);
        }
        if (!opaque) {
          out[at + 3] = probes[0] == null ? 0 : 255;
        }
        continue;
      }
      let r = 0;
      let g = 0;
      let b = 0;
      let covered = 0;
      for (let sy = 0; sy < grid; sy++) {
        for (let sx = 0; sx < grid; sx++) {
          const colour = sample(image, px + (sx + 0.5) / grid, py + (sy + 0.5) / grid);
          if (colour != null) {
            r += colour[0];
            g += colour[1];
            b += colour[2];
            covered++;
          }
        }
      }
      if (covered > 0) {
        out[at] = Math.round(r / covered);
        out[at + 1] = Math.round(g / covered);
        out[at + 2] = Math.round(b / covered);
      }
      if (!opaque) {
        out[at + 3] = Math.round((covered / (grid * grid)) * 255);
      }
    }
  }

  return { size, channels, data: out };
}

export function onDisk(path) {
  return readFileSync(resolve(ROOT, path));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const [path, image] of Object.entries(IMAGES)) {
    writeFileSync(resolve(ROOT, path), encodePng(pixels(image)));
    console.log(`wrote ${path}`);
  }
}
