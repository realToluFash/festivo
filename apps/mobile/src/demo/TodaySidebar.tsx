import { type ReactNode, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ViewInstance } from 'react-native';

import { Brand } from '../components/Brand.tsx';
import { Text } from '../components/Text.tsx';
import { tokens } from '../theme/tokens.ts';
import { EventMesh, eventColour } from './Cover.tsx';
import { Glyph, type GlyphName } from './Glyph.tsx';
import { OpenerWords, OPENER, OrgMark, useOrgOpener } from './OrgSwitcher.tsx';
import { EVENTS, type EventKey } from './today.ts';
import type { Tab } from './TodayCover.tsx';
import type { Tell } from './TodayParts.tsx';
import { SAMPLE } from './samples.ts';

export interface SidebarPerson {
  name: string;
  initials: string;
  role: string | null;
}

export const SIDEBAR_WIDTH = 252;

const YOU: SidebarPerson = { name: SAMPLE.name, initials: 'FA', role: 'Owner' };

const PLACES: readonly (readonly [Tab, GlyphName])[] = [
  ['Today', 'today'],
  ['Events', 'events'],
  ['Calendar', 'calendar'],
];

export function SidebarPlace({
  label,
  glyph,
  on,
  onPress,
  testID,
}: {
  label: string;
  glyph: GlyphName;
  on: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const ink = on ? tokens.colorInk : tokens.colorInkSecondary;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.place, on && styles.placeOn, pressed && styles.pressed]}
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
      testID={testID}
    >
      <Glyph name={glyph} ink={ink} />
      <Text
        size={14.5}
        weight={on ? 'semibold' : 'medium'}
        accessible={false}
        style={{ color: ink }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Place({
  label,
  glyph,
  onTab,
  at,
}: {
  label: Tab;
  glyph: GlyphName;
  onTab: (tab: Tab) => void;
  at: Tab;
}) {
  return (
    <SidebarPlace label={label} glyph={glyph} on={label === at} onPress={() => onTab(label)} />
  );
}

function SidebarOrg() {
  const ref = useRef<ViewInstance>(null);
  const org = useOrgOpener(ref);

  return (
    <Pressable
      ref={ref}
      onPress={org.onPress}
      style={({ pressed }) => [
        styles.org,
        org.waiting > 0 && styles.orgWaiting,
        (org.expanded || pressed) && styles.orgOpen,
      ]}
      accessibilityRole="button"
      accessibilityLabel={org.label}
      accessibilityState={{ expanded: org.expanded }}
      testID="org.switch"
    >
      <OrgMark id={org.place.id} name={org.place.name} side={28} />
      <OpenerWords opener={org} grow />
      <Glyph name="updown" size={14} ink={tokens.colorInkSecondary} />
    </Pressable>
  );
}

export function SidebarHead({
  tell,
  search = true,
  org = true,
}: {
  tell: Tell;
  search?: boolean;
  org?: boolean;
}) {
  return (
    <>
      <View style={styles.logo}>
        <Brand lockup height={24} />
      </View>
      {org && <SidebarOrg />}
      {search && (
        <Pressable
          onPress={() => tell('Search has its own design.')}
          style={styles.search}
          accessibilityRole="search"
          accessibilityLabel="Search"
        >
          <Glyph name="search" size={16} ink={tokens.colorInkSecondary} />
          <Text
            size={14}
            weight="medium"
            accessible={false}
            style={[styles.grow, styles.secondary]}
          >
            Search
          </Text>
          <View style={styles.key}>
            <Text size={12} weight="medium" accessible={false} style={styles.secondary}>
              ⌘K
            </Text>
          </View>
        </Pressable>
      )}
    </>
  );
}

export function SidebarFoot({
  onTab,
  at,
  onPerson,
  person = YOU,
}: {
  onTab: (tab: Tab) => void;
  at: Tab | null;
  onPerson: () => void;
  person?: SidebarPerson;
}) {
  return (
    <>
      <SidebarPlace
        label="Settings"
        glyph="settings"
        on={at === 'Settings'}
        onPress={() => onTab('Settings')}
      />
      <Pressable
        onPress={onPerson}
        style={styles.person}
        accessibilityRole="button"
        accessibilityLabel={person.role == null ? person.name : `${person.name}, ${person.role}`}
      >
        <View
          style={styles.avatar}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <EventMesh event="draft" />
          <Text size={12} weight="bold" accessible={false}>
            {person.initials}
          </Text>
        </View>
        <View style={styles.grow}>
          <Text size={14} weight="semibold" accessible={false}>
            {person.name}
          </Text>
          {person.role != null && (
            <Text size={12} weight="medium" accessible={false} style={styles.secondary}>
              {person.role}
            </Text>
          )}
        </View>
        <Glyph name="updown" size={15} ink={tokens.colorInkSecondary} />
      </Pressable>
    </>
  );
}

export function SidebarColumn({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      style={styles.column}
      contentContainerStyle={[styles.side, styles.fills]}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

export function SidebarPlaces({ children }: { children: ReactNode }) {
  return (
    <View style={styles.places} accessibilityRole="tablist">
      {children}
    </View>
  );
}

/** iPad landscape's sidebar: the places, your events by colour, and the person at its foot. */
export function TodaySidebar({
  events,
  onTab,
  tell,
  at = 'Today',
  onPerson = () => tell('Your account has its own design.'),
  onEvent = (key) => tell(`${EVENTS[key].name} has its own design.`),
  person = YOU,
  org = true,
}: {
  events: readonly EventKey[];
  onTab: (tab: Tab) => void;
  tell: Tell;
  at?: Tab;
  onPerson?: () => void;
  onEvent?: ((key: EventKey) => void) | undefined;
  person?: SidebarPerson;
  org?: boolean;
}) {
  return (
    <View style={styles.side}>
      <SidebarHead tell={tell} org={org} />
      <View style={styles.places} accessibilityRole="tablist">
        {PLACES.map(([label, glyph]) => (
          <Place key={label} label={label} glyph={glyph} onTab={onTab} at={at} />
        ))}
      </View>
      <View>
        <Text
          size={11}
          weight="semibold"
          accessibilityRole="header"
          style={[styles.secondary, styles.caps]}
        >
          YOUR EVENTS
        </Text>
        {events.map((key) => (
          <Pressable
            key={key}
            onPress={() => onEvent(key)}
            style={({ pressed }) => [styles.event, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={EVENTS[key].name}
          >
            <View style={[styles.dot, { backgroundColor: eventColour(key) }]} />
            <Text
              size={14}
              weight="medium"
              numberOfLines={1}
              accessible={false}
              style={[styles.grow, styles.secondary]}
            >
              {EVENTS[key].name}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.grow} />
      <SidebarFoot onTab={onTab} at={at} onPerson={onPerson} person={person} />
    </View>
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
  side: {
    width: SIDEBAR_WIDTH,
    paddingTop: 22,
    paddingHorizontal: tokens.spacePillEnd,
    paddingBottom: tokens.spacePillEnd,
    gap: tokens.spacePillEnd,
  },
  logo: { height: 30, justifyContent: 'center', paddingHorizontal: tokens.spaceMd },
  org: {
    minHeight: OPENER.rest,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingLeft: tokens.spaceSm,
    paddingRight: tokens.spaceMd,
    borderRadius: tokens.radiusRow,
  },
  orgWaiting: { minHeight: OPENER.waiting },
  orgOpen: {
    backgroundColor: tokens.colorCard,
    ...tokens.elevationNative.card.ios,
    elevation: tokens.elevationNative.card.android.elevation,
  },
  search: {
    height: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingHorizontal: tokens.spaceLg,
    borderRadius: tokens.radiusRow,
    backgroundColor: tokens.colorCard,
  },
  key: {
    paddingHorizontal: tokens.spaceXs,
    paddingVertical: tokens.spaceHair,
    borderRadius: tokens.spaceXs,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
  },
  places: { gap: tokens.spaceHair },
  column: { width: SIDEBAR_WIDTH, flexGrow: 0 },
  fills: { flexGrow: 1 },
  place: {
    height: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    paddingHorizontal: tokens.spaceLg,
    borderRadius: tokens.radiusRow,
  },
  placeOn: {
    backgroundColor: tokens.colorCard,
    ...tokens.elevationNative.card.ios,
    elevation: tokens.elevationNative.card.android.elevation,
  },
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
  person: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingHorizontal: tokens.spaceSm,
  },
  avatar: {
    width: tokens.space5xl,
    height: tokens.space5xl,
    borderRadius: tokens.spaceXl,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
