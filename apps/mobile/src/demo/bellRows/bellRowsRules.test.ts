import { describe, expect, it } from 'vitest';

import { ROW_SETS, rowsUnreadAt, rowWords } from './bellRowSamples.ts';
import { ROW_LINE, ROW_MARK, ROW_TITLE, rowTextSize, rowTextStart } from './bellRowsRules.ts';

const DEFAULT = 1;
const SEVENTH = 1.353;
const AX5 = 3.571;
// The iPhone 17 Pro's row column: 402 less 20 each side, the 40 tile and its 12; beside More, 36 less.
const PHONE = 310;
const PHONE_MORE = 274;

describe('a bell row’s texts at the accessibility sizes (sc-102956)', () => {
  it('grows each text with the text size, with no cap on the title', () => {
    expect(rowTextStart(ROW_TITLE, AX5, Number.POSITIVE_INFINITY)).toBeCloseTo(ROW_TITLE * AX5);
    expect(rowTextStart(ROW_LINE, SEVENTH, Number.POSITIVE_INFINITY)).toBeCloseTo(
      ROW_LINE * SEVENTH,
    );
  });

  it('keeps every text whose widest word fits at its grown size, as on main', () => {
    expect(rowTextSize(ROW_TITLE, ROW_TITLE * AX5, 304.1, PHONE)).toBeCloseTo(ROW_TITLE * AX5);
  });

  it('steps a title down only as far as its widest word needs', () => {
    // notification, bold at 57.1, measures 314.2: QA notificatio / n 1 on main.
    expect(rowTextSize(ROW_TITLE, ROW_TITLE * AX5, 314.2, PHONE)).toBe(56);
  });

  it('never steps a text below its default size', () => {
    expect(rowTextSize(ROW_LINE, ROW_LINE * AX5, 5000, PHONE_MORE)).toBe(ROW_LINE);
    expect(rowTextSize(ROW_MARK, ROW_MARK * AX5, 5000, PHONE_MORE)).toBe(ROW_MARK);
  });

  it('starts a text under the title no larger than the title draws, and never under its default', () => {
    expect(rowTextStart(ROW_LINE, AX5, 38)).toBe(38);
    expect(rowTextStart(ROW_LINE, AX5, ROW_TITLE)).toBe(ROW_TITLE);
    expect(rowTextStart(ROW_LINE, DEFAULT, ROW_TITLE)).toBe(ROW_LINE);
  });

  it('steps a text down below AX1 too, only where its widest word breaks on main', () => {
    expect(rowTextSize(ROW_TITLE, ROW_TITLE * SEVENTH, 200, PHONE)).toBeCloseTo(
      ROW_TITLE * SEVENTH,
    );
    expect(rowTextSize(ROW_TITLE, ROW_TITLE * SEVENTH, 400, PHONE)).toBe(16);
  });

  it('breaks only a word wider than its line even at the default size', () => {
    // The 40-letter event name is 311.7 wide at 13.5, so 311.7 × 3.571 at its AX5 start.
    expect(rowTextSize(ROW_LINE, ROW_LINE * AX5, 311.7 * AX5, PHONE_MORE)).toBe(ROW_LINE);
    // A word 200 wide at 13.5 steps down to 18 and stays whole.
    expect(rowTextSize(ROW_LINE, ROW_LINE * AX5, 200 * AX5, PHONE_MORE)).toBe(18);
  });
});

describe('the rows the demo draws', () => {
  it('names a 40-letter event with no space in it', () => {
    const named = ROW_SETS.word40.map((row) => row.event?.en);

    expect(named.every((event) => event?.length === 40 && !/\s/u.test(event))).toBe(true);
  });

  it('marks unread only the rows the set marks, and none once all are read', () => {
    expect([...rowsUnreadAt('some', 'mixed')]).toEqual(['replies', 'recovery']);
    expect(rowsUnreadAt('all', 'mixed').size).toBe(0);
  });

  it('gives each row its words in every language the demo offers', () => {
    const titles = Object.values(ROW_SETS)
      .flat()
      .flatMap((row) => ['en', 'es', 'fr', 'pt'].map((language) => rowWords(row.title, language)));

    expect(titles.every((title) => title !== '')).toBe(true);
  });
});
