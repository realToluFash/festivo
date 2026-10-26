import { useState } from 'react';
import { useWindowDimensions } from 'react-native';

import { fitTitle, settleTitle } from '../layout/textSize.ts';
import { Text, type TextProps } from './Text.tsx';

/** Grows less than other text at the accessibility sizes, and steps down rather than break a word (sc-13496). */
export function Title({
  size,
  children,
  onTextLayout,
  ...rest
}: TextProps & { size: number; children: string }) {
  const { fontScale } = useWindowDimensions();
  const [state, setState] = useState(() => fitTitle(null, size, fontScale, children));
  const fit = fitTitle(state, size, fontScale, children);
  if (fit !== state) setState(fit);

  return (
    <Text
      weight="bold"
      {...rest}
      size={size}
      maxFontSizeMultiplier={fit.drawn / size}
      onTextLayout={(event) => {
        onTextLayout?.(event);
        const next = settleTitle(
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
