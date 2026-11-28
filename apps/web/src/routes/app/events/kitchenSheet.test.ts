import i18next from 'i18next';
import { describe, expect, it } from 'vitest';

import '../../../i18n/index.ts';
import { cssRule, mediaBlock, stylesheet } from '../../../test-styles.ts';
import { changeLine } from './kitchenSheet.ts';

const SHEET = stylesheet(import.meta.dirname, 'kitchenSheet.css');
const AT_320 = mediaBlock('(width <= 640px)', SHEET);

describe('a course’s own figures in Changes since (sc-30692)', () => {
  it('names each course before its figure, so two courses never read alike', () => {
    const line = (course: string): string =>
      changeLine(i18next.t, {
        kind: 'count',
        code: null,
        who: null,
        item: { name: '', parent: course, state: 'notYet' },
        to: null,
        old: 3,
        count: 4,
      });

    expect([line('Starter'), line('Dessert')]).toEqual([
      'Starter · Not chosen yet: 3 to 4',
      'Dessert · Not chosen yet: 3 to 4',
    ]);
  });
});

describe('the kitchen sheet’s widths (sc-30812)', () => {
  it('leaves scrolling to the shell’s card, so the row that opens adds no sideways scroll at 1280', () => {
    expect(cssRule('.shell-content .desk-page')).toContain('overflow: visible;');
  });

  it('stands Final numbers under the sheet at 400% zoom, 320 CSS px', () => {
    expect(cssRule('.ks .ev-columns', AT_320)).toContain('grid-template-columns: minmax(0, 1fr);');
  });
});
