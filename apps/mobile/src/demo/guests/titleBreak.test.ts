import { describe, expect, it } from 'vitest';

import { brokeInWord, brokeOn } from './titleBreak.ts';

const whole = [{ text: 'Convidados' }];
const broken = [{ text: 'Convidad' }, { text: 'os' }];
const twoWords = [{ text: 'Guest ' }, { text: 'list' }];
const atFloor = { drawn: 30, start: 43, size: 30 };

describe('a title beside its actions', () => {
  it('broke where a line ends inside its word at its floor', () => {
    expect(brokeInWord({ lines: broken, ...atFloor })).toBe(true);
  });

  it('did not break when it drew whole', () => {
    expect(brokeInWord({ lines: whole, ...atFloor })).toBe(false);
  });

  it('did not break where it wrapped between words', () => {
    expect(brokeInWord({ lines: twoWords, ...atFloor })).toBe(false);
  });

  it('is not yet broken at its start size, where it steps down next', () => {
    expect(brokeInWord({ lines: broken, drawn: 43, start: 43, size: 30 })).toBe(false);
  });

  it('broke when its start is its floor, as at the default size', () => {
    expect(brokeInWord({ lines: broken, drawn: 30, start: 30, size: 30 })).toBe(true);
  });
});

describe('the row the title broke on', () => {
  const laidOut = { lines: broken, ...atFloor };

  it('is this row once the title breaks beside its actions', () => {
    expect(brokeOn({ broke: null, row: '370|pt', under: false, ...laidOut })).toBe('370|pt');
  });

  it('stays as it was while the actions are already under', () => {
    expect(brokeOn({ broke: null, row: '370|pt', under: true, ...laidOut })).toBeNull();
  });

  it('stays as it was while the title is whole', () => {
    expect(
      brokeOn({ broke: '360|pt', row: '370|pt', under: false, lines: whole, ...atFloor }),
    ).toBe('360|pt');
  });
});
