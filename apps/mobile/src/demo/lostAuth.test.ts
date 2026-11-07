import { describe, expect, it } from 'vitest';

import {
  CLOSED,
  NOT_CANCELLED,
  TRIES,
  askToCancel,
  cancelSettled,
  codeWords,
  keepWaiting,
  pressCancel,
  spentAfter,
  spentWords,
} from './lostAuth.ts';

describe('lost authenticator counts the codes it sends (sc-30737)', () => {
  it('says one code on the start page with no verified mobile', () => {
    expect(codeWords(true)).toEqual({
      step: 'You enter the code here.',
      send: 'Send the code',
      sending: 'Sending the code…',
      resend: 'Send a new code',
    });
  });

  it('keeps two codes on the start page with a verified mobile', () => {
    expect(codeWords(false)).toEqual({
      step: 'You enter the codes here.',
      send: 'Send the codes',
      sending: 'Sending the codes…',
      resend: 'Send new codes',
    });
  });

  it('says the one code has expired, in Verify your email’s words', () => {
    expect(spentWords('expired', true)).toEqual({
      title: 'That code has expired',
      body: 'Codes only work for a while. Send a new one and use the code in the newest email.',
    });
  });

  it('says the one code no longer works after five wrong tries', () => {
    expect(spentWords('exhausted', true)).toEqual({
      title: 'Too many wrong tries',
      body: 'That code no longer works. Send a new one to carry on.',
    });
  });

  it.each([
    ['expired', 'Those codes have expired', /^Codes only work for a while\. Send new ones/],
    ['exhausted', 'Too many wrong tries', /^Those codes no longer work\. Send new ones/],
  ] as const)('keeps both codes’ words when %s with a verified mobile', (spent, title, body) => {
    const words = spentWords(spent, false);

    expect(words.title).toBe(title);
    expect(words.body).toMatch(body);
  });

  it('spends the codes at the fifth wrong try, not before', () => {
    expect(spentAfter(TRIES - 1)).toBeNull();
    expect(spentAfter(TRIES)).toBe('exhausted');
  });
});

describe('a cancel that does not go through says so (sc-30737)', () => {
  it('keeps the sheet open with the line when Soirely cannot be reached', () => {
    const sending = pressCancel(askToCancel());

    expect(sending).toEqual({ open: true, sending: true, notCancelled: false });
    expect(cancelSettled(sending, false)).toEqual({
      open: true,
      sending: false,
      notCancelled: true,
    });
  });

  it('hides the line on the next press, and cancels once Soirely answers', () => {
    const failed = cancelSettled(pressCancel(askToCancel()), false);
    if (failed === 'cancelled') throw new Error('the first try reached Soirely');
    const again = pressCancel(failed);

    expect(again.notCancelled).toBe(false);
    expect(cancelSettled(again, true)).toBe('cancelled');
  });

  it('closes on Keep waiting with the request still waiting, but not while it sends', () => {
    const failed = cancelSettled(pressCancel(askToCancel()), false);
    if (failed === 'cancelled') throw new Error('the first try reached Soirely');

    expect(keepWaiting(failed)).toEqual(CLOSED);
    expect(keepWaiting(pressCancel(failed)).open).toBe(true);
  });

  it('says what did not happen, and what to do', () => {
    expect(NOT_CANCELLED).toBe('Not cancelled. Your request is still waiting. Try again.');
  });
});
