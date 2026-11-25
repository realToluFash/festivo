import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from './Text.tsx';
import { MeasuredWords } from './Title.tsx';
import {
  LIVE_DOT,
  LIVE_DOT_GAP,
  LIVE_FOOT,
  LIVE_GAP,
  LIVE_LINE,
  LIVE_SIDES,
  liveLine,
  liveLineHeight,
  liveRoom,
} from '../layout/bandLive.ts';
import { wordsIn } from '../layout/textSize.ts';
import { tokens } from '../theme/tokens.ts';

/** The upright iPad band's live line at the accessibility sizes: under the tabs, wrapping between words, stepped down only as far as its widest word needs (sc-92315). */
export function BandLiveLine({
  scale,
  said,
  width,
  testID,
}: {
  scale: number;
  said: string;
  width: number | undefined;
  testID?: string;
}) {
  const start = LIVE_LINE * scale;
  const [widths, setWidths] = useState<Readonly<Record<string, number>>>({});
  const words = wordsIn([said]);
  const key = (word: string) => `${start}|${word}`;
  const measured = words.map((word) => widths[key(word)]);
  const widest = measured.every((wide) => wide != null) ? Math.max(...measured.map(Number)) : null;
  const fitted = widest == null || width == null ? null : liveLine(scale, widest, liveRoom(width));
  const size = fitted ?? start;
  const line = liveLineHeight(size);

  return (
    <View style={styles.line}>
      <MeasuredWords
        words={words}
        size={start}
        weight="semibold"
        allowFontScaling={false}
        onWidth={(word, wide) =>
          setWidths((now) => (now[key(word)] === wide ? now : { ...now, [key(word)]: wide }))
        }
      />
      <View style={[styles.dot, { marginTop: (line - LIVE_DOT) / 2 }]} />
      <Text
        key={size}
        size={size}
        weight="semibold"
        allowFontScaling={false}
        style={[styles.words, { lineHeight: line }, fitted == null && styles.waiting]}
        testID={testID}
      >
        {said}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    alignSelf: 'center',
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: LIVE_DOT_GAP,
    marginTop: LIVE_GAP,
    marginBottom: LIVE_FOOT,
    paddingHorizontal: LIVE_SIDES,
  },
  dot: {
    width: LIVE_DOT,
    height: LIVE_DOT,
    borderRadius: tokens.spaceXxs,
    backgroundColor: tokens.colorBroken,
  },
  words: { color: tokens.colorInkOnDark, flexShrink: 1 },
  waiting: { opacity: 0 },
});
