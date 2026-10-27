import { useState } from 'react';
import { useWindowDimensions } from 'react-native';

import { fitWords, settleWords, titleSize } from '../layout/textSize.ts';
import { Text, type TextProps } from './Text.tsx';

type WholeWordsProps = TextProps & { size: number; children: string };

/** Steps down from `start` rather than break a word, never below `size` (sc-13496). */
export function WholeWords({
  size,
  start,
  children,
  onTextLayout,
  ...rest
}: WholeWordsProps & { start: number }) {
  const [state, setState] = useState(() => fitWords(null, start, children));
  const fit = fitWords(state, start, children);
  if (fit !== state) setState(fit);

  return (
    <Text
      {...rest}
      size={size}
      maxFontSizeMultiplier={fit.drawn / size}
      onTextLayout={(event) => {
        onTextLayout?.(event);
        const next = settleWords(
          fit,
          size,
          event.nativeEvent.lines.map((line) => line.text),
        );
        if (next !== fit) setState(next);
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
