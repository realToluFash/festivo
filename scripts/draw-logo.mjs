#!/usr/bin/env node
// Edit the geometry or a token, then run this: draw-logo.test.mjs fails on an image not redrawn.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { tokens } from '../docs/design/tokens.mjs';
import { LOCKUP, SYMBOL, WORDMARK } from '../docs/design/wordmark.mjs';
import { encodePng } from './qa-env.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const GRID = SYMBOL.viewBox.width;
const INK = tokens.colorInk;
const SYMBOL_ON_GROUND = tokens.colorInkOnDark;
const GROUND = tokens.colorAccent;

/** Each image's symbol box is the board's, in px: `dusk-ios-1024`, `dusk-android-fg`, the launch screens, `dusk-favicon`. */
export const IMAGES = {
  'apps/mobile/assets/icon.png': { size: 1024, box: 768, ground: 'full' },
  'apps/mobile/assets/adaptive-icon.png': { size: 1024, box: (57.6 / 108) * 1024 },
  'apps/mobile/assets/adaptive-icon-mono.png': { size: 1024, box: (57.6 / 108) * 1024 },
  // Android masks the 288 dp image to a 192 dp circle, the board's, with the symbol 120 dp across.
  'apps/mobile/assets/splash-icon.png': { size: 960, box: (120 / 288) * 960, ground: 'full' },
  'apps/mobile/assets/launch-tile.png': {
    size: 360,
    box: 1.85 * GRID * 3,
    ground: 'tile',
    corners: 'continuous',
  },
  'apps/web/public/apple-touch-icon.png': { size: 180, box: 135, ground: 'full' },
  'apps/web/public/favicon-32.png': { size: 32, box: 0.56 * GRID, ground: 'tile', corners: 7 },
  'apps/web/public/favicon-16.png': { size: 16, box: 0.29 * GRID, ground: 'tile', corners: 3.5 },
};

const SUN = /^M([\d.]+) ([\d.]+)A([\d.]+) \3 0 0 1 ([\d.]+) \2Z$/;
const BAR = /^M([\d.]+) ([\d.]+)h([\d.]+)a([\d.]+) \4 0 0 1 0 ([\d.]+)h-\3a\4 \4 0 0 1 0 -\5z$/;

/** The symbol's paths as the shapes they draw, so the images are filled from the same outlines as the SVGs. */
function symbolShapes() {
  return SYMBOL.paths.map((d) => {
    const sun = d.match(SUN);
    if (sun != null) {
      const [left, base, r, right] = sun.slice(1).map(Number);

      return { kind: 'sun', cx: (left + right) / 2, cy: base, r };
    }
    const bar = d.match(BAR);
    if (bar != null) {
      const [x, y, length, r] = bar.slice(1).map(Number);

      return { kind: 'bar', x0: x, x1: x + length, cy: y + r, r };
    }
    throw new Error(`draw-logo.mjs fills a half disc or a round-ended bar, not ${d}.`);
  });
}

const SHAPES = symbolShapes();

function inSymbol(u, v) {
  return SHAPES.some((shape) => {
    if (shape.kind === 'sun') {
      return v <= shape.cy && (u - shape.cx) ** 2 + (v - shape.cy) ** 2 <= shape.r ** 2;
    }
    const nearest = Math.min(Math.max(u, shape.x0), shape.x1);

    return (u - nearest) ** 2 + (v - shape.cy) ** 2 <= shape.r ** 2;
  });
}

export function rgb(hex) {
  const value = parseInt(hex.slice(1), 16);

  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function insideTile(x, y, size, corners) {
  if (corners === 'continuous') {
    const half = size / 2;

    return Math.abs((x - half) / half) ** 5 + Math.abs((y - half) / half) ** 5 <= 1;
  }
  const cx = Math.min(Math.max(x, corners), size - corners);
  const cy = Math.min(Math.max(y, corners), size - corners);

  return (x - cx) ** 2 + (y - cy) ** 2 <= corners ** 2;
}

/** One pixel's colour at a point: the symbol, the green ground, or nothing. */
function sample(image, x, y) {
  const { size, box, ground, corners } = image;
  const unit = box / GRID;
  const origin = (size - box) / 2;
  if (inSymbol((x - origin) / unit, (y - origin) / unit)) {
    return rgb(SYMBOL_ON_GROUND);
  }
  if (ground === 'full' || (ground === 'tile' && insideTile(x, y, size, corners))) {
    return rgb(GROUND);
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

function viewBox({ x, y, width, height }) {
  return `${x} ${y} ${width} ${height}`;
}

function svg(box, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox(box)}" width="${box.width}" height="${box.height}">${body}</svg>\n`;
}

const symbolPaths = () => SYMBOL.paths.map((d) => `<path d="${d}" fill="${INK}"/>`).join('');
const wordmarkPath = () => `<path d="${WORDMARK.d}" fill="${INK}"/>`;

/** The SVG outlines the web shows, so no font loads with the logo. */
export const SVGS = {
  'apps/web/src/brand/wordmark.svg': () => svg(WORDMARK.viewBox, wordmarkPath()),
  'apps/web/src/brand/lockup.svg': () => {
    const { symbol, word } = LOCKUP;

    return svg(
      LOCKUP.viewBox,
      `<g transform="scale(${symbol.scale})">${symbolPaths()}</g>` +
        `<g transform="translate(${word.x} ${word.y}) scale(${word.scale})">${wordmarkPath()}</g>`,
    );
  },
};

/** The app draws the same outlines with react-native-svg, in the ink. */
export const MOBILE_GEOMETRY = 'apps/mobile/src/theme/logo.ts';

export function mobileGeometry() {
  const logo = { symbol: SYMBOL, wordmark: WORDMARK, lockup: LOCKUP };

  return `// GENERATED by scripts/draw-logo.mjs from docs/design/wordmark.mjs. Do not edit.

export const logo = ${JSON.stringify(logo, null, 2)} as const;
`;
}

export function onDisk(path) {
  return readFileSync(resolve(ROOT, path));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const [path, image] of Object.entries(IMAGES)) {
    writeFileSync(resolve(ROOT, path), encodePng(pixels(image)));
    console.log(`wrote ${path}`);
  }
  for (const [path, draw] of Object.entries(SVGS)) {
    writeFileSync(resolve(ROOT, path), draw());
    console.log(`wrote ${path}`);
  }
  writeFileSync(resolve(ROOT, MOBILE_GEOMETRY), mobileGeometry());
  console.log(`wrote ${MOBILE_GEOMETRY}`);
}
