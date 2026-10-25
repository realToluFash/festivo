export interface Reading {
  os: string;
  /** Said once as the words appear, and not again as they change while they stay. */
  once: boolean;
  /** On iOS, said before whatever VoiceOver was saying rather than after it; TalkBack says it after the settle like any other. */
  interrupts: boolean;
}

/** Long enough for what TalkBack says as its focus moves, on a new screen or off a button gone busy, to go first. */
export const TALKBACK_SETTLE_MS = 1000;

/** How long words wait before they are handed over on `os`. */
export function settleMs(os: string): number {
  return os === 'android' ? TALKBACK_SETTLE_MS : 0;
}

export interface HandOver {
  words: string;
  /** VoiceOver waits for what it is saying to finish; TalkBack has no queue to choose. */
  queue: boolean;
  /** TalkBack drops words handed over just before its focus moves, so they wait for it. */
  afterMs: number;
}

export interface ReadAnswer {
  /** What becomes `before` for the next words. */
  shown: string | null;
  handOver: HandOver | null;
  /** Words handed over before and still waiting are not said: the message has gone or has new words. */
  takeBack: boolean;
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

/** Both screen readers are handed the words: VoiceOver has no live region, and Fabric flattens away a layout-only View along with its live region, so TalkBack never sees it (WCAG 2.2 SC 4.1.3). */
export function howToReadOut(
  before: string | null,
  now: string | null,
  { os, once, interrupts }: Reading,
): ReadAnswer {
  const said = newWords(before, now, once);

  return {
    shown: now,
    handOver: said == null ? null : { words: said, queue: !interrupts, afterMs: settleMs(os) },
    takeBack: now == null || said != null,
  };
}
