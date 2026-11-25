import { type Ref, useEffect, useState } from 'react';
import { type StyleProp, StyleSheet, type TextStyle } from 'react-native';

import { Text, type TextHandle } from '../../components/Text.tsx';
import { MeasuredWords } from '../../components/Title.tsx';
import { atAccessibilitySizes } from '../../layout/textSize.ts';
import { piecesOfLine, wordsSize, wordsStart } from './todaySizeRules.ts';

/** A text at the stand-in size whose lines break only between its pieces, all of them one size (sc-69816's rule). */
export function FitWords({
  text,
  size,
  scale,
  cap,
  room,
  weight,
  line,
  role,
  lines,
  style,
  onDrawn,
  testID,
  ref,
  pieces: given,
}: {
  text: string;
  size: number;
  scale: number;
  cap: number;
  room: number;
  weight: 'medium' | 'semibold' | 'bold';
  line: number;
  role?: 'header';
  lines?: number | undefined;
  style?: StyleProp<TextStyle> | undefined;
  onDrawn?: (size: number) => void;
  testID?: string;
  ref?: Ref<TextHandle>;
  /** Where the text may wrap, when not only between its words. */
  pieces?: readonly string[];
}) {
  const start = wordsStart(size, scale, cap);
  const key = `${start}|${weight}|${text}`;
  const pieces = given ?? piecesOfLine(text);
  const [measured, setMeasured] = useState<{ key: string; widths: Record<string, number> }>({
    key: '',
    widths: {},
  });
  const widths = measured.key === key ? measured.widths : {};
  const widest = pieces.every((piece) => widths[piece] != null)
    ? Math.max(...pieces.map((piece) => widths[piece] ?? 0))
    : null;
  // Below AX1 the text is main's and waits for nothing; from AX1 it is hidden until its room and its widest piece are known.
  const pending = atAccessibilitySizes(scale) && (widest == null || room === 0);
  const drawn =
    pending || widest == null ? start : wordsSize(size, scale, cap, widest, Math.max(room, 1));

  useEffect(() => {
    if (!pending) onDrawn?.(drawn);
  }, [pending, drawn, onDrawn]);

  return (
    <>
      <MeasuredWords
        words={pieces}
        size={start}
        weight={weight}
        allowFontScaling={false}
        onWidth={(piece, width) =>
          setMeasured((now) => {
            const kept = now.key === key ? now.widths : {};

            return kept[piece] === width ? now : { key, widths: { ...kept, [piece]: width } };
          })
        }
      />
      <Text
        // A new size mounts a new Text, so iOS never draws one size in the box laid out for another (sc-69816).
        key={drawn}
        ref={ref}
        size={drawn}
        weight={weight}
        allowFontScaling={false}
        accessibilityRole={role}
        numberOfLines={lines}
        style={[{ lineHeight: Math.ceil(drawn * line) }, style, pending && styles.waiting]}
        testID={testID}
      >
        {text}
      </Text>
    </>
  );
}

const styles = StyleSheet.create({ waiting: { opacity: 0 } });
