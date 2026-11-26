import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { stylesheet } from './test-styles';

const FONTS = stylesheet(import.meta.dirname, 'fonts.css');
const FACES = [...FONTS.matchAll(/@font-face \{([^}]*)\}/gu)].map(([, body]) => body ?? '');

describe('fonts.css', () => {
  it.each([
    ['Instrument Sans', 400],
    ['Instrument Sans', 500],
    ['Instrument Sans', 600],
    ['Instrument Sans', 700],
    ['Google Sans', 500],
  ])('serves %s %i from a file in the bundle, swapped in once it loads', (family, weight) => {
    const face = FACES.find(
      (body) =>
        body.includes(`font-family: '${family}';`) && body.includes(`font-weight: ${weight};`),
    );

    expect(
      face,
      `No @font-face for ${family} ${weight}: the browser would synthesise it.`,
    ).toBeDefined();
    expect(face).toContain('font-display: swap;');
    const file = /url\('([^']+)'\)/u.exec(face ?? '')?.[1];
    expect(file && existsSync(join(import.meta.dirname, file)), `${file} is not on disk.`).toBe(
      true,
    );
  });
});

it('index.html calls neither Google Fonts host', () => {
  const html = stylesheet(join(import.meta.dirname, '..'), 'index.html');

  expect(html).not.toContain('fonts.googleapis.com');
  expect(html).not.toContain('fonts.gstatic.com');
});
