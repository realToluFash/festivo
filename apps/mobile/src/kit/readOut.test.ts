import { describe, expect, it } from 'vitest';

import {
  howToReadOut,
  newWords,
  settleMs,
  shownAtMount,
  TALKBACK_SETTLE_MS,
  type Reading,
} from './readOut.ts';

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

  it('a message said once is handed over on both', () => {
    for (const os of ['ios', 'android']) {
      expect(
        howToReadOut(null, 'No match.', { os, once: true, interrupts: false }).handOver,
      ).toEqual(expect.objectContaining({ words: 'No match.', queue: true }));
    }
  });

  it('a message that interrupts is not queued', () => {
    const interrupting = { once: false, interrupts: true };

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

  it('says a message read once again once it has gone and come back', () => {
    const once = { os: 'ios', once: true, interrupts: false };

    expect(handedOver(null, ['No match for “Atl”.', null, 'No match for “Lon”.'], once)).toEqual([
      { words: 'No match for “Atl”.', queue: true, afterMs: 0 },
      null,
      { words: 'No match for “Lon”.', queue: true, afterMs: 0 },
    ]);
  });
});

describe('words still waiting to be said', () => {
  const plain = { os: 'android', once: false, interrupts: false };

  it('are taken back as the message goes, though the screen stays', () => {
    const nothing = 'No time zone matches “Atlantis”.';

    expect(howToReadOut(nothing, null, { ...plain, once: true }).takeBack).toBe(true);
    expect(howToReadOut('You cannot ask to join that organisation.', null, plain).takeBack).toBe(
      true,
    );
  });

  it('are taken back when new words replace them', () => {
    expect(howToReadOut('Saved.', 'Not saved.', plain).takeBack).toBe(true);
  });

  it('are kept while a message read once stays with new words', () => {
    expect(
      howToReadOut('No match for “Atl”.', 'No match for “Atla”.', { ...plain, once: true })
        .takeBack,
    ).toBe(false);
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
