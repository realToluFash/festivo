import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { CAPTION_FONT as DEMO_FONT } from '../../../demo/seatingText.ts';
import { CAPTION_FONT } from './seatingCaption.ts';

const read = (path: string) => readFileSync(join(import.meta.dirname, path), 'utf8');
const TOKENS = read('../../../tokens.css');

function drawnFont(css: string): string {
  const font = /\.st-room-line\s*\{[^}]*?\bfont:\s*([^;]+);/.exec(css)?.[1];
  const family = /--fontFamily:\s*([^;]+);/.exec(TOKENS)?.[1];
  if (font == null || family == null) throw new Error('caption font not found');
  return font.replace('var(--fontFamily)', family).replaceAll("'", '"').trim();
}

describe("The room's caption is measured in the font it is drawn in (sc-92246)", () => {
  it('the plan measures in .st-room-line’s font', () => {
    expect(CAPTION_FONT).toBe(drawnFont(read('seating.css')));
  });

  it('the demo measures in its .st-room-line’s font', () => {
    expect(DEMO_FONT).toBe(drawnFont(read('../../../demo/seating.css')));
  });
});
