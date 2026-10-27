import { useState } from 'react';
import {
  type StyleProp,
  StyleSheet,
  type TextStyle,
  View,
  useWindowDimensions,
} from 'react-native';

import { type WeightName } from '../theme/fonts.ts';
import { fitWidest, titleSize, wordsIn } from '../layout/textSize.ts';
import { Text, type TextProps } from './Text.tsx';

type WholeWordsProps = TextProps & { size: number; children: string };

interface WordsLook {
  weight?: WeightName | undefined;
  style?: StyleProp<TextStyle> | undefined;
}

/** One size for several texts, from their words measured hidden at `start`, never below `size` (sc-13496). */
export function useWholeWords(
  size: number,
  start: number,
  texts: readonly string[],
  look: WordsLook = {},
) {
  const { width: windowWidth } = useWindowDimensions();
  const words = wordsIn(texts);
  const key = `${start}|${windowWidth}|${texts.join('\n')}`;
  const [measured, setMeasured] = useState<Readonly<Record<string, number>>>({});
  const [room, setRoom] = useState<{ key: string; width: number } | null>(null);
  const widths = words.map((word) => measured[`${start}|${word}`]).filter((width) => width != null);
  const drawn =
    room?.key === key && room.width > 0 && widths.length === words.length
      ? fitWidest(size, start, Math.max(...widths), room.width)
      : start;

  const measure = (
    <View
      style={styles.measure}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {words.map((word) => (
        <Text
          key={word}
          size={size}
          weight={look.weight ?? 'regular'}
          style={look.style ?? null}
          maxFontSizeMultiplier={start / size}
          onLayout={(event) => {
            const { width } = event.nativeEvent.layout;
            setMeasured((current) => ({ ...current, [`${start}|${word}`]: width }));
          }}
          accessible={false}
        >
          {word}
        </Text>
      ))}
    </View>
  );

  return {
    measure,
    drawnAtStart: drawn === start,
    maxFontSizeMultiplier: drawn / size,
    /** The width the texts have, read once for each start, window width and text. */
    room: (width: number) =>
      setRoom((current) => (current?.key === key ? current : { key, width })),
  };
}

/** Steps down from `start` rather than break a word, never below `size` (sc-13496). */
export function WholeWords({
  size,
  start,
  children,
  onLayout,
  ...rest
}: WholeWordsProps & { start: number }) {
  const words = useWholeWords(size, start, [children], { weight: rest.weight, style: rest.style });

  return (
    <>
      {words.measure}
      <Text
        {...rest}
        size={size}
        maxFontSizeMultiplier={words.maxFontSizeMultiplier}
        onLayout={(event) => {
          onLayout?.(event);
          // Drawn at the start, a text is as wide as its room whenever a word of it would not fit.
          if (words.drawnAtStart) words.room(event.nativeEvent.layout.width);
        }}
      >
        {children}
      </Text>
    </>
  );
}

/** Grows less than other text at the accessibility sizes, and steps down rather than break a word (sc-13496). */
export function Title({ size, ...rest }: WholeWordsProps) {
  const { fontScale } = useWindowDimensions();

  return <WholeWords weight="bold" {...rest} size={size} start={titleSize(size, fontScale)} />;
}

const styles = StyleSheet.create({
  // Each word at its full size, unbounded, so a text can be sized before any of it breaks a word.
  measure: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 10000,
    alignItems: 'flex-start',
    opacity: 0,
  },
});
