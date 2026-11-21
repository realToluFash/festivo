import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type Tab, TodayCover } from '../../components/TodayCover.tsx';
import { FirstRun, NeedsYou, ThisWeek, YourEvents } from '../../components/TodayParts.tsx';
import type { Moment } from '../../kit/today.ts';
import { tokens } from '../../theme/tokens.ts';
import { DemoSidebar } from '../Sidebar.tsx';

const BELOW_HEAD = 28;

/** Today on its side as the product draws it, with the demo's sidebar, which has no heading over nothing (sc-39340). */
export function PlanTodayLandscape({
  moment,
  onTab,
  notices,
}: {
  moment: Moment;
  onTab: (tab: Tab) => void;
  notices: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const events = moment.events.map(({ event }) => event);
  const below = moment.needs == null ? 0 : BELOW_HEAD;

  return (
    <View style={[styles.chrome, { paddingTop: insets.top }]}>
      <DemoSidebar events={events} onTab={onTab} />
      <View style={[styles.pageCard, { marginBottom: Math.max(insets.bottom, tokens.spaceMd) }]}>
        <ScrollView contentContainerStyle={styles.cardPage} showsVerticalScrollIndicator={false}>
          <TodayCover moment={moment} layout="landscape" top={0} onTab={onTab} />
          {notices}
          {moment.kind === 'first' ? (
            <View style={styles.firstPad}>
              <FirstRun wide />
            </View>
          ) : (
            <View style={styles.columns}>
              <View style={styles.grow}>
                <NeedsYou moment={moment} wide top={0} />
                <ThisWeek moment={moment} wide top={below} />
              </View>
              <View style={styles.events}>
                <YourEvents moment={moment} layout="list" top={0} />
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
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
  firstPad: { paddingTop: tokens.spaceSm },
  columns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.space3xl,
    marginTop: tokens.spaceSm,
  },
  events: { width: 316 },
});
