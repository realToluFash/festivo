import { fallsOnEarlierDay, formatDay, formatTimeOfDay, nextMidnight } from '@soirely/domain';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';

import { dateLocale } from '../i18n/index.ts';
import { useLayout } from '../layout/useLayout.ts';
import { type Stale } from '../offline.ts';
import { tokens } from '../theme/tokens.ts';
import { readOut } from './ReadOut.tsx';
import { Text } from './Text.tsx';

/** Under the header, across the whole column; announced as it appears and after an unanswered Try again (sc-22586). */
export function OfflineBand({ stale }: { stale: Stale | null }) {
  const { t } = useTranslation();
  const { kind } = useLayout();
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

  useEffect(() => (showing ? readOut(wordsNow.current) : undefined), [showing, unanswered]);

  if (stale == null) return null;

  return (
    <View
      style={[styles.band, kind === 'phone' ? styles.phone : styles.tablet]}
      testID="offline.band"
    >
      <View style={styles.words}>
        <Svg
          width={18}
          height={18}
          viewBox="0 0 16 16"
          fill="none"
          stroke={tokens.colorAttentionText}
          strokeWidth={1.5}
          strokeLinecap="round"
          style={styles.mark}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Path d="M1.5 6a9.5 9.5 0 0 1 13 0M3.8 8.6a6.2 6.2 0 0 1 8.4 0M6.1 11.1a2.9 2.9 0 0 1 3.8 0" />
          <Path d="M2 2l12 12" />
        </Svg>
        <Text size={15} weight="semibold" style={styles.ink}>
          {words}
        </Text>
      </View>
      <Pressable
        style={styles.retry}
        onPress={stale.retry}
        accessibilityRole="button"
        testID="offline.retry"
      >
        <Text size={tokens.typeButton.size} weight="semibold" style={styles.ink}>
          {t('eventsScreen.retry')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spaceMd,
    minHeight: tokens.sizeHitPhonePrimary,
    paddingVertical: 13,
    backgroundColor: tokens.colorAttentionTint,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colorAttentionBorder,
  },
  phone: { paddingHorizontal: tokens.spaceXl },
  tablet: { paddingHorizontal: tokens.space3xl },
  words: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceMd, flexShrink: 1 },
  mark: { marginTop: 1 },
  ink: { color: tokens.colorAttentionText, flexShrink: 1 },
  retry: {
    minHeight: tokens.sizeHit,
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceXl,
    borderWidth: 1,
    borderColor: tokens.colorAttentionText,
    borderRadius: tokens.radiusPill,
  },
});
