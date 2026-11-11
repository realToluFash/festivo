import { type Href, router, useGlobalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '../components/Text.tsx';
import { eventColour } from '../components/EventMesh.tsx';
import type { GlyphName } from '../components/Glyph.tsx';
import type { Tab } from '../components/TodayCover.tsx';
import {
  SidebarColumn,
  SidebarFoot,
  SidebarHead,
  SidebarPlace,
  SidebarPlaces,
} from '../components/TodaySidebar.tsx';
import type { ShownEvent } from '../kit/today.ts';
import { tokens } from '../theme/tokens.ts';
import { eventHref } from './events/EventsModel.ts';
import { EVENT_OF_KEY } from './events/EventsSample.ts';
import { useCurrentPlace } from './OrgSwitcher.tsx';
import { LEAST_ROWS, sideEventsOf } from './sideEvents.ts';
import type { EventKey } from './today.ts';

const PLACES: readonly (readonly [Tab, GlyphName])[] = [
  ['Today', 'today'],
  ['Events', 'events'],
  ['Calendar', 'calendar'],
];

function SideEvent({ event }: { event: ShownEvent }) {
  const id = event.id in EVENT_OF_KEY ? EVENT_OF_KEY[event.id as EventKey] : event.id;

  return (
    <Pressable
      onPress={() => router.push(eventHref(id) as Href)}
      style={({ pressed }) => [styles.event, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={event.name}
    >
      <View style={[styles.dot, { backgroundColor: eventColour(event) }]} />
      <Text
        size={14}
        weight="medium"
        numberOfLines={1}
        accessible={false}
        style={[styles.grow, styles.secondary]}
      >
        {event.name}
      </Text>
    </Pressable>
  );
}

/** The sidebar on its side, the same on Today, Events, the Calendar and Settings (sc-39340): with no events it has no heading, and a list longer than it holds scrolls under its heading while the places and the foot stay; below four rows the whole sidebar scrolls. */
export function DemoSidebar({
  events,
  onTab,
  at = 'Today',
  onPerson,
  org = true,
}: {
  events: readonly ShownEvent[];
  onTab: (tab: Tab) => void;
  at?: Tab;
  onPerson?: (() => void) | undefined;
  org?: boolean;
}) {
  const { t } = useTranslation();
  const { sidebar } = useGlobalSearchParams<{ sidebar?: string }>();
  const fresh = useCurrentPlace()?.fresh === true;
  const listed = sideEventsOf(events, sidebar, fresh);

  return (
    <SidebarColumn>
      <SidebarHead org={org} />
      <SidebarPlaces>
        {PLACES.filter(([tab]) => org || tab === 'Today').map(([tab, glyph]) => (
          <SidebarPlace
            key={tab}
            label={t(`todayScreen.tab.${glyph}`)}
            glyph={glyph}
            on={tab === at}
            onPress={() => onTab(tab)}
          />
        ))}
      </SidebarPlaces>
      {listed.length === 0 ? (
        <View style={styles.grow} />
      ) : (
        <View style={styles.list}>
          <Text
            size={12}
            weight="semibold"
            accessibilityRole="header"
            style={[styles.secondary, styles.caps]}
          >
            {t('todayScreen.yourEvents').toLocaleUpperCase()}
          </Text>
          <ScrollView
            style={[
              styles.rows,
              { minHeight: Math.min(listed.length, LEAST_ROWS) * tokens.sizeHit },
            ]}
            nestedScrollEnabled
          >
            {listed.map((event) => (
              <SideEvent key={event.id} event={event} />
            ))}
          </ScrollView>
        </View>
      )}
      <SidebarFoot onTab={onTab} at={at} onPerson={onPerson} />
    </SidebarColumn>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  caps: {
    letterSpacing: 11 * 0.08,
    paddingHorizontal: tokens.spaceLg,
    paddingVertical: tokens.spaceXs,
  },
  pressed: { opacity: 0.7 },
  list: { flexGrow: 1 },
  rows: { flexGrow: 1, flexBasis: 0 },
  event: {
    height: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    paddingHorizontal: tokens.spaceLg,
  },
  dot: {
    width: tokens.spaceMd,
    height: tokens.spaceMd,
    borderRadius: 5,
    marginHorizontal: tokens.spaceXxs,
  },
});
