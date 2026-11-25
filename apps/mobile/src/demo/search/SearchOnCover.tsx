import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Cover } from '../../components/Cover.tsx';
import { EventMesh } from '../../components/EventMesh.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { Text } from '../../components/Text.tsx';
import { useCapsuleLabels } from '../../components/CapsuleLabels.tsx';
import {
  BellButton,
  Glass,
  OrgButton,
  TABS,
  TabCapsule,
  type Tab,
} from '../../components/TodayCover.tsx';
import type { Tell } from '../../components/TodayParts.tsx';
import { Toast } from '../../components/Toast.tsx';
import { TodayShellProvider } from '../../components/todayShell.ts';
import { useLayout } from '../../layout/useLayout.ts';
import { tokens } from '../../theme/tokens.ts';
import { demoShell } from '../demoShell.ts';
import { OrgSwitcherProvider } from '../OrgSwitcher.tsx';
import { EVENTS } from '../today.ts';
import { openSearch } from './SearchHeader.tsx';
import { SEARCH_WORDS as W } from './searchRules.ts';

/** Search in glass, the bell's twin: drawn 40, tapped 48, left of the bell. */
export function GlassSearchButton() {
  return (
    <Pressable
      onPress={() => openSearch()}
      accessibilityRole="button"
      accessibilityLabel={W.search}
      hitSlop={tokens.spaceXxs}
      testID="demo.search.open"
    >
      <Glass style={styles.round}>
        <Glyph name="search" size={19} ink={tokens.colorInkOnDark} />
      </Glass>
    </Pressable>
  );
}

/** Search and the bell together, the right end the upright capsule centres against (the bell alone was 40). */
const ENDS = 40 + tokens.spaceSm + 40;

/** The top of Today's cover, with Search beside the bell on a phone and an upright iPad; held sideways the banner keeps the bell alone, since the sidebar's row is Search. `now` is the band over an event happening now. */
export function SearchOnCoverScreen({ now }: { now: boolean }) {
  const insets = useSafeAreaInsets();
  const { kind } = useLayout();
  const phone = kind === 'phone';
  const [told, setTold] = useState<string | null>(null);
  const tell = useCallback<Tell>((words) => setTold(words), []);
  const shell = useMemo(() => demoShell(tell, { search: openSearch }), [tell]);

  return (
    <OrgSwitcherProvider state={null} statusBar="light" tell={tell}>
      <TodayShellProvider value={shell}>
        <View style={styles.screen}>
          {kind === 'tabletLandscape' ? (
            <View style={[styles.banner, { marginTop: insets.top + tokens.spaceXl }]}>
              {now ? (
                <EventMesh event={{ mesh: EVENTS.ireti.mesh, photo: null }} shade="day" />
              ) : (
                <Cover shade="foot" />
              )}
              <View style={styles.bannerBell}>
                <BellButton />
              </View>
            </View>
          ) : (
            <View style={[styles.cover, phone ? styles.coverPhone : styles.coverTablet]}>
              {now ? (
                <EventMesh event={{ mesh: EVENTS.ireti.mesh, photo: null }} shade="day" />
              ) : (
                <Cover shade="foot" />
              )}
              {phone ? (
                <PhoneTop now={now} top={insets.top} />
              ) : (
                <TabletTop
                  compact={now}
                  top={insets.top}
                  onTab={(tab) => tell(`${tab} has its own design.`)}
                />
              )}
            </View>
          )}
          {told != null && (
            <View style={[styles.toast, { bottom: insets.bottom + tokens.spaceXl }]}>
              <Toast key={told} words={told} onClose={() => setTold(null)} />
            </View>
          )}
        </View>
      </TodayShellProvider>
    </OrgSwitcherProvider>
  );
}

function PhoneTop({ now, top }: { now: boolean; top: number }) {
  const { t } = useTranslation();

  return (
    <View style={[styles.topPhone, { marginTop: top }]}>
      <OrgButton compact={now} />
      <View style={styles.grow} />
      <View style={styles.ends}>
        <GlassSearchButton />
        <BellButton />
      </View>
      <View style={styles.title} pointerEvents="box-none">
        {now && (
          <Text size={17} weight="semibold" accessibilityRole="header" style={styles.white}>
            {t('todayScreen.today')}
          </Text>
        )}
      </View>
    </View>
  );
}

/** `TodayCover`'s `TabletTop` with the 88 end: the capsule sizes its labels clear of it, and the opener keeps to the left of the capsule, giving way where the tabs took its room. */
function TabletTop({
  compact,
  top,
  onTab,
}: {
  compact: boolean;
  top: number;
  onTab: (tab: Tab) => void;
}) {
  const { t } = useTranslation();
  const [row, setRow] = useState<number>();
  const [capsule, setCapsule] = useState<number>();
  const labels = TABS.map(([, glyph]) => t(`todayScreen.tab.${glyph}`));
  const inside = row == null ? 0 : Math.max(0, row - 2 * tokens.space3xl);
  const { labelSize, givesWay, measure } = useCapsuleLabels(labels, inside, ENDS);
  const room =
    row == null || capsule == null
      ? undefined
      : Math.max(0, (row - capsule) / 2 - tokens.space3xl - tokens.spaceSm);

  return (
    <View
      style={[styles.topTablet, { marginTop: top }]}
      onLayout={(event) => setRow(event.nativeEvent.layout.width)}
    >
      {measure}
      <OrgButton compact={compact} maxWidth={room} givesWay={givesWay} />
      <View style={styles.grow} />
      <View style={styles.ends}>
        <GlassSearchButton />
        <BellButton />
      </View>
      <View style={styles.capsuleAt} pointerEvents="box-none">
        <View onLayout={(event) => setCapsule(event.nativeEvent.layout.width)}>
          <TabCapsule onTab={onTab} labelSize={labelSize} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.colorCard },
  cover: { overflow: 'hidden' },
  coverPhone: { height: 260 },
  coverTablet: { height: 320 },
  banner: {
    height: 220,
    marginHorizontal: tokens.spaceXl,
    borderRadius: tokens.space4xl,
    overflow: 'hidden',
  },
  bannerBell: { position: 'absolute', right: tokens.spaceXxl, top: 18 },
  round: { width: 40, justifyContent: 'center' },
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
  grow: { flex: 1, minWidth: 0 },
  ends: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  title: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  capsuleAt: { position: 'absolute', left: 0, right: 0, top: 7, alignItems: 'center' },
  white: { color: tokens.colorInkOnDark },
  toast: { position: 'absolute', left: tokens.spaceXl, right: tokens.spaceXl },
});
