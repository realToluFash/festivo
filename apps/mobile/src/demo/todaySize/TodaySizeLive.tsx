import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type LayoutChangeEvent,
  Pressable,
  type StyleProp,
  StyleSheet,
  type TextStyle,
  View,
} from 'react-native';

import { Glyph } from '../../components/Glyph.tsx';
import { Text } from '../../components/Text.tsx';
import { EventMesh } from '../../components/EventMesh.tsx';
import { BellButton } from '../../components/TodayCover.tsx';
import { useTodayShell } from '../../components/todayShell.ts';
import { meshFor } from '../../kit/today.ts';
import { dayChipRoom, liveChipRoom, openRoom } from '../../layout/liveCoverFit.ts';
import { atAccessibilitySizes, dotKept } from '../../layout/textSize.ts';
import { tokens } from '../../theme/tokens.ts';
import { FitWords } from './FitWords.tsx';
import { SizeFigure } from './TodaySizeArrived.tsx';
import {
  LIVE_CHIP,
  LIVE_ENDS,
  LIVE_ENDS_AT,
  LIVE_NAME,
  LIVE_NAME_PHONE,
  LIVE_OPEN,
  type ArrivedCount,
  openUnder,
  uprightChipSize,
} from './todaySizeRules.ts';

/** sc-92312: the live event's banner on its side, every word whole at the stand-in size; below AX1 it is main's NowBlock, wide. With `top`, the upright cover under that row: from AX1 its chips keep main's size and grow to hold their words (sc-93211), and the name, the end line and Open the event take the cover's width by the same rule as on its side (sc-93578). With `phone`, the phone's cover under its pill row: main's NowBlock, narrow, its chips growing by the same rule from AX1 (sc-93855). */
export function LiveBanner({
  name,
  place,
  scale,
  top,
  arrived = null,
  phone = false,
}: {
  name: string;
  place: string | null;
  scale: number;
  top?: ReactNode;
  /** Guests arrived, drawn as the figure on the iPad: from AX1 under Open the event, so the first arrival moves nothing above it (sc-94022). */
  arrived?: ArrivedCount | null;
  phone?: boolean;
}) {
  const { t } = useTranslation();
  const { open: go } = useTodayShell();
  const [column, setColumn] = useState(0);
  const [nameAt, setNameAt] = useState<number | null>(null);
  const cap = nameAt ?? Infinity;
  const big = atAccessibilitySizes(scale);
  const under = openUnder(scale) || phone;
  const label = t('todayScreen.openEvent');
  const upright = top != null && !phone;
  const grown = (upright || phone) && big;
  const nameSize = phone ? LIVE_NAME_PHONE : LIVE_NAME;
  const dayLine = t('todayScreen.dayOfCapital', { day: 1, total: 1 });
  const day = place == null ? dayLine : t('todayScreen.dayAndPlace', { day: dayLine, place });

  const open = (
    <Pressable
      onPress={() => go({ to: 'event', id: 'evt-live', name })}
      style={({ pressed }) => [
        styles.open,
        big ? styles.openGrows : styles.openFixed,
        phone && styles.openPhone,
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
      style={[styles.grow, phone ? styles.wordsPhone : styles.words]}
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
          {grown ? (
            <GrownWords
              text={t('todayScreen.liveNow')}
              scale={scale}
              testID="demo.todaySize.liveChip"
            />
          ) : (
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
          )}
        </View>
        <View style={[styles.chip, styles.chipDark, big ? styles.chipGrows : styles.chipFixed]}>
          {grown ? (
            <GrownWords
              text={dotKept(day)}
              scale={scale}
              style={styles.white}
              testID="demo.todaySize.dayChip"
            />
          ) : (
            <FitWords
              text={dotKept(day)}
              size={LIVE_CHIP}
              scale={scale}
              cap={cap}
              room={dayChipRoom(column)}
              weight="semibold"
              line={1.22}
              lines={big ? undefined : 1}
              style={[styles.white, styles.shrink]}
            />
          )}
        </View>
      </View>
      <FitWords
        text={name}
        size={nameSize}
        scale={scale}
        cap={Infinity}
        room={column}
        weight="bold"
        line={1.06}
        role="header"
        style={[styles.white, { letterSpacing: nameSize * -0.02 }]}
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
      {phone && <View style={styles.hair} />}
      {under && <View style={phone ? styles.openFlush : styles.openUnder}>{open}</View>}
      {under && !phone && arrived != null && (
        <View style={styles.figureUnder}>
          <SizeFigure count={arrived} scale={scale} cap={cap} column={column} />
        </View>
      )}
    </View>
  );

  const block = under ? (
    words
  ) : (
    <View style={styles.wideRow}>
      {words}
      {arrived == null ? (
        open
      ) : (
        <View style={styles.right}>
          <SizeFigure count={arrived} scale={scale} cap={cap} column={RIGHT_COLUMN} />
          {open}
        </View>
      )}
    </View>
  );

  if (phone)
    return (
      <View style={styles.phone} testID="demo.todaySize.livePhone">
        <EventMesh event={{ mesh: meshFor('evt-live'), photo: null }} shade="day" />
        <View style={styles.phoneTop}>{top}</View>
        <View style={styles.grow} />
        <View style={styles.phoneNow}>{block}</View>
      </View>
    );

  if (upright)
    return (
      <View style={styles.upright} testID="demo.todaySize.liveUpright">
        <EventMesh event={{ mesh: meshFor('evt-live'), photo: null }} shade="day" />
        <View style={styles.uprightTop}>{top}</View>
        <View style={styles.grow} />
        <View style={styles.uprightNow}>{block}</View>
      </View>
    );

  return (
    <View style={styles.banner}>
      <EventMesh event={{ mesh: meshFor('evt-live'), photo: null }} shade="day" />
      <View style={styles.bell}>
        <BellButton />
      </View>
      <View style={styles.now}>{block}</View>
    </View>
  );
}

/** A chip's words upright from AX1: main's 13 at the stand-in size, wrapping only between words, and never stepped down (sc-93211). */
function GrownWords({
  text,
  scale,
  style,
  testID,
}: {
  text: string;
  scale: number;
  style?: StyleProp<TextStyle>;
  testID: string;
}) {
  const size = uprightChipSize(scale);

  return (
    <Text
      key={size}
      size={size}
      weight="semibold"
      allowFontScaling={false}
      style={[{ lineHeight: Math.ceil(size * 1.22) }, style, styles.shrink]}
      testID={testID}
    >
      {text}
    </Text>
  );
}

/** Main's column at the cover's right below AX1, the figure over Open the event (sc-29978). */
const RIGHT_COLUMN = 340;

const styles = StyleSheet.create({
  banner: {
    borderRadius: tokens.space4xl,
    overflow: 'hidden',
    minHeight: 236,
    justifyContent: 'flex-end',
  },
  upright: { overflow: 'hidden', minHeight: 410, paddingTop: tokens.space6xl },
  uprightTop: { marginTop: -tokens.space4xl, marginBottom: tokens.space4xl },
  uprightNow: {
    marginHorizontal: tokens.space4xl,
    marginBottom: tokens.space4xl,
    marginTop: tokens.spaceXl,
  },
  phone: { overflow: 'hidden', minHeight: 376, paddingTop: tokens.space6xl },
  phoneTop: {
    marginTop: -tokens.space4xl,
    marginBottom: tokens.space4xl,
    marginHorizontal: tokens.spaceXxl,
  },
  phoneNow: {
    marginHorizontal: tokens.spaceXxl,
    marginBottom: tokens.space4xl,
    marginTop: tokens.spaceXl,
  },
  hair: { height: tokens.spaceHair },
  openPhone: { alignSelf: 'stretch' },
  bell: { position: 'absolute', right: tokens.spaceXxl, top: 18 },
  now: { marginHorizontal: tokens.space4xl, marginBottom: 26, marginTop: 76 },
  wideRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 36 },
  grow: { flex: 1, minWidth: 0 },
  words: { gap: tokens.spacePillEnd },
  wordsPhone: { gap: tokens.spaceXl },
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
  figureUnder: { marginTop: tokens.spaceXs },
  right: { width: RIGHT_COLUMN, gap: 18 },
  openFlush: { alignItems: 'flex-start' },
  pressed: { opacity: 0.8 },
});
