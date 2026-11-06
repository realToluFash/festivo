import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Brand } from './Brand.tsx';
import { Text } from './Text.tsx';
import { tokens } from '../theme/tokens.ts';
import { EventMesh, eventColour } from './EventMesh.tsx';
import { Glyph, type GlyphName } from './Glyph.tsx';
import type { ShownEvent } from '../kit/today.ts';
import { SETTINGS_ID, type Tab } from './TodayCover.tsx';
import { Initials } from './Initials.tsx';
import { useTodayShell } from './todayShell.ts';

const PLACES: readonly (readonly [Tab, GlyphName])[] = [
  ['Today', 'today'],
  ['Events', 'events'],
  ['Calendar', 'calendar'],
];

function Place({
  tab,
  glyph,
  onTab,
  at,
}: {
  tab: Tab;
  glyph: GlyphName;
  onTab: (tab: Tab) => void;
  at: Tab;
}) {
  const { t } = useTranslation();
  const on = tab === at;
  const ink = on ? tokens.colorInk : tokens.colorInkSecondary;
  const words = t(`todayScreen.tab.${glyph}`);

  return (
    <Pressable
      onPress={() => onTab(tab)}
      style={({ pressed }) => [styles.place, on && styles.placeOn, pressed && styles.pressed]}
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      accessibilityLabel={words}
      testID={SETTINGS_ID[tab]}
    >
      <Glyph name={glyph} ink={ink} />
      <Text
        size={14.5}
        weight={on ? 'semibold' : 'medium'}
        accessible={false}
        style={{ color: ink }}
      >
        {words}
      </Text>
    </Pressable>
  );
}

/** iPad landscape's sidebar: the places, your events by colour, and the person at its foot. */
export function TodaySidebar({
  events,
  onTab,
  at = 'Today',
  onPerson,
}: {
  events: readonly ShownEvent[];
  onTab: (tab: Tab) => void;
  at?: Tab;
  onPerson?: () => void;
}) {
  const { t } = useTranslation();
  const { organisation, person, search, open } = useTodayShell();

  return (
    <View style={styles.side}>
      <View style={styles.logo}>
        <Brand lockup height={24} />
      </View>
      <Pressable
        onPress={() => open({ to: 'organisation' })}
        style={styles.org}
        accessibilityRole="button"
        accessibilityLabel={t('todayScreen.switchOrganisation', { name: organisation })}
        testID="home.switchOrganisation"
      >
        <View
          style={styles.orgTile}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Initials name={organisation} size={12} weight="bold" style={styles.onAccent} />
        </View>
        <Text size={15} weight="semibold" accessible={false} style={styles.grow}>
          {organisation}
        </Text>
        <Glyph name="updown" size={15} ink={tokens.colorInkSecondary} />
      </Pressable>
      {search && (
        <Pressable
          onPress={() => open({ to: 'search' })}
          style={styles.search}
          accessibilityRole="search"
          accessibilityLabel={t('todayScreen.search')}
        >
          <Glyph name="search" size={16} ink={tokens.colorInkSecondary} />
          <Text
            size={14}
            weight="medium"
            accessible={false}
            style={[styles.grow, styles.secondary]}
          >
            {t('todayScreen.search')}
          </Text>
          <View style={styles.key}>
            <Text size={12} weight="medium" accessible={false} style={styles.secondary}>
              ⌘K
            </Text>
          </View>
        </Pressable>
      )}
      <View style={styles.places} accessibilityRole="tablist">
        {PLACES.map(([label, glyph]) => (
          <Place key={label} tab={label} glyph={glyph} onTab={onTab} at={at} />
        ))}
      </View>
      <View>
        <Text
          size={12}
          weight="semibold"
          accessibilityRole="header"
          style={[styles.secondary, styles.caps]}
        >
          {t('todayScreen.yourEvents').toLocaleUpperCase()}
        </Text>
        {events.map((event) => (
          <Pressable
            key={event.id}
            onPress={() => open({ to: 'event', id: event.id, name: event.name })}
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
        ))}
      </View>
      <View style={styles.grow} />
      <Place tab="Settings" glyph="settings" onTab={onTab} at={at} />
      <Pressable
        onPress={onPerson ?? (() => open({ to: 'account' }))}
        style={styles.person}
        accessibilityRole="button"
        accessibilityLabel={person.role == null ? person.name : t('todayScreen.personRole', person)}
      >
        <View
          style={styles.avatar}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <EventMesh event={{ mesh: 'amber', photo: null }} />
          <Initials name={person.name} size={12} weight="bold" />
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
