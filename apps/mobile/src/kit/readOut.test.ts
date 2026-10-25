import { describe, expect, it } from 'vitest';

import { howToReadOut, newWords, shownAtMount, type Reading } from './readOut.ts';

describe('a message read out', () => {
  it('is said as it appears', () => {
    expect(newWords(null, 'Saved.', false)).toBe('Saved.');
  });

  it('is said again when its words change', () => {
    expect(newWords('Saved.', 'Not saved.', false)).toBe('Not saved.');
  });

  it('is not said again while its words stay', () => {
    expect(newWords('Saved.', 'Saved.', false)).toBeNull();
  });

  it('says nothing as it goes', () => {
    expect(newWords('Saved.', null, false)).toBeNull();
  });
});

describe('a message read out once', () => {
  const nothing = (typed: string) => `No time zone matches “${typed}”.`;

  it('is said as it appears', () => {
    expect(newWords(null, nothing('Atl'), true)).toBe(nothing('Atl'));
  });

  it('is not said again for each key typed while it stays', () => {
    expect(newWords(nothing('Atl'), nothing('Atla'), true)).toBeNull();
  });
});

/** The words handed over as a message shows each of `steps` in turn, from what it showed at mount. */
function handedOver(atMount: string | null, steps: (string | null)[], reading: Reading) {
  let shown = atMount;

  return steps.map((now) => {
    const answer = howToReadOut(shown, now, reading);
    shown = answer.shown;

    return answer.handOver;
  });
}

describe('which screen reader gets a message, and how', () => {
  const plain = { once: false, interrupts: false };

  it('on iOS, every new message is handed to VoiceOver, with no live region', () => {
    expect(howToReadOut(null, 'Saved.', { ...plain, os: 'ios' })).toEqual({
      shown: 'Saved.',
      handOver: { words: 'Saved.', queue: true },
      liveRegion: undefined,
    });
  });

  it('on Android, a message sets a live region and is not handed over', () => {
    expect(howToReadOut(null, 'Saved.', { ...plain, os: 'android' })).toEqual({
      shown: 'Saved.',
      handOver: null,
      liveRegion: 'polite',
    });
  });

  it('a message said once is handed over on both, with no live region', () => {
    for (const os of ['ios', 'android']) {
      expect(howToReadOut(null, 'No match.', { os, once: true, interrupts: false })).toEqual({
        shown: 'No match.',
        handOver: { words: 'No match.', queue: true },
        liveRegion: undefined,
      });
    }
  });

  it('a message that interrupts is assertive on Android and not queued on iOS', () => {
    const interrupting = { once: false, interrupts: true };

    expect(howToReadOut(null, 'Not saved.', { ...interrupting, os: 'android' }).liveRegion).toBe(
      'assertive',
    );
    expect(howToReadOut(null, 'Not saved.', { ...interrupting, os: 'ios' }).handOver).toEqual({
      words: 'Not saved.',
      queue: false,
    });
  });

  it('sets no live region once the message has gone', () => {
    expect(howToReadOut('Saved.', null, { ...plain, os: 'android' }).liveRegion).toBeUndefined();
  });

  it('says nothing of words already there at mount, when quiet at mount', () => {
    const intro = 'Check your inbox.';

    expect(handedOver(shownAtMount(intro, true), [intro], { ...plain, os: 'ios' })).toEqual([null]);
    expect(handedOver(shownAtMount(intro, false), [intro], { ...plain, os: 'ios' })).toEqual([
      { words: intro, queue: true },
    ]);
  });

  it('says a message read once again once it has gone and come back', () => {
    const once = { os: 'ios', once: true, interrupts: false };

    expect(handedOver(null, ['No match for “Atl”.', null, 'No match for “Lon”.'], once)).toEqual([
      { words: 'No match for “Atl”.', queue: true },
      null,
      { words: 'No match for “Lon”.', queue: true },
    ]);
  });
});
