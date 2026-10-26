import { useState } from 'react';
import { useWindowDimensions } from 'react-native';

import { breaksAWord, titleSize } from '../layout/textSize.ts';
import { Text, type TextProps } from './Text.tsx';

/** Grows less than other text at the accessibility sizes, and steps down rather than break a word (sc-13496). */
export function Title({
  size,
  children,
  onTextLayout,
  ...rest
}: TextProps & { size: number; children: string }) {
  const { fontScale } = useWindowDimensions();
  const steps = titleSize(size, fontScale);
  const key = `${steps}|${children}`;
  const [fit, setFit] = useState({ key, drawn: steps });
  if (fit.key !== key) setFit({ key, drawn: steps });
  const drawn = fit.key === key ? fit.drawn : steps;

  return (
    <Text
      weight="bold"
      {...rest}
      size={size}
      maxFontSizeMultiplier={drawn / size}
      onTextLayout={(event) => {
        onTextLayout?.(event);
        if (drawn > size && breaksAWord(event.nativeEvent.lines.map((line) => line.text))) {
          setFit({ key, drawn: Math.max(size, drawn - 1) });
        }
      }}
    >
      {children}
    </Text>
  );
}
