import { useContext, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { Text, TitleCap } from '../../components/Text.tsx';
import { MeasuredWords } from '../../components/Title.tsx';
import {
  capUnderTitle,
  drawnSize,
  fitWidest,
  piecesIn,
  wholeLineHeight,
} from '../../layout/textSize.ts';
import { tokens } from '../../theme/tokens.ts';

const TAG_SIZE = 12.5;
const TAG_ENDS = 9;

/** sc-90472: a row's Outside tag at the accessibility sizes, under the name, every word whole. It starts at the size main draws it, wraps between words, and the whole tag steps down until its widest word fits its line, never under 12.5 (sc-69816's rule); a word too wide even then breaks where its line ends. */
export function WholeWordsTag({ word }: { word: string }) {
  const { fontScale } = useWindowDimensions();
  const cap = useContext(TitleCap);
  const start = drawnSize(
    TAG_SIZE,
    fontScale,
    cap == null ? undefined : capUnderTitle(cap, TAG_SIZE),
  );
  const [room, setRoom] = useState(0);
  const key = `${start}|${word}`;
  const pieces = piecesIn([word]);
  const [measured, setMeasured] = useState<{ key: string; widths: Record<string, number> }>({
    key: '',
    widths: {},
  });
  const widths = measured.key === key ? measured.widths : {};
  const widest = pieces.every((piece) => widths[piece] != null)
    ? Math.max(...pieces.map((piece) => widths[piece] ?? 0))
    : null;
  const pending = widest == null || room === 0;
  const drawn = pending ? start : fitWidest(TAG_SIZE, start, widest, room);

  return (
    <View onLayout={(event) => setRoom(event.nativeEvent.layout.width - 2 * TAG_ENDS)}>
      <MeasuredWords
        words={pieces}
        size={start}
        weight="semibold"
        allowFontScaling={false}
        onWidth={(piece, width) =>
          setMeasured((now) => {
            const kept = now.key === key ? now.widths : {};

            return kept[piece] === width ? now : { key, widths: { ...kept, [piece]: width } };
          })
        }
      />
      <View style={[styles.tag, pending && styles.waiting]}>
        <Text
          // A new size mounts a new Text, so iOS never draws one size in the box laid out for another (sc-69816).
          key={drawn}
          size={drawn}
          weight="semibold"
          allowFontScaling={false}
          accessible={false}
          style={[styles.word, { lineHeight: wholeLineHeight(drawn, drawn) }]}
        >
          {word}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Main's `now` tag (SummaryRows' Tag): Tint behind every line, Violet text, 9 at each end.
  tag: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexShrink: 1,
    paddingHorizontal: TAG_ENDS,
    borderRadius: 12,
    backgroundColor: tokens.colorAccentTint,
  },
  word: { color: tokens.colorAccentText },
  waiting: { opacity: 0 },
});
