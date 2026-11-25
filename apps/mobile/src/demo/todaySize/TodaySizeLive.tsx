import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';

import { Glyph } from '../../components/Glyph.tsx';
import { BellButton } from '../../components/TodayCover.tsx';
import { useTodayShell } from '../../components/todayShell.ts';
import { dayChipRoom, liveChipRoom, openRoom } from '../../layout/liveCoverFit.ts';
import { atAccessibilitySizes } from '../../layout/textSize.ts';
import { tokens } from '../../theme/tokens.ts';
import { FitWords } from './FitWords.tsx';
import {
  LIVE_CHIP,
  LIVE_ENDS,
  LIVE_ENDS_AT,
  LIVE_NAME,
  LIVE_OPEN,
  openUnder,
} from './todaySizeRules.ts';

/** sc-92312: the live event's banner on its side, every word whole at the stand-in size; below AX1 it is main's NowBlock, wide. */
export function LiveBanner({ name, scale }: { name: string; scale: number }) {
  const { t } = useTranslation();
  const { open: go } = useTodayShell();
  const [column, setColumn] = useState(0);
  const [nameAt, setNameAt] = useState<number | null>(null);
  const cap = nameAt ?? Infinity;
  const big = atAccessibilitySizes(scale);
  const under = openUnder(scale);
  const label = t('todayScreen.openEvent');

  const open = (
    <Pressable
      onPress={() => go({ to: 'event', id: 'evt-live', name })}
      style={({ pressed }) => [
        styles.open,
        big ? styles.openGrows : styles.openFixed,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID="demo.todaySize.openEvent"
    >
      <FitWords
        text={label}
        size={LIVE_OPEN}
        scale={scale}
        cap={cap}
        room={openRoom(column)}
        weight="semibold"
        line={1.22}
        style={styles.shrink}
      />
      <Glyph name="arrow" ink={tokens.colorInk} />
    </Pressable>
  );
  const words = (
    <View
      style={[styles.grow, styles.words]}
      onLayout={(event: LayoutChangeEvent) => setColumn(event.nativeEvent.layout.width)}
    >
      <View style={styles.chips}>
        <View
          style={[
            styles.chip,
            styles.chipLight,
            big ? styles.chipGrows : [styles.chipFixed, styles.stay],
          ]}
        >
          <View style={styles.liveRing}>
            <View style={styles.liveDot} />
          </View>
          <FitWords
            text={t('todayScreen.liveNow')}
            size={LIVE_CHIP}
            scale={scale}
            cap={cap}
            room={liveChipRoom(column)}
            weight="semibold"
            line={1.22}
            style={styles.shrink}
          />
        </View>
        <View style={[styles.chip, styles.chipDark, big ? styles.chipGrows : styles.chipFixed]}>
          <FitWords
            text={t('todayScreen.dayOfCapital', { day: 1, total: 1 })}
            size={LIVE_CHIP}
            scale={scale}
            cap={cap}
            room={dayChipRoom(column)}
            weight="semibold"
            line={1.22}
            lines={big ? undefined : 1}
            style={[styles.white, styles.shrink]}
          />
        </View>
      </View>
      <FitWords
        text={name}
        size={LIVE_NAME}
        scale={scale}
        cap={Infinity}
        room={column}
        weight="bold"
        line={1.06}
        role="header"
        style={[styles.white, { letterSpacing: LIVE_NAME * -0.02 }]}
        onDrawn={setNameAt}
        testID="demo.todaySize.liveName"
      />
      <FitWords
        text={t('todayScreen.endsToday', { time: LIVE_ENDS_AT })}
        size={LIVE_ENDS}
        scale={scale}
        cap={cap}
        room={column}
        weight="semibold"
        line={1.3}
        style={styles.white}
      />
      {under && <View style={styles.openUnder}>{open}</View>}
    </View>
  );

  return (
    <View style={styles.banner}>
      <View style={styles.bell}>
        <BellButton />
      </View>
      <View style={styles.now}>
        {under ? (
          words
        ) : (
          <View style={styles.wideRow}>
            {words}
            {open}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: tokens.colorInk,
    borderRadius: tokens.space4xl,
    overflow: 'hidden',
    minHeight: 236,
    justifyContent: 'flex-end',
  },
  bell: { position: 'absolute', right: tokens.spaceXxl, top: 18 },
  now: { marginHorizontal: tokens.space4xl, marginBottom: 26, marginTop: 76 },
  wideRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 36 },
  grow: { flex: 1, minWidth: 0 },
  words: { gap: tokens.spacePillEnd },
  white: { color: tokens.colorInkOnDark },
  shrink: { flexShrink: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
  chip: {
    paddingHorizontal: 12,
    borderRadius: tokens.spacePillEnd,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
  },
  chipFixed: { height: tokens.space4xl, flexShrink: 1 },
  chipGrows: {
    minHeight: tokens.space4xl,
    paddingVertical: tokens.spaceXxs,
    maxWidth: '100%',
    flexShrink: 1,
  },
  chipLight: { backgroundColor: tokens.colorCard },
  stay: { flexShrink: 0 },
  chipDark: { backgroundColor: tokens.scrimDialog },
  liveRing: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorBrokenTint,
  },
  liveDot: {
    width: tokens.spaceSm,
    height: tokens.spaceSm,
    borderRadius: tokens.spaceXxs,
    backgroundColor: tokens.colorBroken,
  },
  open: {
    borderRadius: tokens.sizeHitPhoneHero / 2,
    backgroundColor: tokens.colorCard,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spaceSm,
    paddingHorizontal: 22,
  },
  openFixed: { height: tokens.sizeHitPhoneHero },
  openGrows: {
    minHeight: tokens.sizeHitPhoneHero,
    paddingVertical: tokens.spaceSm,
    maxWidth: '100%',
  },
  openUnder: { alignItems: 'flex-start', marginTop: tokens.spaceXs },
  pressed: { opacity: 0.8 },
});
