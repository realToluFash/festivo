import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  type StyleProp,
  StyleSheet,
  type TextStyle,
  View,
  useWindowDimensions,
} from 'react-native';

import { type WeightName } from '../theme/fonts.ts';
import {
  type DrawnTitle,
  fitWidest,
  lineStart,
  piecesIn,
  reportTitle,
  titleCapKey,
  titleCapOn,
  titleSize,
  wordsIn,
  wordsRoomKey,
  wordsSlot,
} from '../layout/textSize.ts';
import { Text, TitleCap, type TextProps } from './Text.tsx';

type WholeWordsProps = TextProps & { size: number; children: string };

interface WordsLook {
  weight?: WeightName | undefined;
  style?: StyleProp<TextStyle> | undefined;
  /** The width the texts have, known from the container, so the size does not wait on seeing a text wrap. */
  room?: number | undefined;
  /** Measures each word in pieces split after a hyphen it already has, where a line may break without breaking a word (sc-69816). */
  breakAfterHyphens?: boolean | undefined;
}

/** Each of these words drawn hidden and unbounded, to know how wide it is before anything that shows it is laid out. */
export function MeasuredWords({
  words,
  onWidth,
  ...look
}: Pick<TextProps, 'size' | 'weight' | 'style' | 'maxFontSizeMultiplier' | 'allowFontScaling'> & {
  words: readonly string[];
  onWidth: (word: string, width: number) => void;
}) {
  return (
    // Measured at their own size, never under a title's cap, or a stepped-down title would measure smaller and step up again.
    <TitleCap.Provider value={null}>
      <View
        style={styles.measure}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {[...new Set(words)].map((word) => (
          <Text
            // A new Text per start, so a layout read at the last start is never filed under this one when the title's cap moves (sc-69816).
            key={`${look.maxFontSizeMultiplier ?? 1}|${word}`}
            {...look}
            style={[look.style, styles.word]}
            onLayout={(event) => onWidth(word, event.nativeEvent.layout.width)}
            accessible={false}
          >
            {word}
          </Text>
        ))}
      </View>
    </TitleCap.Provider>
  );
}

/** One size for several texts, from their words measured hidden at `start`, never below `size` (sc-13496). */
export function useWholeWords(
  size: number,
  start: number,
  texts: readonly string[],
  look: WordsLook = {},
) {
  const { width: windowWidth } = useWindowDimensions();
  const words = look.breakAfterHyphens ? piecesIn(texts) : wordsIn(texts);
  const given = look.room != null && look.room > 0 ? look.room : undefined;
  const roomKey = wordsRoomKey(start, windowWidth, given);
  const seenKey = `${roomKey}|${texts.join('\n')}`;
  const [measured, setMeasured] = useState<Readonly<Record<string, number>>>({});
  const [room, setRoom] = useState<{ key: string; width: number } | null>(null);
  const [reported, setReported] = useState<{ windowWidth: number; width: number } | null>(null);
  const [seen, setSeen] = useState<{ key: string; width: number } | null>(null);
  const widths = words.map((word) => measured[`${start}|${word}`]).filter((width) => width != null);
  const natural = texts.map((text) => measured[`${start}|${text}`]);
  // A text drawn at the start is as wide as its room only when it wrapped, so a narrower reading says nothing of the room.
  const wrapped =
    seen?.key === seenKey && natural.some((width) => width != null && width > seen.width + 0.5);
  const slot = wordsSlot(
    {
      wrapped: wrapped ? seen.width : null,
      kept: room,
      reported: given == null ? reported : { windowWidth, width: given },
    },
    start,
    windowWidth,
    given,
  );
  const drawn =
    slot > 0 && widths.length === words.length
      ? fitWidest(size, start, Math.max(...widths), slot)
      : start;

  // Kept under the start and window width, so it outlives a change of the texts.
  if (wrapped && (room?.key !== roomKey || room.width !== seen.width)) {
    setRoom({ key: roomKey, width: seen.width });
  }

  const measure = (
    <MeasuredWords
      words={[...words, ...texts]}
      size={size}
      weight={look.weight ?? 'regular'}
      style={look.style ?? null}
      maxFontSizeMultiplier={start / size}
      onWidth={(word, width) => {
        setMeasured((current) => ({ ...current, [`${start}|${word}`]: width }));
      }}
    />
  );

  return {
    measure,
    drawnAtStart: drawn === start,
    maxFontSizeMultiplier: drawn / size,
    /** The width each of the texts has, whatever the texts say, for as long as the window keeps its width. */
    room: (width: number) =>
      setReported((current) =>
        current?.windowWidth === windowWidth && current.width === width
          ? current
          : { windowWidth, width },
      ),
    /** The width a text drawn at the start was laid out at, its room if it wrapped. */
    seen: (width: number) => setSeen({ key: seenKey, width }),
  };
}

/** Steps down from `start` rather than break a word, never below `size` (sc-13496). */
export function WholeWords({
  size,
  start,
  children,
  onLayout,
  onDrawn,
  room,
  breakAfterHyphens,
  ...rest
}: WholeWordsProps & {
  start: number;
  onDrawn?: ((size: number) => void) | undefined;
  room?: number | undefined;
  breakAfterHyphens?: boolean | undefined;
}) {
  const words = useWholeWords(size, start, [children], {
    weight: rest.weight,
    style: rest.style,
    room,
    breakAfterHyphens,
  });
  const drawnSize = words.maxFontSizeMultiplier * size;

  useEffect(() => onDrawn?.(drawnSize), [onDrawn, drawnSize]);

  return (
    <>
      {words.measure}
      <Text
        {...rest}
        // A new size mounts a new Text, so iOS never draws one size in the box laid out for another (sc-69816).
        key={drawnSize}
        size={size}
        maxFontSizeMultiplier={words.maxFontSizeMultiplier}
        onLayout={(event) => {
          onLayout?.(event);
          if (words.drawnAtStart) words.seen(event.nativeEvent.layout.width);
        }}
      >
        {children}
      </Text>
    </>
  );
}

/** Grows with the text up to a title's cap, and no larger than `under` when given, then steps down rather than break a word, never below `size` (sc-67338). */
export function CappedWholeWords({
  under = Infinity,
  ...props
}: WholeWordsProps & {
  under?: number | undefined;
  onDrawn?: ((size: number) => void) | undefined;
  room?: number | undefined;
  breakAfterHyphens?: boolean | undefined;
}) {
  const { fontScale } = useWindowDimensions();
  const cap = useContext(TitleCap);

  return <WholeWords {...props} start={lineStart(props.size, fontScale, cap ?? Infinity, under)} />;
}

/** Grows less than other text at the accessibility sizes, and steps down rather than break a word (sc-13496). */
export function Title({
  size,
  ...rest
}: WholeWordsProps & {
  onDrawn?: ((size: number) => void) | undefined;
  room?: number | undefined;
}) {
  const { fontScale } = useWindowDimensions();

  return <WholeWords weight="bold" {...rest} size={size} start={titleSize(size, fontScale)} />;
}

/** Where a page's title says the size it drew at, so the frame caps what is under it there (sc-67338). */
export const PageTitleDrawn = createContext<((size: number) => void) | undefined>(undefined);

export function usePageTitleDrawn() {
  return useContext(PageTitleDrawn);
}

/** A page's title drawn in the frame's body, as an event area's, which tells the frame the size it drew at (sc-67338). */
export function BodyTitle(props: WholeWordsProps & { room?: number | undefined }) {
  return <Title {...props} onDrawn={usePageTitleDrawn()} />;
}

/** The size a page's title of `size` drew at, for the page `at`; until it says, the size it will draw at unless a word steps it down (sc-67338). */
export function useTitleCap(at: string, size: number) {
  const { fontScale } = useWindowDimensions();
  const key = titleCapKey(at, fontScale);
  const [drawn, setDrawn] = useState<DrawnTitle | null>(null);
  const onDrawn = useCallback(
    (next: number) => setDrawn((now) => reportTitle(now, key, next)),
    [key],
  );

  return { ...titleCapOn(drawn, key, size, fontScale), onDrawn };
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
  // A caller's stretch or flex would make a word as wide as the box above, and every text would step down to its floor (sc-37693).
  word: { flex: 0, alignSelf: 'flex-start' },
});
