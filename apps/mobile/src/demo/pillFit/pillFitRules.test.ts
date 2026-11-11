import { describe, expect, it } from 'vitest';

import {
  ANSWER,
  answersStack,
  answerWidth,
  firstWord,
  languageOf,
  largestOf,
  organisationOf,
  PILL_CHROME,
  sendingOf,
  pillShowsWords,
  WAITING_RING,
  waitingOf,
} from './pillFitRules.ts';

describe('the organisation pill beside the tabs (sc-38149)', () => {
  it('is its tile under 120, as sc-30410 decided, however short the words', () => {
    expect(pillShowsWords(119, { firstWord: 10, waitingLine: null })).toBe(false);
  });

  it('draws its words where the first word and the invitation line each fit whole', () => {
    const room = PILL_CHROME + WAITING_RING + 80;

    expect(pillShowsWords(room, { firstWord: 20, waitingLine: 80 })).toBe(true);
    expect(pillShowsWords(room - 1, { firstWord: 20, waitingLine: 80 })).toBe(false);
  });

  it('turns to its tile where the first word would have to break', () => {
    expect(pillShowsWords(PILL_CHROME + 149, { firstWord: 150, waitingLine: null })).toBe(false);
    expect(pillShowsWords(PILL_CHROME + 150, { firstWord: 150, waitingLine: null })).toBe(true);
  });

  it('keeps main’s rule at the accessibility sizes: its tile under 120 only', () => {
    expect(pillShowsWords(119, { firstWord: 10, waitingLine: null }, true)).toBe(false);
    expect(pillShowsWords(120, { firstWord: 200, waitingLine: 200 }, true)).toBe(true);
  });

  it('measures the first word, since a name breaks only between words', () => {
    expect(firstWord('QA Organisation')).toBe('QA');
    expect(firstWord('  Internationalisation ')).toBe('Internationalisation');
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

describe('the board’s choices', () => {
  it('falls back to English, QA Organisation and one invitation', () => {
    expect(languageOf('de')).toBe('en');
    expect(languageOf('pt')).toBe('pt');
    expect(organisationOf(undefined)).toBe('qa');
    expect(organisationOf('long')).toBe('long');
    expect(waitingOf(undefined)).toBe(1);
    expect(waitingOf('2')).toBe(2);
    expect(waitingOf('0')).toBe(0);
    expect(sendingOf('decline')).toBe('decline');
    expect(sendingOf('yes')).toBeNull();
    expect(largestOf('largest')).toBe(true);
    expect(largestOf(undefined)).toBe(false);
  });
});
