import { describe, expect, it } from 'vitest';

import {
  howToReadOut,
  newWords,
  settleMs,
  shownAtMount,
  TALKBACK_SETTLE_MS,
  TYPING_PAUSE_MS,
  type Reading,
} from './readOut.ts';

describe('a message read out', () => {
  it('is said as it appears', () => {
    expect(newWords(null, 'Saved.')).toBe('Saved.');
  });

  it('is said again when its words change', () => {
    expect(newWords('Saved.', 'Not saved.')).toBe('Not saved.');
  });

  it('is not said again while its words stay', () => {
    expect(newWords('Saved.', 'Saved.')).toBeNull();
  });

  it('says nothing as it goes', () => {
    expect(newWords('Saved.', null)).toBeNull();
  });
});

describe('a message read out once the typing stops', () => {
  const nothing = (typed: string) => `No time zone matches “${typed}”.`;
  const typing = { interrupts: false, afterTyping: true };

  it('waits for the pause on both, TalkBack’s settle within it', () => {
    for (const os of ['ios', 'android']) {
      expect(howToReadOut(null, nothing('Atlantis'), { ...typing, os }).handOver).toEqual({
        words: nothing('Atlantis'),
        queue: true,
        afterMs: TYPING_PAUSE_MS,
      });
    }
    expect(TYPING_PAUSE_MS).toBeGreaterThan(TALKBACK_SETTLE_MS);
  });

  it('takes back what is still waiting at every key, so nothing is said between keys', () => {
    expect(howToReadOut(null, nothing('Atlantisx'), { ...typing, os: 'android' }).takeBack).toBe(
      true,
    );
  });

  it('is said again with new words after the last said', () => {
    expect(
      howToReadOut(nothing('Atlantis'), nothing('Atlantisxy'), { ...typing, os: 'ios' }).handOver
        ?.words,
    ).toBe(nothing('Atlantisxy'));
  });

  it('is not said again for a key that leaves its words as they were said', () => {
    expect(
      howToReadOut(nothing('Atlantis'), nothing('Atlantis'), { ...typing, os: 'ios' }).handOver,
    ).toBeNull();
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
  const plain = { afterTyping: false, interrupts: false };

  it('on iOS, every new message is handed to VoiceOver at once', () => {
    expect(howToReadOut(null, 'Saved.', { ...plain, os: 'ios' })).toEqual({
      shown: 'Saved.',
      handOver: { words: 'Saved.', queue: true, afterMs: 0 },
      takeBack: true,
    });
  });

  it('on Android, every new message is handed to TalkBack once its focus has settled', () => {
    expect(howToReadOut(null, 'Saved.', { ...plain, os: 'android' })).toEqual({
      shown: 'Saved.',
      handOver: { words: 'Saved.', queue: true, afterMs: TALKBACK_SETTLE_MS },
      takeBack: true,
    });
  });

  it('a message that interrupts is not queued', () => {
    const interrupting = { afterTyping: false, interrupts: true };

    expect(howToReadOut(null, 'Not saved.', { ...interrupting, os: 'ios' }).handOver).toEqual({
      words: 'Not saved.',
      queue: false,
      afterMs: 0,
    });
  });

  it('hands nothing over once the message has gone', () => {
    expect(howToReadOut('Saved.', null, { ...plain, os: 'android' }).handOver).toBeNull();
  });

  it('says nothing of words already there at mount, when quiet at mount', () => {
    const intro = 'Check your inbox.';

    expect(handedOver(shownAtMount(intro, true), [intro], { ...plain, os: 'ios' })).toEqual([null]);
    expect(handedOver(shownAtMount(intro, false), [intro], { ...plain, os: 'ios' })).toEqual([
      { words: intro, queue: true, afterMs: 0 },
    ]);
  });

  it('says a message again once it has gone and come back', () => {
    expect(handedOver(null, ['Saved.', null, 'Saved.'], { ...plain, os: 'ios' })).toEqual([
      { words: 'Saved.', queue: true, afterMs: 0 },
      null,
      { words: 'Saved.', queue: true, afterMs: 0 },
    ]);
  });
});

describe('words still waiting to be said', () => {
  const plain = { os: 'android', afterTyping: false, interrupts: false };

  it('are taken back as the message goes, though the screen stays', () => {
    const nothing = 'No time zone matches “Atlantis”.';

    expect(howToReadOut(nothing, null, { ...plain, afterTyping: true }).takeBack).toBe(true);
    expect(howToReadOut('You cannot ask to join that organisation.', null, plain).takeBack).toBe(
      true,
    );
  });

  it('are taken back when new words replace them', () => {
    expect(howToReadOut('Saved.', 'Not saved.', plain).takeBack).toBe(true);
  });

  it('are kept while the words stay', () => {
    expect(howToReadOut('Saved.', 'Saved.', plain).takeBack).toBe(false);
  });
});

describe('the settle before words are handed over', () => {
  it('is TalkBack’s alone', () => {
    expect(settleMs('android')).toBe(TALKBACK_SETTLE_MS);
    expect(settleMs('ios')).toBe(0);
  });
});
