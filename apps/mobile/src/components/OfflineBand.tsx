import { fallsOnEarlierDay, formatDay, formatTimeOfDay, nextMidnight } from '@soirely/domain';
import { useEffect, useRef, useState } from 'react';
import {
  PixelRatio,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';

import { dateLocale } from '../i18n/index.ts';
import {
  BAND_GAP,
  BAND_MARK,
  BAND_MARK_GAP,
  BAND_PILL_EDGE,
  BAND_PILL_PADDING,
  TITLE_LINE,
  bandPlace,
  drawnLine,
  paddingToCentre,
  wordsIn,
} from '../layout/textSize.ts';
import { useLayout } from '../layout/useLayout.ts';
import { type Stale } from '../offline.ts';
import { bandReadOut } from '../offlineLoad.ts';
import { tokens } from '../theme/tokens.ts';
import { readOut } from './ReadOut.tsx';
import { Text } from './Text.tsx';
import { MeasuredWords } from './Title.tsx';
import { rereadOrganisations } from '../signedIn.ts';

const WORDS_SIZE = 15;

/** Under the header, across the whole column; announced as it appears and after an unanswered Try again (sc-22586), only from the screen in front (sc-27086). */
export function OfflineBand({ stale, inFront }: { stale: Stale | null; inFront: boolean }) {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const { fontScale } = useWindowDimensions();
  const [now, setNow] = useState(() => new Date());
  const at = stale?.at ?? null;
  const unanswered = stale?.unanswered ?? 0;
  const showing = stale != null;

  useEffect(() => {
    if (at == null) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const turn = () => {
      setNow(new Date());
      timer = setTimeout(turn, nextMidnight().getTime() - Date.now());
    };
    turn();

    return () => clearTimeout(timer);
  }, [at]);

  const words =
    at == null
      ? ''
      : fallsOnEarlierDay(at, now)
        ? t('offline.asOfDay', {
            day: formatDay(at, dateLocale()),
            time: formatTimeOfDay(at, dateLocale()),
          })
        : t('offline.asOf', { time: formatTimeOfDay(at, dateLocale()) });
  const wordsNow = useRef(words);

  useEffect(() => {
    wordsNow.current = words;
  });

  const said = useRef<number | null>(null);

  useEffect(() => {
    const next = bandReadOut(said.current, { showing, unanswered, inFront });
    said.current = next.said;

    return next.speaks ? readOut(wordsNow.current) : undefined;
  }, [showing, unanswered, inFront]);

  const tryAgain = t('eventsScreen.retry');
  const [band, setBand] = useState<number | null>(null);
  // The phone may turn while the band is gone, so a width from before says nothing of where it comes back.
  if (!showing && band != null) setBand(null);
  const [wordWidths, setWordWidths] = useState<Readonly<Record<string, number>>>({});
  const [tryAgainWidths, setTryAgainWidths] = useState<Readonly<Record<string, number>>>({});
  const scaled = (text: string) => `${fontScale}|${text}`;
  const wordsToFit = wordsIn([words]);
  const widths = wordsToFit.flatMap((word) => wordWidths[scaled(word)] ?? []);
  const tryAgainWidth = tryAgainWidths[scaled(tryAgain)];
  const measuredNow =
    at != null && band != null && tryAgainWidth != null && widths.length === wordsToFit.length
      ? {
          words,
          tryAgain,
          ...bandPlace({
            widestWord: Math.max(...widths),
            tryAgain: tryAgainWidth,
            band,
            sidePadding: kind === 'phone' ? tokens.spaceXl : tokens.space3xl,
          }),
        }
      : null;
  const [lastPlaced, setLastPlaced] = useState(measuredNow);
  // New words wait for their measure with the last words still drawn, so the words and their place change in one commit.
  const placed = at == null ? null : (measuredNow ?? lastPlaced);
  if (JSON.stringify(placed) !== JSON.stringify(lastPlaced)) setLastPlaced(placed);

  if (stale == null) return null;

  const line = drawnLine(
    TITLE_LINE,
    fontScale,
    Platform.OS === 'android' ? PixelRatio.get() : null,
  );

  return (
    <View onLayout={(event) => setBand(event.nativeEvent.layout.width)}>
      <MeasuredWords
        words={wordsToFit}
        size={WORDS_SIZE}
        weight="semibold"
        onWidth={(word, width) => {
          setWordWidths((current) => ({ ...current, [scaled(word)]: width }));
        }}
      />
      <MeasuredWords
        words={[tryAgain]}
        size={tokens.typeButton.size}
        weight="semibold"
        onWidth={(word, width) => {
          setTryAgainWidths((current) => ({ ...current, [scaled(word)]: width }));
        }}
      />
      {placed != null && (
        <View
          style={[
            styles.band,
            kind === 'phone' ? styles.phone : styles.tablet,
            !placed.beside && styles.bandUnder,
          ]}
          testID="offline.band"
        >
          <View
            style={[
              styles.words,
              placed.beside
                ? { paddingVertical: paddingToCentre(tokens.sizeHitPhonePrimary, line) }
                : styles.wordsUnder,
            ]}
          >
            <Svg
              width={BAND_MARK}
              height={BAND_MARK}
              viewBox="0 0 16 16"
              fill="none"
              stroke={tokens.colorAttentionText}
              strokeWidth={1.5}
              strokeLinecap="round"
              style={{ marginVertical: (line - BAND_MARK) / 2 }}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Path d="M1.5 6a9.5 9.5 0 0 1 13 0M3.8 8.6a6.2 6.2 0 0 1 8.4 0M6.1 11.1a2.9 2.9 0 0 1 3.8 0" />
              <Path d="M2 2l12 12" />
            </Svg>
            <Text size={WORDS_SIZE} weight="semibold" style={[styles.ink, styles.wordsLine]}>
              {placed.words}
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.retry,
              !placed.beside && styles.retryUnder,
              placed.pillWraps && styles.retryWrapped,
              pressed && styles.retryPressed,
            ]}
            onPress={() => {
              void rereadOrganisations();
              stale.retry();
            }}
            accessibilityRole="button"
            testID="offline.retry"
          >
            <Text
              size={tokens.typeButton.size}
              weight="semibold"
              numberOfLines={placed.pillWraps ? 0 : 1}
              style={[styles.ink, placed.pillWraps && styles.retryWordsWrapped]}
            >
              {placed.tryAgain}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: BAND_GAP,
    minHeight: tokens.sizeHitPhonePrimary,
    paddingVertical: tokens.spaceXxs,
    backgroundColor: tokens.colorAttentionTint,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colorAttentionBorder,
  },
  bandUnder: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
    gap: tokens.spaceMd,
    paddingVertical: tokens.spaceLg,
  },
  phone: { paddingHorizontal: tokens.spaceXl },
  tablet: { paddingHorizontal: tokens.space3xl },
  // Beside, its first line sits level with Try again's middle; the words wrap, the button stays at the end of that line.
  words: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: BAND_MARK_GAP,
    flexShrink: 1,
  },
  wordsUnder: { alignSelf: 'stretch' },
  wordsLine: { lineHeight: TITLE_LINE },
  ink: { color: tokens.colorAttentionText, flexShrink: 1 },
  retry: {
    flexShrink: 0,
    minHeight: tokens.sizeHitPhonePrimary,
    justifyContent: 'center',
    paddingHorizontal: BAND_PILL_PADDING,
    backgroundColor: tokens.colorCard,
    borderWidth: BAND_PILL_EDGE,
    borderColor: tokens.colorAttentionText,
    borderRadius: tokens.radiusPill,
  },
  retryUnder: { maxWidth: '100%' },
  retryWrapped: { alignSelf: 'stretch', paddingVertical: tokens.spaceSm },
  retryWordsWrapped: { textAlign: 'center' },
  retryPressed: { backgroundColor: tokens.colorInset },
});
