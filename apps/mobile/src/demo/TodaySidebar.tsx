import { Pressable, StyleSheet, View } from 'react-native';

import { Brand } from '../components/Brand.tsx';
import { Text } from '../components/Text.tsx';
import { tokens } from '../theme/tokens.ts';
import { EventMesh, eventColour } from './Cover.tsx';
import { Glyph, type GlyphName } from './Glyph.tsx';
import { EVENTS, type EventKey } from './today.ts';
import type { Tab } from './TodayCover.tsx';
import type { Tell } from './TodayParts.tsx';
import { SAMPLE } from './samples.ts';

const PLACES: readonly (readonly [Tab, GlyphName])[] = [
  ['Today', 'today'],
  ['Events', 'events'],
  ['Calendar', 'calendar'],
];

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
  const on = label === at;
  const ink = on ? tokens.colorInk : tokens.colorInkSecondary;

  return (
    <Pressable
      onPress={() => onTab(label)}
      style={({ pressed }) => [styles.place, on && styles.placeOn, pressed && styles.pressed]}
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
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

/** iPad landscape's sidebar: the places, your events by colour, and the person at its foot. */
export function TodaySidebar({
  events,
  onTab,
  tell,
  at = 'Today',
  onPerson = () => tell('Your account has its own design.'),
}: {
  events: readonly EventKey[];
  onTab: (tab: Tab) => void;
  tell: Tell;
  at?: Tab;
  onPerson?: () => void;
}) {
  return (
    <View style={styles.side}>
      <View style={styles.logo}>
        <Brand lockup height={24} />
      </View>
      <Pressable
        onPress={() => tell('Switching organisation has its own design.')}
        style={styles.org}
        accessibilityRole="button"
        accessibilityLabel={`${SAMPLE.organisation}. Switch organisation`}
      >
        <View
          style={styles.orgTile}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Text size={12} weight="bold" accessible={false} style={styles.onAccent}>
            IE
          </Text>
        </View>
        <Text size={15} weight="semibold" accessible={false} style={styles.grow}>
          {SAMPLE.organisation}
        </Text>
        <Glyph name="updown" size={15} ink={tokens.colorInkSecondary} />
      </Pressable>
      <Pressable
        onPress={() => tell('Search has its own design.')}
        style={styles.search}
        accessibilityRole="search"
        accessibilityLabel="Search"
      >
        <Glyph name="search" size={16} ink={tokens.colorInkSecondary} />
        <Text size={14} weight="medium" accessible={false} style={[styles.grow, styles.secondary]}>
          Search
        </Text>
        <View style={styles.key}>
          <Text size={12} weight="medium" accessible={false} style={styles.secondary}>
            ⌘K
          </Text>
        </View>
      </Pressable>
      <View style={styles.places} accessibilityRole="tablist">
        {PLACES.map(([label, glyph]) => (
          <Place key={label} label={label} glyph={glyph} onTab={onTab} at={at} />
        ))}
      </View>
      <View>
        <Text
          size={12}
          weight="semibold"
          accessibilityRole="header"
          style={[styles.secondary, styles.caps]}
        >
          YOUR EVENTS
        </Text>
        {events.map((key) => (
          <Pressable
            key={key}
            onPress={() => tell(`${EVENTS[key].name} has its own design.`)}
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
      <Place label="Settings" glyph="settings" onTab={onTab} at={at} />
      <Pressable
        onPress={onPerson}
        style={styles.person}
        accessibilityRole="button"
        accessibilityLabel={`${SAMPLE.name}, Owner`}
      >
        <View
          style={styles.avatar}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <EventMesh event="draft" />
          <Text size={12} weight="bold" accessible={false}>
            FA
          </Text>
        </View>
        <View style={styles.grow}>
          <Text size={14} weight="semibold" accessible={false}>
            {SAMPLE.name}
          </Text>
          <Text size={12} weight="medium" accessible={false} style={styles.secondary}>
            Owner
          </Text>
        </View>
        <Glyph name="updown" size={15} ink={tokens.colorInkSecondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  onAccent: { color: tokens.colorInkOnDark },
  caps: {
    letterSpacing: 11 * 0.08,
    paddingHorizontal: tokens.spaceLg,
    paddingVertical: tokens.spaceXs,
  },
  pressed: { opacity: 0.7 },
  side: {
    width: 252,
    paddingTop: 22,
    paddingHorizontal: tokens.spacePillEnd,
    paddingBottom: tokens.spacePillEnd,
    gap: tokens.spacePillEnd,
  },
  logo: { height: 30, justifyContent: 'center', paddingHorizontal: tokens.spaceMd },
  org: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingHorizontal: tokens.spaceSm,
  },
  orgTile: {
    width: tokens.space4xl,
    height: tokens.space4xl,
    borderRadius: 9,
    backgroundColor: tokens.colorAccent,
    alignItems: 'center',
    justifyContent: 'center',
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
