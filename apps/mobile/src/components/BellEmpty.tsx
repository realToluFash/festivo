import { useEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';

import { atAccessibilitySizes, piecesIn } from '../layout/textSize.ts';
import { tokens } from '../theme/tokens.ts';
import {
  bellStart,
  EMPTY_GAP,
  EMPTY_SENTENCE,
  EMPTY_TILE,
  emptySentenceSize,
  emptyTileAbove,
  SETTINGS_LINK,
  settingsSize,
} from './bellTop.ts';
import { Glyph } from './Glyph.tsx';
import { TextAction } from './SummaryRows.tsx';
import { Text } from './Text.tsx';
import { MeasuredWords } from './Title.tsx';

/** The widest piece of `text` at `start`, measured hidden; null until every piece has been laid out. */
function useWidest(text: string, start: number, weight: 'regular' | 'semibold') {
  const pieces = piecesIn([text]);
  const key = `${start}|${text}`;
  const [measured, setMeasured] = useState<{ key: string; widths: Record<string, number> }>({
    key: '',
    widths: {},
  });
  const widths = measured.key === key ? measured.widths : {};
  const widest = pieces.every((piece) => widths[piece] != null)
    ? Math.max(...pieces.map((piece) => widths[piece] ?? 0))
    : null;
  const measure = (
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
  );

  return { widest, measure };
}

/** The bell's empty line: main's below AX1; from AX1 its words break only between words at one size, stepped down only for its widest word, the tile above it where that word cannot fit beside it (sc-94028). */
export function BellEmptyLine({ onDrawn }: { onDrawn?: (drawn: string) => void }) {
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const sentence = t('notifications.empty');
  const start = bellStart(EMPTY_SENTENCE, fontScale);
  const { widest, measure } = useWidest(sentence, start, 'regular');
  const [room, setRoom] = useState(0);
  const fitted = atAccessibilitySizes(fontScale);
  const ready = fitted && widest != null && room > 0;
  const above = ready && emptyTileAbove(fontScale, widest, room);
  const drawn = ready ? emptySentenceSize(fontScale, widest, room) : start;
  const report = ready
    ? `The sentence draws at ${tenths(drawn)}, its tile ${above ? 'above it' : 'beside it'}.`
    : null;

  useEffect(() => {
    if (report != null) onDrawn?.(report);
  }, [report, onDrawn]);

  return (
    <View
      style={[styles.empty, above && styles.emptyAbove, fitted && !ready && styles.waiting]}
      onLayout={(event) => setRoom(Math.floor(event.nativeEvent.layout.width))}
    >
      {fitted && measure}
      <View
        style={styles.tile}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Glyph name="bell" size={20} ink={tokens.colorInkSecondary} />
      </View>
      {fitted ? (
        <Text
          // A new size mounts a new Text, so iOS never draws one size in the box laid out for another (sc-69816).
          key={drawn}
          size={drawn}
          allowFontScaling={false}
          style={[!above && styles.grow, styles.secondary]}
        >
          {sentence}
        </Text>
      ) : (
        <Text size={EMPTY_SENTENCE} style={[styles.grow, styles.secondary]}>
          {sentence}
        </Text>
      )}
    </View>
  );
}

/** Notification settings at the foot: main's below AX1; from AX1 its words break only between words, stepped down only for its widest word (sc-94028). */
export function BellSettingsLink({
  onPress,
  testID,
  onDrawn,
}: {
  onPress: () => void;
  testID: string;
  onDrawn?: (drawn: string) => void;
}) {
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const label = t('notifications.settings');
  const start = bellStart(SETTINGS_LINK, fontScale);
  const { widest, measure } = useWidest(label, start, 'semibold');
  const [room, setRoom] = useState(0);
  const fitted = atAccessibilitySizes(fontScale);
  const ready = fitted && widest != null && room > 0;
  const drawn = ready ? settingsSize(fontScale, widest, room) : start;
  const report = ready ? `Notification settings draws at ${tenths(drawn)}.` : null;

  useEffect(() => {
    if (report != null) onDrawn?.(report);
  }, [report, onDrawn]);

  if (!fitted) return <TextAction label={label} onPress={onPress} testID={testID} />;

  return (
    <View
      style={!ready && styles.waiting}
      onLayout={(event) => setRoom(Math.floor(event.nativeEvent.layout.width))}
    >
      {measure}
      <TextAction
        // A new size mounts a new label, so iOS never draws one size in the box laid out for another (sc-69816).
        key={drawn}
        label={label}
        wraps
        drawnAt={drawn}
        onPress={onPress}
        testID={testID}
      />
    </View>
  );
}

function tenths(size: number): string {
  return String(Math.round(size * 10) / 10);
}

const styles = StyleSheet.create({
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: EMPTY_GAP,
    paddingVertical: tokens.spaceLg,
  },
  emptyAbove: { flexDirection: 'column', alignItems: 'flex-start' },
  tile: {
    width: EMPTY_TILE,
    height: EMPTY_TILE,
    borderRadius: tokens.spaceLg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorInset,
  },
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  waiting: { opacity: 0 },
});
