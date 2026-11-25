import { useContext, useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { TitleCap } from '../../components/Text.tsx';
import { CappedWholeWords, useMeasuredAt } from '../../components/Title.tsx';
import { lineStart, piecesIn } from '../../layout/textSize.ts';
import { tokens } from '../../theme/tokens.ts';

const TAG_SIZE = 12.5;
const TAG_ENDS = 9;

/** sc-90472: whether main's tag, on the row this sits in, would break a word: its widest word, at the size main draws it, wider than its line. */
export function TagLineCheck({
  word,
  onBreaks,
}: {
  word: string;
  onBreaks: (breaks: boolean) => void;
}) {
  const { fontScale } = useWindowDimensions();
  const cap = useContext(TitleCap);
  const { widths, measure } = useMeasuredAt(
    lineStart(TAG_SIZE, fontScale, cap ?? Infinity, Infinity),
    piecesIn([word]),
  );
  const [line, setLine] = useState(0);
  const measured = widths.every((width) => width != null);
  const breaks =
    !measured || line === 0 ? null : Math.max(...(widths as number[])) > line - 2 * TAG_ENDS;

  useEffect(() => {
    if (breaks != null) onBreaks(breaks);
  }, [breaks, onBreaks]);

  return (
    <View
      style={styles.check}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(event) => setLine(event.nativeEvent.layout.width)}
    >
      {measure}
    </View>
  );
}

/** sc-90472: a row's Outside tag at the accessibility sizes when a word of it is wider than its line: under the name, every word whole, stepping down by the house rule, never under 12.5. */
export function WholeWordsTag({ word }: { word: string }) {
  const [line, setLine] = useState(0);

  return (
    <View style={styles.line} onLayout={(event) => setLine(event.nativeEvent.layout.width)}>
      <View style={styles.tag}>
        <CappedWholeWords
          size={TAG_SIZE}
          weight="semibold"
          room={Math.max(0, line - 2 * TAG_ENDS)}
          breakAfterHyphens
          accessible={false}
          style={styles.word}
        >
          {word}
        </CappedWholeWords>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Across the row's words column and out of its flow, so it adds no gap and no height.
  check: { position: 'absolute', left: 0, right: 0, top: 0, height: 0 },
  // 4 under the name, as main's wrapped tag sits in its title row (`rowGap: 4`); the column's own gap is 3.
  line: { marginTop: 1 },
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
});
