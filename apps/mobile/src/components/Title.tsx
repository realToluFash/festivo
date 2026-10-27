import { useState } from 'react';
import { type TextLayoutEvent, useWindowDimensions } from 'react-native';

import { fitWords, settleWords, titleSize } from '../layout/textSize.ts';
import { Text, type TextProps } from './Text.tsx';

type WholeWordsProps = TextProps & { size: number; children: string };

/** One size for several texts, stepping down from `start` while any of them breaks a word, never below `size` (sc-13496). */
function useWholeWords(size: number, start: number, texts: readonly string[]) {
  const text = texts.join('\n');
  const [state, setState] = useState(() => fitWords(null, start, text));
  const fit = fitWords(state, start, text);
  if (fit !== state) setState(fit);

  return {
    maxFontSizeMultiplier: fit.drawn / size,
    onTextLayout: (event: TextLayoutEvent) => {
      const lines = event.nativeEvent.lines.map((line) => line.text);
      setState((current) =>
        current.key === fit.key && current.drawn === fit.drawn
          ? settleWords(current, size, lines)
          : current,
      );
    },
  };
}

/** Steps down from `start` rather than break a word, never below `size` (sc-13496). */
export function WholeWords({
  size,
  start,
  children,
  onTextLayout,
  ...rest
}: WholeWordsProps & { start: number }) {
  const words = useWholeWords(size, start, [children]);

  return (
    <Text
      {...rest}
      size={size}
      maxFontSizeMultiplier={words.maxFontSizeMultiplier}
      onTextLayout={(event) => {
        onTextLayout?.(event);
        words.onTextLayout(event);
      }}
    >
      {children}
    </Text>
  );
}

/** Grows less than other text at the accessibility sizes, and steps down rather than break a word (sc-13496). */
export function Title({ size, ...rest }: WholeWordsProps) {
  const { fontScale } = useWindowDimensions();

  return <WholeWords weight="bold" {...rest} size={size} start={titleSize(size, fontScale)} />;
}
