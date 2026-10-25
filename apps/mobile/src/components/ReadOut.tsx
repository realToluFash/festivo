import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Platform, View, type ViewProps } from 'react-native';

import {
  howToReadOut,
  settleMs,
  shownAtMount,
  shownBeforeAnswer,
  shownOnceSaid,
} from '../kit/readOut.ts';

/** Hands words to the screen reader to say, without moving its focus; the returned function takes them back unsaid. */
export function readOut(
  words: string,
  {
    interrupts = false,
    afterMs = settleMs(Platform.OS),
    onSaid,
  }: { interrupts?: boolean; afterMs?: number; onSaid?: (() => void) | undefined } = {},
): () => void {
  const timer = setTimeout(() => {
    onSaid?.();
    if (Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibilityWithOptions(words, { queue: !interrupts });
    } else if (Platform.OS === 'android') {
      AccessibilityInfo.announceForAccessibility(words);
    }
  }, afterMs);

  return () => clearTimeout(timer);
}

export interface ReadOutOptions {
  /** The field being typed in: the words wait until it has stopped changing, and are said only when they differ from the last said. */
  afterTyping?: string | undefined;
  /** On iOS, said before whatever VoiceOver was saying rather than after it; TalkBack says it after the settle like any other. */
  interrupts?: boolean | undefined;
  /** Words already there as this mounts were not an answer to anything, so they are not said. */
  quietAtMount?: boolean | undefined;
  /** The tap the words answer: a new one says them again, even in the same words. */
  answer?: unknown;
}

/** Applies howToReadOut to a message as its words change. */
export function useReadOut(
  words: string | null,
  { afterTyping, interrupts = false, quietAtMount = false, answer }: ReadOutOptions = {},
): void {
  const shown = useRef(shownAtMount(words, quietAtMount));
  const answered = useRef(answer);
  const unsaid = useRef<(() => void) | null>(null);
  const typing = afterTyping !== undefined;

  useEffect(() => {
    const reading = { os: Platform.OS, afterTyping: typing, interrupts };
    const before = shownBeforeAnswer(shown.current, answered.current, answer);
    answered.current = answer;
    const { shown: now, handOver, takeBack } = howToReadOut(before, words, reading);
    shown.current = now;

    if (takeBack) {
      unsaid.current?.();
      unsaid.current = null;
    }
    if (handOver != null) {
      unsaid.current = readOut(handOver.words, {
        interrupts: !handOver.queue,
        afterMs: handOver.afterMs,
        onSaid: () => {
          shown.current = shownOnceSaid(shown.current, handOver, reading);
        },
      });
    }
  }, [words, afterTyping, typing, interrupts, answer]);

  useEffect(() => () => unsaid.current?.(), []);
}

/** A message read out as it appears; `words` are what it says, without its mark or its actions. */
export function ReadOut({
  words,
  interrupts,
  answer,
  children,
  ...view
}: ViewProps & { words: string } & Pick<ReadOutOptions, 'interrupts' | 'answer'>) {
  useReadOut(words, { interrupts, answer });

  return <View {...view}>{children}</View>;
}
