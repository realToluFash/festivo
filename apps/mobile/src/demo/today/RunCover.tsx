import { useTranslation } from 'react-i18next';
import { Animated, StyleSheet, View } from 'react-native';

import { EventMesh } from '../../components/EventMesh.tsx';
import { Text } from '../../components/Text.tsx';
import {
  BellButton,
  bandBody,
  type CoverLayout,
  coverBody,
  OrgButton,
  SHEET_RISE,
  type Tab,
  TabCapsule,
} from '../../components/TodayCover.tsx';
import { RunNowBlock } from '../../components/TodayRun.tsx';
import { useTodayShell } from '../../components/todayShell.ts';
import { tokens } from '../../theme/tokens.ts';
import { ArrivedFigure } from './ArrivedCover.tsx';
import { RunNowAsOfBlock } from './RunNowAsOf.tsx';
import type { RunMoment } from './runOfShow.ts';

function RunNow({ moment, wide }: { moment: RunMoment; wide: boolean }) {
  const { open: go } = useTodayShell();
  const { now } = moment;

  const aside = moment.figure != null && <ArrivedFigure figure={moment.figure} />;
  const onOpen = () => go({ to: 'event', id: now.event.id, name: now.name });

  return moment.asOf === undefined ? (
    <RunNowBlock now={now} run={moment.run} wide={wide} aside={aside} onOpen={onOpen} />
  ) : (
    <RunNowAsOfBlock
      now={now}
      run={moment.run}
      asOf={moment.asOf}
      wide={wide}
      aside={aside}
      onOpen={onOpen}
    />
  );
}

export function RunCover({
  moment,
  layout,
  top,
  onTab,
  words = 1,
}: {
  moment: RunMoment;
  layout: CoverLayout;
  top: number;
  onTab: (tab: Tab) => void;
  words?: Animated.AnimatedInterpolation<number> | number;
}) {
  if (layout === 'landscape')
    return (
      <View style={[styles.banner, { minHeight: coverBody(moment, layout) }]}>
        <EventMesh event={moment.now.event} shade="day" />
        <View style={styles.bannerBell}>
          <BellButton />
        </View>
        <View style={styles.bannerNow}>
          <RunNow moment={moment} wide />
        </View>
      </View>
    );

  const phone = layout === 'phone';

  return (
    <View style={[styles.cover, { minHeight: top + coverBody(moment, layout) }]}>
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
          <RunNow moment={moment} wide={!phone} />
        </View>
      </Animated.View>
    </View>
  );
}

export function RunBand({
  moment,
  layout,
  top,
  onTab,
}: {
  moment: RunMoment;
  layout: Exclude<CoverLayout, 'landscape'>;
  top: number;
  onTab: (tab: Tab) => void;
}) {
  const { t } = useTranslation();
  const phone = layout === 'phone';

  return (
    <View style={[styles.band, { height: top + bandBody(moment, layout) }]}>
      <EventMesh event={moment.now.event} shade="day" />
      <View style={[phone ? styles.topPhone : styles.topTablet, { marginTop: top }]}>
        <OrgButton compact />
        <View style={styles.grow} />
        <BellButton />
        <View style={phone ? styles.bandTitle : styles.capsuleAt} pointerEvents="box-none">
          {phone ? (
            <Text size={17} weight="semibold" accessibilityRole="header" style={styles.white}>
              {t('todayScreen.today')}
            </Text>
          ) : (
            <TabCapsule onTab={onTab} />
          )}
        </View>
      </View>
      <View style={styles.bandNow}>
        <View style={styles.liveDot} />
        <Text size={13.5} weight="semibold" numberOfLines={1} style={[styles.white, styles.shrink]}>
          {moment.run.band}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  white: { color: tokens.colorInkOnDark },
  capsuleAt: { position: 'absolute', left: 0, right: 0, top: 7, alignItems: 'center' },
  liveDot: {
    width: tokens.spaceSm,
    height: tokens.spaceSm,
    borderRadius: tokens.spaceXxs,
    backgroundColor: tokens.colorBroken,
  },
  cover: { overflow: 'visible', backgroundColor: tokens.colorAccent },
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
  footPhone: { marginHorizontal: tokens.spaceXxl, marginBottom: SHEET_RISE + 22 },
  footTablet: { marginHorizontal: tokens.space5xl, marginBottom: SHEET_RISE + tokens.space4xl },
  banner: { borderRadius: tokens.space4xl, overflow: 'hidden', justifyContent: 'flex-end' },
  bannerBell: { position: 'absolute', right: tokens.spaceXxl, top: 18 },
  bannerNow: { marginHorizontal: tokens.space4xl, marginBottom: 26, marginTop: 76 },
  band: { overflow: 'hidden' },
  bandTitle: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  bandNow: {
    position: 'absolute',
    left: tokens.spaceXl,
    right: tokens.spaceXl,
    bottom: tokens.spaceLg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spaceXs,
  },
});
