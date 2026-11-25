import { describe, expect, it } from 'vitest';

import {
  ANSWER,
  answersStack,
  answerWidth,
  barePhoneNameRoom,
  nameStart,
  phoneNameRoom,
  uprightNameRoom,
  wholeTileAlone,
  waitingRoomUnder,
  PILL_CHROME,
  pillShowsWords,
  WAITING_RING,
} from './pillFit.ts';

describe('the organisation pill beside the tabs (sc-38149)', () => {
  it('is its tile under 120, as sc-30410 decided, however short the words', () => {
    expect(pillShowsWords(119, { nameStart: 10, waitingLine: null })).toBe(false);
  });

  it('draws its words where the first word and the invitation line each fit whole', () => {
    const room = PILL_CHROME + WAITING_RING + 80;

    expect(pillShowsWords(room, { nameStart: 20, waitingLine: 80 })).toBe(true);
    expect(pillShowsWords(room - 1, { nameStart: 20, waitingLine: 80 })).toBe(false);
  });

  it('turns to its tile where the first word would have to break', () => {
    expect(pillShowsWords(PILL_CHROME + 149, { nameStart: 150, waitingLine: null })).toBe(false);
    expect(pillShowsWords(PILL_CHROME + 150, { nameStart: 150, waitingLine: null })).toBe(true);
  });

  it('keeps main’s rule at the accessibility sizes: its tile under 120 only', () => {
    expect(pillShowsWords(119, { nameStart: 10, waitingLine: null }, true)).toBe(false);
    expect(pillShowsWords(120, { nameStart: 200, waitingLine: 200 }, true)).toBe(true);
  });

  it('measures the first word, and the "…" a longer name ends in on one line', () => {
    expect(nameStart('QA Organisation')).toBe('QA…');
    expect(nameStart('Internationalisation Partners')).toBe('Internationalisation…');
    expect(nameStart('  Internationalisation ')).toBe('Internationalisation');
  });
});

describe('the invitation’s two answers (sc-38149)', () => {
  it('is as wide as the wider of rest and sending', () => {
    expect(answerWidth(100, 40)).toBe(ANSWER.sides + 100);
    expect(answerWidth(50, 90)).toBe(ANSWER.sides + ANSWER.spinner + 90);
  });

  it('shares a row only where both fit at their sending width', () => {
    expect(answersStack(300, 150, 150 - ANSWER.gap)).toBe(false);
    expect(answersStack(300, 150, 151 - ANSWER.gap)).toBe(true);
  });
});

describe('the phone cover’s pill from AX1 (sc-92247)', () => {
  it('gives the name 186 on an iPhone 17 Pro, and the invitation line 169', () => {
    expect(phoneNameRoom(370, 88)).toBe(186);
    expect(waitingRoomUnder(186)).toBe(169);
  });

  it('never gives a negative line', () => {
    expect(phoneNameRoom(100, 88)).toBe(0);
    expect(waitingRoomUnder(10)).toBe(0);
  });

  it('is its tile alone only where the widest word at its default size is wider than the line', () => {
    expect(wholeTileAlone(186, 186)).toBe(false);
    expect(wholeTileAlone(186.5, 186)).toBe(true);
    expect(wholeTileAlone(400, 0)).toBe(false);
  });
});

describe('the pill beside the upright iPad’s tabs from AX1 (sc-92314)', () => {
  it('gives the name the pill’s room less its chrome, 0 until measured', () => {
    expect(uprightNameRoom(179)).toBe(179 - PILL_CHROME);
    expect(uprightNameRoom(undefined)).toBe(0);
    expect(uprightNameRoom(20)).toBe(0);
  });

  it('keeps Organisation in words and turns a word wider than the line to its tile', () => {
    expect(wholeTileAlone(92, uprightNameRoom(179))).toBe(false);
    expect(wholeTileAlone(350, uprightNameRoom(179))).toBe(true);
  });
});

describe('the white pill above a phone’s Events, Calendar and Settings from AX1 (sc-92464)', () => {
  it('gives the bare name a 206 line on an iPhone 17 Pro, 258 with the bell alone', () => {
    expect(barePhoneNameRoom(362, 96)).toBe(206);
    expect(barePhoneNameRoom(362, 44)).toBe(258);
    expect(waitingRoomUnder(barePhoneNameRoom(362, 96))).toBe(189);
  });

  it('keeps Organisation in words and turns a word wider than the line to its tile', () => {
    expect(wholeTileAlone(165, barePhoneNameRoom(362, 96))).toBe(false);
    expect(wholeTileAlone(400, barePhoneNameRoom(362, 96))).toBe(true);
  });
});
