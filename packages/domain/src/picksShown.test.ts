import { describe, expect, it } from 'vitest';

import { picksLead, picksShown } from './picksShown.ts';

const PICKS = ['Wedding', 'Birthday', 'This week', 'Chidi Okafor'];

/** Eight a letter, and " +N more" eight letters, as a stand-in for a measured font. */
function fitsIn(room: number, picks: readonly string[] = PICKS) {
  return (shown: number) =>
    shown === picks.length
      ? picks.join(', ').length * 8 <= room
      : (picksLead(picks, shown).length + 8) * 8 <= room;
}

describe('picksShown', () => {
  it('shows every pick, with no "+N more", when the whole list fits', () => {
    expect(picksShown(4, fitsIn(1000))).toBe(4);
  });

  it('shows the first picks that fit whole, and counts the rest', () => {
    // "Wedding, Birthday" is 17 letters, and with " +2 more" 25: 200 px.
    expect(picksShown(4, fitsIn(200))).toBe(2);
    expect(picksShown(4, fitsIn(199))).toBe(1);
  });

  it('never skips a pick to fit a shorter one after it', () => {
    const picks = ['Wedding', 'Funmilayo Adéṣínà-Ọláolúwa', 'Gala'];
    const shown = picksShown(3, fitsIn(220, picks));

    expect(shown).toBe(1);
    expect(picksLead(picks, shown)).toBe('Wedding');
  });

  it('keeps the first pick, to be cut, when even it does not fit', () => {
    expect(picksShown(4, fitsIn(10))).toBe(1);
    expect(picksShown(1, () => false)).toBe(1);
  });

  it('shows nothing when nothing is chosen', () => {
    expect(picksShown(0, () => false)).toBe(0);
  });
});

describe('picksLead', () => {
  it('joins the picks shown by commas alone, in every language', () => {
    expect(picksLead(['Mariage', 'Anniversaire', 'Cette semaine'], 2)).toBe(
      'Mariage, Anniversaire',
    );
  });
});
