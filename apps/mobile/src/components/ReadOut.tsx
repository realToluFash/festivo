import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Platform, View, type ViewProps } from 'react-native';

import { howToReadOut, settleMs, shownAtMount } from '../kit/readOut.ts';

/** Hands words to the screen reader to say, without moving its focus; the returned function takes them back unsaid. */
export function readOut(
  words: string,
  { interrupts = false, afterMs = settleMs(Platform.OS) } = {},
): () => void {
  const timer = setTimeout(() => {
    if (Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibilityWithOptions(words, { queue: !interrupts });
    } else if (Platform.OS === 'android') {
      AccessibilityInfo.announceForAccessibility(words);
    }
  }, afterMs);

  return () => clearTimeout(timer);
}

export interface ReadOutOptions {
  /** Said once as the words appear, and not again as they change while they stay. */
  once?: boolean | undefined;
  /** On iOS, said before whatever VoiceOver was saying rather than after it; TalkBack says it after the settle like any other. */
  interrupts?: boolean | undefined;
  /** Words already there as this mounts were not an answer to anything, so they are not said. */
  quietAtMount?: boolean | undefined;
}

/** Applies howToReadOut to a message as its words change. */
export function useReadOut(
  words: string | null,
  { once = false, interrupts = false, quietAtMount = false }: ReadOutOptions = {},
): void {
  const shown = useRef(shownAtMount(words, quietAtMount));
  const unsaid = useRef<(() => void) | null>(null);

  useEffect(() => {
    const {
      shown: now,
      handOver,
      takeBack,
    } = howToReadOut(shown.current, words, {
      os: Platform.OS,
      once,
      interrupts,
    });
    shown.current = now;

    if (takeBack) {
      unsaid.current?.();
      unsaid.current = null;
    }
    if (handOver != null) {
      unsaid.current = readOut(handOver.words, {
        interrupts: !handOver.queue,
        afterMs: handOver.afterMs,
      });
    }
  }, [words, once, interrupts]);

  useEffect(() => () => unsaid.current?.(), []);
}

/** A message read out as it appears; `words` are what it says, without its mark or its actions. */
export function ReadOut({
  words,
  once,
  interrupts,
  children,
  ...view
}: ViewProps & { words: string } & Omit<ReadOutOptions, 'quietAtMount'>) {
  useReadOut(words, { once, interrupts });

  return <View {...view}>{children}</View>;
}
