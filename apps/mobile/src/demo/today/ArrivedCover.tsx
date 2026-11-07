import { useTranslation } from 'react-i18next';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { EventMesh } from '../../components/EventMesh.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { Text } from '../../components/Text.tsx';
import {
  BellButton,
  type CoverLayout,
  coverBody,
  OrgButton,
  SHEET_RISE,
  type Tab,
  TabCapsule,
} from '../../components/TodayCover.tsx';
import { useTodayShell } from '../../components/todayShell.ts';
import type { Now } from '../../kit/today.ts';
import { tokens } from '../../theme/tokens.ts';
import type { ArrivedMoment, Figure } from './arrived.ts';

export function WhiteButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.whiteButton, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text size={16} weight="semibold" accessible={false}>
        {label}
      </Text>
      <Glyph name="arrow" ink={tokens.colorInk} />
    </Pressable>
  );
}

export function Chips({ now }: { now: Now }) {
  const { t } = useTranslation();

  return (
    <View style={styles.chips}>
      <View style={[styles.chip, styles.chipLight]}>
        <View style={styles.liveRing}>
          <View style={styles.liveDot} />
        </View>
        <Text size={13} weight="semibold">
          {t('todayScreen.liveNow')}
        </Text>
      </View>
      <View style={[styles.chip, styles.chipDark]}>
        <Text size={13} weight="semibold" style={styles.white} numberOfLines={1}>
          {now.live}
        </Text>
      </View>
    </View>
  );
}

function Ring({ share, side = 44, line = 4 }: { share: number; side?: number; line?: number }) {
  const r = (side - line) / 2;
  const round = 2 * Math.PI * r;

  return (
    <Svg
      width={side}
      height={side}
      style={styles.ring}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Circle
        cx={side / 2}
        cy={side / 2}
        r={r}
        fill="none"
        stroke={tokens.colorInkOnDark}
        strokeOpacity={0.18}
        strokeWidth={line}
      />
      <Circle
        cx={side / 2}
        cy={side / 2}
        r={r}
        fill="none"
        stroke={tokens.colorInkOnDark}
        strokeWidth={line}
        strokeLinecap="round"
        strokeDasharray={`${round * share} ${round}`}
      />
    </Svg>
  );
}

/** The figure as the full Now draws it beside Next, read as its words; with nobody Coming, no ring and no "of". */
export function ArrivedFigure({ figure }: { figure: Figure }) {
  const { t } = useTranslation();

  return (
    <View style={styles.arrived} accessible accessibilityLabel={figure.spoken}>
      {figure.share != null && <Ring share={figure.share} />}
      <View style={styles.shrink}>
        <View style={styles.figureLine}>
          <Text size={18} weight="bold" accessible={false} style={[styles.white, styles.figures]}>
            {figure.count}
          </Text>
          {figure.of != null && (
            <Text
              size={18}
              weight="semibold"
              accessible={false}
              style={[styles.white, styles.figures, styles.soft, styles.tight]}
            >
              {`/${figure.of}`}
            </Text>
          )}
        </View>
        <Text size={12.5} weight="medium" accessible={false} style={[styles.white, styles.soft]}>
          {t('todayScreen.arrivedCount')}
        </Text>
      </View>
    </View>
  );
}

/** sc-29090's Now without Next, with the arrived figure: its own row on a phone, on the right with Open the event on a tablet. */
export function ArrivedNowBlock({ moment, wide }: { moment: ArrivedMoment; wide: boolean }) {
  const { t } = useTranslation();
  const { open: go } = useTodayShell();
  const { now, figure } = moment;

  if (now == null) return null;

  const size = wide ? 48 : 36;
  const words = (
    <>
      <Chips now={now} />
      <Text
        size={size}
        weight="bold"
        accessibilityRole="header"
        style={[styles.white, { letterSpacing: size * -0.02, lineHeight: size * 1.06 }]}
      >
        {now.name}
      </Text>
      <Text size={16} weight="semibold" style={styles.white}>
        {now.ends}
      </Text>
    </>
  );
  const open = (
    <WhiteButton
      label={t('todayScreen.openEvent')}
      onPress={() => go({ to: 'event', id: now.event.id, name: now.name })}
    />
  );

  return wide ? (
    <View style={styles.wideRow}>
      <View style={[styles.grow, styles.gapMd]}>{words}</View>
      {figure == null ? (
        open
      ) : (
        <View style={styles.right}>
          <ArrivedFigure figure={figure} />
          {open}
        </View>
      )}
    </View>
  ) : (
    <View style={styles.gapLg}>
      {words}
      {figure != null && <ArrivedFigure figure={figure} />}
      <View style={styles.hair} />
      {open}
    </View>
  );
}

/** The product's TodayCover on the event day, with ArrivedNowBlock for its Now. */
export function ArrivedCover({
  moment,
  layout,
  top,
  onTab,
  words = 1,
}: {
  moment: ArrivedMoment;
  layout: CoverLayout;
  top: number;
  onTab: (tab: Tab) => void;
  words?: Animated.AnimatedInterpolation<number> | number;
}) {
  const body = coverBody({ ...moment, full: false }, layout);

  if (moment.now == null) return null;

  if (layout === 'landscape')
    return (
      <View style={[styles.banner, { minHeight: body }]}>
        <EventMesh event={moment.now.event} shade="day" />
        <View style={styles.bannerBell}>
          <BellButton />
        </View>
        <View style={styles.bannerNow}>
          <ArrivedNowBlock moment={moment} wide />
        </View>
      </View>
    );

  const phone = layout === 'phone';

  return (
    <View style={[styles.cover, { minHeight: top + body }]}>
      <View style={styles.overscroll} />
      <EventMesh event={moment.now.event} shade="day" />
      <Animated.View style={[styles.coverWords, { opacity: words }]}>
        <View style={[phone ? styles.topPhone : styles.topTablet, { marginTop: top }]}>
          <OrgButton />
          <View style={styles.grow} />
          <BellButton />
          {!phone && (
            <View style={styles.capsuleAt} pointerEvents="box-none">
              <TabCapsule onTab={onTab} />
            </View>
          )}
        </View>
        <View style={[styles.grow, { minHeight: tokens.spaceXl }]} />
        <View style={phone ? styles.footPhone : styles.footTablet}>
          <ArrivedNowBlock moment={moment} wide={!phone} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  white: { color: tokens.colorInkOnDark },
  soft: { opacity: 0.84 },
  figures: { fontVariant: ['tabular-nums'] },
  tight: { marginLeft: 1 },
  pressed: { opacity: 0.8 },
  hair: { height: tokens.spaceHair },
  gapMd: { gap: tokens.spacePillEnd },
  gapLg: { gap: tokens.spaceXl },
  whiteButton: {
    height: tokens.sizeHitPhoneHero,
    borderRadius: tokens.sizeHitPhoneHero / 2,
    backgroundColor: tokens.colorCard,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spaceSm,
    paddingHorizontal: 22,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
  chip: {
    height: tokens.space4xl,
    paddingHorizontal: 12,
    borderRadius: tokens.spacePillEnd,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    flexShrink: 1,
  },
  chipLight: { backgroundColor: tokens.colorCard, flexShrink: 0 },
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
  ring: { transform: [{ rotate: '-90deg' }] },
  arrived: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceMd },
  figureLine: { flexDirection: 'row', alignItems: 'baseline' },
  wideRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 36 },
  right: { width: 340, gap: 18 },
  cover: { overflow: 'visible', backgroundColor: tokens.optionRose },
  coverWords: { flexGrow: 1 },
  overscroll: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '100%',
    height: 800,
    backgroundColor: tokens.optionRose,
  },
  topPhone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingTop: tokens.spaceXxs,
    paddingHorizontal: tokens.spaceXl,
  },
  topTablet: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: tokens.spaceMd,
    paddingHorizontal: tokens.space3xl,
  },
  capsuleAt: { position: 'absolute', left: 0, right: 0, top: 7, alignItems: 'center' },
  footPhone: { marginHorizontal: tokens.spaceXxl, marginBottom: SHEET_RISE + 22 },
  footTablet: { marginHorizontal: tokens.space5xl, marginBottom: SHEET_RISE + tokens.space4xl },
  banner: { borderRadius: tokens.space4xl, overflow: 'hidden' },
  bannerBell: { position: 'absolute', right: tokens.spaceXxl, top: 18 },
  bannerNow: { position: 'absolute', left: tokens.space4xl, right: tokens.space4xl, bottom: 26 },
});
