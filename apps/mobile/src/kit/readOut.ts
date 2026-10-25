export interface Reading {
  os: string;
  /** Said once as the words appear, and not again as they change while they stay: a live region would say each change. */
  once: boolean;
  /** Said before whatever the screen reader was saying, rather than after it. */
  interrupts: boolean;
}

export interface HandOver {
  words: string;
  /** VoiceOver waits for what it is saying to finish; TalkBack has no queue to choose. */
  queue: boolean;
}

export interface ReadAnswer {
  /** What becomes `before` for the next words. */
  shown: string | null;
  handOver: HandOver | null;
  liveRegion: 'polite' | 'assertive' | undefined;
}

/** What `before` is as a message mounts: words already there were not an answer to anything, so they are not said. */
export function shownAtMount(words: string | null, quietAtMount: boolean): string | null {
  return quietAtMount ? words : null;
}

/** The words to say as a message goes from `before` to `now`, or null when there is nothing new to say. */
export function newWords(before: string | null, now: string | null, once: boolean): string | null {
  if (now == null || now === before || (once && before != null)) return null;

  return now;
}

/** The live region a message sets: TalkBack's alone, and none for a message said once, which is handed over instead. */
export function liveRegionFor(
  now: string | null,
  { os, once, interrupts }: Reading,
): ReadAnswer['liveRegion'] {
  if (os !== 'android' || now == null || once) return undefined;

  return interrupts ? 'assertive' : 'polite';
}

/** TalkBack takes a live region; VoiceOver has none, so it is handed the words, and so is a message said once (WCAG 2.2 SC 4.1.3). */
export function howToReadOut(
  before: string | null,
  now: string | null,
  reading: Reading,
): ReadAnswer {
  const { os, once, interrupts } = reading;
  const said = newWords(before, now, once);
  const handedOver = os === 'ios' || once;

  return {
    shown: now,
    handOver: said != null && handedOver ? { words: said, queue: !interrupts } : null,
    liveRegion: liveRegionFor(now, reading),
  };
}
