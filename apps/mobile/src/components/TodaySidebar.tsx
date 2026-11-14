import { type ReactNode, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View, type ViewInstance } from 'react-native';

import { Brand } from './Brand.tsx';
import { SIDEBAR_WIDTH } from '../layout/textSize.ts';
import { useNameLines } from '../layout/useLayout.ts';
import { Text } from './Text.tsx';
import { tokens } from '../theme/tokens.ts';
import { EventMesh, eventColour } from './EventMesh.tsx';
import { EventThumb } from './EventThumb.tsx';
import { type Shown, cardTags } from '../kit/eventsList.ts';
import { Glyph, type GlyphName } from './Glyph.tsx';
import type { ShownEvent } from '../kit/today.ts';
import { SETTINGS_ID, type Tab } from './TodayCover.tsx';
import { Initials } from './Initials.tsx';
import { OrgPill } from './OrgPill.tsx';
import { type TodayShell, useTodayShell } from './todayShell.ts';

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
  testID?: string | undefined;
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
  tab,
  glyph,
  onTab,
  at,
  testID = SETTINGS_ID[tab],
}: {
  tab: Tab;
  glyph: GlyphName;
  onTab: (tab: Tab) => void;
  at: Tab | null;
  testID?: string | undefined;
}) {
  const { t } = useTranslation();

  return (
    <SidebarPlace
      label={t(`todayScreen.tab.${glyph}`)}
      glyph={glyph}
      on={tab === at}
      onPress={() => onTab(tab)}
      testID={testID}
    />
  );
}

/** The sidebar's opener, the switcher's pill at the head of iPad landscape's sidebar. */
function SidebarOrg() {
  const ref = useRef<ViewInstance>(null);
  const org = useTodayShell().useOrgOpener(ref, true);

  return (
    <OrgPill
      ref={ref}
      sidebar
      id={org.id}
      name={org.name}
      waiting={org.waiting}
      label={org.label}
      expanded={org.expanded}
      onPress={org.onPress}
      testID="home.switchOrganisation"
    />
  );
}

export function SidebarHead({ search, org = true }: { search?: boolean; org?: boolean }) {
  const { t } = useTranslation();
  const shell = useTodayShell();
  const { open } = shell;

  return (
    <>
      <View style={styles.logo}>
        <Brand lockup height={24} />
      </View>
      {org && <SidebarOrg />}
      {(search ?? shell.search) && (
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
    </>
  );
}

export function SidebarFoot({
  onTab,
  at,
  onPerson,
  person: shown,
  settingsID,
}: {
  onTab: (tab: Tab) => void;
  at: Tab | null;
  onPerson?: (() => void) | undefined;
  person?: TodayShell['person'] | undefined;
  settingsID?: string | undefined;
}) {
  const { t } = useTranslation();
  const shell = useTodayShell();
  const lines = useNameLines();
  const person = shown ?? shell.person;

  return (
    <>
      <Place tab="Settings" glyph="settings" onTab={onTab} at={at} testID={settingsID} />
      <Pressable
        onPress={onPerson ?? (() => shell.open({ to: 'account' }))}
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
          <Text size={14} weight="semibold" numberOfLines={lines} accessible={false}>
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

/** The sidebar's way back out of an event, under its head. */
export function SidebarBack({
  label,
  heard,
  onPress,
  testID,
}: {
  label: string;
  heard: string;
  onPress: () => void;
  testID?: string | undefined;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
      accessibilityRole="button"
      accessibilityLabel={heard}
      testID={testID}
    >
      <Glyph name="back" size={17} ink={tokens.colorInkSecondary} weight={2.4} />
      <Text size={14} weight="semibold" accessible={false} style={styles.secondary}>
        {label}
      </Text>
    </Pressable>
  );
}

/** The event as a card under the sidebar's way back: its thumb, name and tags, sunk while it loads. */
export function SidebarEventCard({ event, now }: { event: Shown | null; now: Date }) {
  const { t } = useTranslation();

  if (event == null)
    return (
      <View style={styles.eventCard} testID="event.side.loading">
        <View style={styles.sunkThumb} />
        <View style={[styles.grow, styles.sunkLines]}>
          <View style={[styles.sunkLine, styles.sunkName]} />
          <View style={[styles.sunkLine, styles.sunkTags]} />
        </View>
      </View>
    );

  const tags = cardTags(event, now, t).map((tag) => tag.word);

  return (
    <View
      style={styles.eventCard}
      accessible
      accessibilityLabel={`${event.name}. ${tags.join(', ')}`}
      testID="event.side.card"
    >
      <EventThumb event={event} side={40} radius={12} />
      <View style={styles.grow}>
        <Text size={14} weight="bold" numberOfLines={2} accessible={false}>
          {event.name}
        </Text>
        <Text size={12.5} weight="medium" accessible={false} style={styles.secondary}>
          {tags.join(' · ')}
        </Text>
      </View>
    </View>
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

/** The least the list's region shows before the whole sidebar scrolls instead (sc-39340). */
const LEAST_ROWS = 4;

/** Your events under the places: no heading over nothing, and a list longer than the sidebar holds scrolls in its own region while the places and the foot stay (sc-39340). */
export function SidebarEvents({ events }: { events: readonly ShownEvent[] }) {
  const { t } = useTranslation();
  const { open } = useTodayShell();

  if (events.length === 0) return <View style={styles.grow} />;

  return (
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
        style={[styles.rows, { minHeight: Math.min(events.length, LEAST_ROWS) * tokens.sizeHit }]}
        nestedScrollEnabled
      >
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
      </ScrollView>
    </View>
  );
}

/** iPad landscape's sidebar: the places, your events by colour, and the person at its foot; with no organisation, Today alone above Settings (sc-29914). */
export function TodaySidebar({
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
  return (
    <SidebarColumn>
      <SidebarHead org={org} />
      <SidebarPlaces>
        {PLACES.filter(([tab]) => org || tab === 'Today').map(([label, glyph]) => (
          <Place key={label} tab={label} glyph={glyph} onTab={onTab} at={at} />
        ))}
      </SidebarPlaces>
      <SidebarEvents events={events} />
      <SidebarFoot onTab={onTab} at={at} onPerson={onPerson} />
    </SidebarColumn>
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
    width: SIDEBAR_WIDTH,
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
  back: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    paddingHorizontal: tokens.spaceMd,
  },
  backPressed: { opacity: tokens.opacityPressed },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    padding: tokens.spaceMd,
    borderRadius: tokens.spaceXl,
    backgroundColor: tokens.colorCard,
  },
  sunkThumb: { width: 40, height: 40, borderRadius: 12, backgroundColor: tokens.colorNeutralFill },
  sunkLines: { gap: tokens.spaceSm },
  sunkLine: { height: 12, borderRadius: 6, backgroundColor: tokens.colorNeutralFill },
  sunkName: { width: '70%' },
  sunkTags: { width: '45%' },
  column: { width: SIDEBAR_WIDTH, flexGrow: 0 },
  fills: { flexGrow: 1 },
  list: { flexGrow: 1 },
  rows: { flexGrow: 1, flexBasis: 0 },
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
