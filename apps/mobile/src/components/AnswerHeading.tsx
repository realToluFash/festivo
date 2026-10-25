import type { RefObject } from 'react';

import { useFocusOnAnswer } from './Screen.tsx';
import { Text, type TextHandle, type TextProps } from './Text.tsx';

/** The heading of a step a tap brings: it takes screen reader focus once that step shows, and again with each new answer (sc-11032). */
export function AnswerHeading({
  answer,
  ref,
  ...text
}: Omit<TextProps, 'ref'> & { answer: unknown; ref?: RefObject<TextHandle | null> }) {
  const { read } = useFocusOnAnswer<TextHandle>(answer, ref);

  return <Text ref={read} accessibilityRole="header" {...text} />;
}
