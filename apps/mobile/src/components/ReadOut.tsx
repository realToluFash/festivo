import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Platform, View, type ViewProps } from 'react-native';

import { howToReadOut, liveRegionFor, shownAtMount } from '../kit/readOut.ts';

/** Hands words to the screen reader to say now, without moving its focus. */
export function readOut(words: string, { interrupts = false } = {}): void {
  if (Platform.OS === 'ios') {
    AccessibilityInfo.announceForAccessibilityWithOptions(words, { queue: !interrupts });
  } else if (Platform.OS === 'android') {
    AccessibilityInfo.announceForAccessibility(words);
  }
}

export interface ReadOutOptions {
  /** Said once as the words appear, and not again as they change while they stay: a live region would say each change. */
  once?: boolean | undefined;
  /** Said before whatever the screen reader was saying, rather than after it. */
  interrupts?: boolean | undefined;
  /** Words already there as this mounts were not an answer to anything, so they are not said. */
  quietAtMount?: boolean | undefined;
}

/** Applies howToReadOut to a message as its words change. */
export function useReadOut(
  words: string | null,
  { once = false, interrupts = false, quietAtMount = false }: ReadOutOptions = {},
): Pick<ViewProps, 'accessibilityLiveRegion'> {
  const shown = useRef(shownAtMount(words, quietAtMount));
  useEffect(() => {
    const { shown: now, handOver } = howToReadOut(shown.current, words, {
      os: Platform.OS,
      once,
      interrupts,
    });
    shown.current = now;

    if (handOver != null) readOut(handOver.words, { interrupts: !handOver.queue });
  }, [words, once, interrupts]);

  const liveRegion = liveRegionFor(words, { os: Platform.OS, once, interrupts });

  return liveRegion == null ? {} : { accessibilityLiveRegion: liveRegion };
}

/** A message read out as it appears; `words` are what it says, without its mark or its actions. */
export function ReadOut({
  words,
  once,
  interrupts,
  children,
  ...view
}: ViewProps & { words: string } & Omit<ReadOutOptions, 'quietAtMount'>) {
  const live = useReadOut(words, { once, interrupts });

  return (
    <View {...view} {...live}>
      {children}
    </View>
  );
}
