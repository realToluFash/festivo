export interface Reading {
  os: string;
  /** Waits for the typing to stop, and `before` is the words last said rather than last shown. */
  afterTyping: boolean;
  /** On iOS, said before whatever VoiceOver was saying rather than after it; TalkBack says it after the settle like any other. */
  interrupts: boolean;
}

/** Long enough for what TalkBack says as its focus moves, on a new screen or off a button gone busy, to go first. */
export const TALKBACK_SETTLE_MS = 1000;

/** No key for this long and the typing has stopped: a pause neither WAI-ARIA nor WCAG puts a number on (sc-11930). */
export const TYPING_PAUSE_MS = 2000;

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
  /** What becomes `before` for the next words; with `afterTyping`, the words last said, and `shownOnceSaid` moves it on as words are said. */
  shown: string | null;
  handOver: HandOver | null;
  /** Words handed over before and still waiting are not said: the message has gone or has new words. */
  takeBack: boolean;
}

/** What `before` is as a message mounts: words already there were not an answer to anything, so they are not said. */
export function shownAtMount(words: string | null, quietAtMount: boolean): string | null {
  return quietAtMount ? words : null;
}

/** What `before` is as `now` answers in place of `before`: a new answer is a new tap, so its words are said too, even in the same words. */
export function shownBeforeAnswer(
  shown: string | null,
  answered: unknown,
  answer: unknown,
): string | null {
  return Object.is(answered, answer) ? shown : null;
}

/** The words to say as a message goes from `before` to `now`, or null when there is nothing new to say. */
export function newWords(before: string | null, now: string | null): string | null {
  if (now == null || now === before) return null;

  return now;
}

/** Both screen readers are handed the words: VoiceOver has no live region, and Fabric flattens away a layout-only View along with its live region, so TalkBack never sees it (WCAG 2.2 SC 4.1.3). */
export function howToReadOut(
  before: string | null,
  now: string | null,
  { os, interrupts, afterTyping }: Reading,
): ReadAnswer {
  const said = newWords(before, now);
  const afterMs = afterTyping ? TYPING_PAUSE_MS : settleMs(os);

  return {
    // A key typed while words wait has said nothing yet, so the next pause with those words still says them.
    shown: afterTyping && now != null ? before : now,
    handOver: said == null ? null : { words: said, queue: !interrupts, afterMs },
    // Each key restarts the wait, so words still waiting go with it.
    takeBack: afterTyping || now == null || said != null,
  };
}

/** What `before` becomes as `handOver` is said: once the typing stops, the words said; otherwise it is already what is shown. */
export function shownOnceSaid(
  shown: string | null,
  handOver: HandOver,
  { afterTyping }: Pick<Reading, 'afterTyping'>,
): string | null {
  return afterTyping ? handOver.words : shown;
}
