import { useGlobalSearchParams } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EventsFailed } from '../../components/Events.tsx';
import { Pending } from '../../components/Pending.tsx';
import {
  PhoneTabBar,
  SHEET_RISE,
  type Tab,
  TabBarFade,
  TodayCover,
  tabBarFoot,
} from '../../components/TodayCover.tsx';
import { TAB_BAR } from '../../components/TodayScreen.tsx';
import { sidePadding } from '../../components/bodyEdges.ts';
import type { Moment } from '../../kit/today.ts';
import { SKELETON_AFTER_MS } from '../../kit/skeleton.ts';
import { useLayout } from '../../layout/useLayout.ts';
import { tokens } from '../../theme/tokens.ts';
import { DemoSidebar } from '../Sidebar.tsx';
import { SIDEBAR_EVENTS } from '../sideEvents.ts';
import { READ_TAKES_MS, type Waiting } from './waiting.ts';

const BELOW_HEAD = 28;

/** Today's read in the demo: `?load=` starts it loading or failed; Try again and a pick in the switcher read again, and the read ends as `ends` says. */
export function useTodayRead(
  start: Waiting | null,
  ends: 'loaded' | 'failed',
  placeId: string | undefined,
): { shown: Waiting | 'loaded'; retry: () => void } {
  const [shown, setShown] = useState<Waiting | 'loaded'>(start ?? 'loaded');
  const [reads, setReads] = useState(0);
  const [readFor, setReadFor] = useState(placeId);

  if (start != null && placeId !== readFor) {
    setReadFor(placeId);
    setShown('loading');
    setReads((n) => n + 1);
  }

  useEffect(() => {
    if (reads === 0) return undefined;
    const timer = setTimeout(() => setShown(ends), READ_TAKES_MS);

    return () => clearTimeout(timer);
  }, [reads, ends]);

  const retry = useCallback(() => {
    setShown('loading');
    setReads((n) => n + 1);
  }, []);

  return { shown, retry };
}

/** Today while its events load or after they did not (sc-87600): the cover, Search, the bell and the tabs stay, and only the body waits. */
export function WaitingTodayScreen({
  moment,
  waiting,
  onTab,
  onRetry,
  notices,
}: {
  moment: Moment;
  waiting: Waiting;
  onTab: (tab: Tab) => void;
  onRetry: () => void;
  notices: ReactNode;
}) {
  const { kind } = useLayout();
  const body =
    waiting === 'loading' ? (
      <View style={styles.loading}>
        <Pending after={SKELETON_AFTER_MS} stacked />
      </View>
    ) : (
      <EventsFailed onRetry={onRetry} testID="today.retry" />
    );

  return kind === 'tabletLandscape' ? (
    <Landscape moment={moment} onTab={onTab} notices={notices}>
      {body}
    </Landscape>
  ) : (
    <Upright moment={moment} onTab={onTab} phone={kind === 'phone'} notices={notices}>
      {body}
    </Upright>
  );
}

function Upright({
  moment,
  onTab,
  phone,
  notices,
  children,
}: {
  moment: Moment;
  onTab: (tab: Tab) => void;
  phone: boolean;
  notices: ReactNode;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const foot = tabBarFoot(insets.bottom);
  const tabs = useCallback(
    (tab: Tab) => {
      if (tab !== 'Today') onTab(tab);
    },
    [onTab],
  );

  return (
    <View style={styles.page}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: phone ? foot + TAB_BAR + tokens.space6xl : insets.bottom + tokens.space6xl,
        }}
      >
        <TodayCover
          moment={moment}
          layout={phone ? 'phone' : 'portrait'}
          top={insets.top}
          onTab={tabs}
        />
        <View
          style={[
            styles.sheet,
            phone ? [styles.sheetPhone, sidePadding(tokens.spaceXxl, insets)] : styles.sheetTablet,
          ]}
        >
          {notices}
          {children}
        </View>
      </ScrollView>
      {phone && (
        <>
          <TabBarFade />
          <PhoneTabBar bottom={foot} onTab={tabs} />
        </>
      )}
    </View>
  );
}

/** On its side the sidebar lists what its own read last listed: nothing on a first open (`?sidebar=` as on a loaded Today), or the four from before with `?sidebar=kept`. */
function Landscape({
  moment,
  onTab,
  notices,
  children,
}: {
  moment: Moment;
  onTab: (tab: Tab) => void;
  notices: ReactNode;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { sidebar } = useGlobalSearchParams<{ sidebar?: string }>();

  return (
    <View style={[styles.chrome, { paddingTop: insets.top }]}>
      <DemoSidebar events={sidebar === 'kept' ? SIDEBAR_EVENTS : []} onTab={onTab} />
      <View style={[styles.pageCard, { marginBottom: Math.max(insets.bottom, tokens.spaceMd) }]}>
        <ScrollView contentContainerStyle={styles.cardPage} showsVerticalScrollIndicator={false}>
          <TodayCover moment={moment} layout="landscape" top={0} onTab={onTab} />
          {notices}
          <View style={styles.landscapeBody}>{children}</View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorCard },
  sheet: {
    marginTop: -SHEET_RISE,
    borderTopLeftRadius: SHEET_RISE,
    borderTopRightRadius: SHEET_RISE,
    backgroundColor: tokens.colorCard,
  },
  sheetPhone: { paddingTop: 22 },
  sheetTablet: { paddingTop: 26, paddingHorizontal: BELOW_HEAD },
  loading: { alignItems: 'center', paddingVertical: tokens.space5xl },
  chrome: { flex: 1, flexDirection: 'row', backgroundColor: tokens.colorNeutralFill },
  pageCard: {
    flex: 1,
    marginRight: tokens.spaceMd,
    borderRadius: tokens.space3xl,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    overflow: 'hidden',
  },
  cardPage: {
    paddingTop: tokens.spaceXxl,
    paddingHorizontal: tokens.space3xl,
    paddingBottom: tokens.space6xl,
    gap: 18,
  },
  landscapeBody: { marginTop: tokens.spaceSm },
});
