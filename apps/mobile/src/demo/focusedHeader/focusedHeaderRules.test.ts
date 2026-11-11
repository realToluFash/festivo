import { describe, expect, it } from 'vitest';

import {
  backWidth,
  buttonWidth,
  headerForm,
  headerLanguageOf,
  headerScreenOf,
  headerSizeOf,
  linesFor,
  pillTextSize,
  scaleFor,
  titleOnItsRow,
  titleSlot,
} from './focusedHeaderRules.ts';

const at = (scale: number, ...widths: number[]) => widths.map((width) => width * scale);

describe('the header takes the first form that holds every word whole', () => {
  it('keeps one row at the default size, as main', () => {
    const lefts = at(1, 55.4).map(buttonWidth);
    const verb = buttonWidth(39.1);

    expect(headerForm({ width: 402, lefts, verb, words: at(1, 47.9), space: 3.2 }).form).toBe(
      'row',
    );
  });

  it('lets the title take a second line between the sides before it leaves the row', () => {
    const lefts = [buttonWidth(63.6)];
    const verb = buttonWidth(90.7);
    const words = at(1, 68.3, 14.3, 33.6, 20.4, 47.3);

    expect(titleSlot(402, lefts[0] ?? 0, verb)).toBeCloseTo(175.7, 1);
    expect(headerForm({ width: 402, lefts, verb, words, space: 3.2 }).form).toBe('row');
  });

  it('puts the title under Cancel and the verb when its widest word has no room between them', () => {
    const s = 2.14;
    const lefts = at(s, 55.4).map(buttonWidth);
    const verb = buttonWidth(39.1 * s);

    expect(
      headerForm({ width: 402, lefts, verb, words: at(s, 63.9, 79.1), space: 3.2 * s }).form,
    ).toBe('under');
  });

  it('puts French Nom under Annuler and Enregistrer at the ninth step', () => {
    const s = 2.14;

    expect(
      headerForm({
        width: 402,
        lefts: [buttonWidth(63.6 * s)],
        verb: buttonWidth(90.7 * s),
        words: at(s, 38.7),
        space: 3.2 * s,
      }).form,
    ).toBe('under');
  });

  it('stacks three rows when Cancel and the verb cannot share one', () => {
    const s = 3.12;
    const words = at(s, 68.3, 14.3, 33.6, 20.4, 47.3);

    expect(
      headerForm({
        width: 402,
        lefts: [buttonWidth(63.6 * s)],
        verb: buttonWidth(90.7 * s),
        words,
        space: 3.2 * s,
      }).form,
    ).toBe('stacked');
  });

  it('stacks French Nom on a 360 Android phone at 200 percent', () => {
    expect(
      headerForm({
        width: 360,
        lefts: [buttonWidth(63.6 * 2)],
        verb: buttonWidth(90.7 * 2),
        words: at(2, 38.7),
        space: 6.4,
      }).form,
    ).toBe('stacked');
  });

  it('shortens a back label to Back before the title leaves the row', () => {
    const s = 2.14;
    const lefts = [backWidth(159 * s, s), backWidth(38.7 * s, s)];

    expect(
      headerForm({ width: 402, lefts, verb: 0, words: at(s, 41.9, 39.4), space: 3.2 * s }),
    ).toEqual({ form: 'row', at: 1 });
  });

  it('shortens a back label to Back before the title takes a second line, as main', () => {
    const lefts = [backWidth(159, 1), backWidth(38.7, 1)];

    expect(
      headerForm({ width: 402, lefts, verb: 0, words: at(1, 60, 60, 60), space: 3.2 }),
    ).toEqual({ form: 'row', at: 1 });
  });

  it('keeps a back label whole at the default size while the title fits beside it', () => {
    const lefts = [backWidth(159, 1), backWidth(38.7, 1)];

    expect(
      headerForm({ width: 402, lefts, verb: 0, words: at(1, 41.9, 39.4), space: 3.2 }),
    ).toEqual({
      form: 'row',
      at: 0,
    });
  });
});

describe('the title on its own row', () => {
  it('keeps its full size when its widest word fits the row', () => {
    expect(titleOnItsRow(3.12, 213, 402)).toBeCloseTo(53.04, 2);
  });

  it('steps down to fit its widest word, never below 17', () => {
    expect(titleOnItsRow(3.12, 400, 402)).toBe(48);
    expect(titleOnItsRow(3.12, 4000, 402)).toBe(17);
  });

  it('breaks only at spaces', () => {
    expect(linesFor(at(3.12, 68.3, 14.3, 33.6, 20.4, 47.3), 3.2 * 3.12, 362)).toBe(2);
    expect(linesFor([500], 10, 362)).toBe(1);
  });
});

describe('the Back pill', () => {
  it('draws its word in full when the pill fits its room', () => {
    expect(pillTextSize(3.12, 259.6, 362)).toBeCloseTo(46.8, 1);
  });

  it('steps its word down to fit beside the bell, never below 15', () => {
    expect(pillTextSize(3.12, 278.2, 318)).toBe(40);
    expect(pillTextSize(3.12, 2780, 318)).toBe(15);
  });
});

describe('the demo’s choices', () => {
  it('reads each from its route parameter', () => {
    expect(headerSizeOf('twelfth')).toBe('twelfth');
    expect(headerSizeOf(undefined)).toBe('phone');
    expect(headerLanguageOf('fr')).toBe('fr');
    expect(headerLanguageOf('es')).toBe('en');
    expect(headerScreenOf('due-now')).toBe('due-now');
    expect(headerScreenOf('nope')).toBe('name');
    expect(scaleFor('android', 1.3)).toBe(2);
    expect(scaleFor('phone', 1.3)).toBe(1.3);
  });
});
