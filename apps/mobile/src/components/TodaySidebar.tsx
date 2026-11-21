import {
  type ReactNode,
  type Ref,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  type LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewInstance,
  useWindowDimensions,
} from 'react-native';

import { Brand } from './Brand.tsx';
import {
  CARD_THUMB,
  HEADING_TRACKING,
  PERSON_GLYPH,
  ROOMS,
  glyphSide,
  rowPad,
} from '../layout/sidebarSize.ts';
import { LABEL_LINE, SIDEBAR_WIDTH } from '../layout/textSize.ts';
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
import { useSideFit } from './sideFit.tsx';
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
  const { fontScale } = useWindowDimensions();
  const weight = on ? 'semibold' : 'medium';
  const { size, measure } = useSideFit(label, ROOMS.place, fontScale, weight);
  const ink = on ? tokens.colorInk : tokens.colorInkSecondary;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.place,
        { paddingVertical: rowPad(fontScale) },
        on && styles.placeOn,
        pressed && styles.pressed,
      ]}
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
      testID={testID}
    >
      {measure}
      <Glyph name={glyph} size={glyphSide(ROOMS.place, fontScale, size)} ink={ink} />
      <Text
        size={size}
        weight={weight}
        allowFontScaling={false}
        accessible={false}
        style={[styles.grow, { color: ink }]}
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

export function SidebarHead({
  search,
  org = true,
  children,
}: {
  search?: boolean;
  org?: boolean;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const shell = useTodayShell();
  const { open } = shell;

  return (
    <>
      <View style={styles.logo}>
        <Brand lockup height={24} />
      </View>
      {org && (children ?? <SidebarOrg />)}
      {(search ?? shell.search) && (
        <SidebarSearch label={t('todayScreen.search')} onPress={() => open({ to: 'search' })} />
      )}
    </>
  );
}

function SidebarSearch({ label, onPress }: { label: string; onPress: () => void }) {
  const { fontScale } = useWindowDimensions();
  const { size, measure } = useSideFit(label, ROOMS.search, fontScale, 'medium');

  return (
    <Pressable
      onPress={onPress}
      style={[styles.search, { paddingVertical: rowPad(fontScale) }]}
      accessibilityRole="search"
      accessibilityLabel={label}
    >
      {measure}
      <Glyph
        name="search"
        size={glyphSide(ROOMS.search, fontScale, size)}
        ink={tokens.colorInkSecondary}
      />
      <Text
        size={size}
        weight="medium"
        allowFontScaling={false}
        accessible={false}
        style={[styles.grow, styles.secondary]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function SidebarFoot({
  onTab,
  at,
  onPerson,
  person: shown,
  settingsID,
  settings = true,
  personRef,
}: {
  onTab: (tab: Tab) => void;
  at: Tab | null;
  onPerson?: (() => void) | undefined;
  person?: TodayShell['person'] | undefined;
  settingsID?: string | undefined;
  /** Held from outside an organisation there is no Settings to go to (sc-71). */
  settings?: boolean;
  personRef?: Ref<ViewInstance> | undefined;
}) {
  const { t } = useTranslation();
  const shell = useTodayShell();
  const person = shown ?? shell.person;

  return (
    <>
      {settings && (
        <Place tab="Settings" glyph="settings" onTab={onTab} at={at} testID={settingsID} />
      )}
      <SidebarPerson
        name={person.name}
        role={person.role}
        label={person.role == null ? person.name : t('todayScreen.personRole', person)}
        onPress={onPerson ?? (() => shell.open({ to: 'account' }))}
        personRef={personRef}
      />
    </>
  );
}

function SidebarPerson({
  name,
  role,
  label,
  onPress,
  personRef,
}: {
  name: string;
  role: string | null;
  label: string;
  onPress: () => void;
  personRef?: Ref<ViewInstance> | undefined;
}) {
  const { fontScale } = useWindowDimensions();
  const lines = useNameLines();
  const named = useSideFit(
    name,
    ROOMS.person,
    fontScale,
    'semibold',
    lines === 1 ? 'line' : 'lines',
  );
  const roled = useSideFit(role ?? '', ROOMS.role, fontScale, 'medium');

  return (
    <Pressable
      ref={personRef}
      onPress={onPress}
      style={[styles.person, { paddingVertical: rowPad(fontScale) }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {named.measure}
      {role != null && roled.measure}
      <View
        style={styles.avatar}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <EventMesh event={{ mesh: 'amber', photo: null }} />
        <Initials name={name} size={12} weight="bold" />
      </View>
      <View style={styles.grow}>
        <Text
          size={named.size}
          weight="semibold"
          numberOfLines={lines}
          allowFontScaling={false}
          accessible={false}
        >
          {name}
        </Text>
        {role != null && (
          <Text
            size={roled.size}
            weight="medium"
            allowFontScaling={false}
            accessible={false}
            style={styles.secondary}
          >
            {role}
          </Text>
        )}
      </View>
      <Glyph name="updown" size={PERSON_GLYPH} ink={tokens.colorInkSecondary} />
    </Pressable>
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
  const { fontScale } = useWindowDimensions();
  const { size, measure } = useSideFit(label, ROOMS.back, fontScale, 'semibold');

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.back,
        { paddingVertical: rowPad(fontScale) },
        pressed && styles.backPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={heard}
      testID={testID}
    >
      {measure}
      <Glyph
        name="back"
        size={glyphSide(ROOMS.back, fontScale, size)}
        ink={tokens.colorInkSecondary}
        weight={2.4}
      />
      <Text
        size={size}
        weight="semibold"
        allowFontScaling={false}
        accessible={false}
        style={[styles.grow, styles.secondary]}
      >
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

  return <SidebarCardWords event={event} tags={cardTags(event, now, t).map((tag) => tag.word)} />;
}

function SidebarCardWords({ event, tags }: { event: Shown; tags: readonly string[] }) {
  const { fontScale } = useWindowDimensions();
  const named = useSideFit(event.name, ROOMS.cardName, fontScale, 'bold', 'lines');
  const tagged = useSideFit(tags.join(' · '), ROOMS.cardTags, fontScale, 'medium');

  return (
    <View
      style={styles.eventCard}
      accessible
      accessibilityLabel={`${event.name}. ${tags.join(', ')}`}
      testID="event.side.card"
    >
      {named.measure}
      {tagged.measure}
      <EventThumb event={event} side={CARD_THUMB} radius={12} />
      <View style={styles.grow}>
        <Text
          size={named.size}
          weight="bold"
          numberOfLines={2}
          allowFontScaling={false}
          accessible={false}
        >
          {event.name}
        </Text>
        <Text
          size={tagged.size}
          weight="medium"
          allowFontScaling={false}
          accessible={false}
          style={styles.secondary}
        >
          {tags.join(' · ')}
        </Text>
      </View>
    </View>
  );
}

type Room = { short: boolean; laid: (room: number, least: number) => void };

const ListRoom = createContext<Room>({ short: false, laid: () => {} });

/** Layout rounding, so a list that fits to the point is not taken for one that does not. */
const SLACK = 1;

/** Under a scroll view Yoga ignores the list's flex basis, so a column carrying your events scrolls only where four rows do not fit; `listing` stays put while they load, so the column is not rebuilt under VoiceOver's focus (sc-39340). */
export function SidebarColumn({
  listing = false,
  children,
}: {
  listing?: boolean;
  children: ReactNode;
}) {
  const [short, setShort] = useState(false);
  const sizes = useRef({ viewport: 0, content: 0 });
  const laid = useCallback((room: number, least: number) => {
    if (room + SLACK >= least) return;
    sizes.current = { viewport: 0, content: 0 };
    setShort(true);
  }, []);
  const room = useMemo(() => ({ short: listing && short, laid }), [listing, short, laid]);
  const fitsAgain = () => {
    const { viewport, content } = sizes.current;
    if (viewport > 0 && content > 0 && content <= viewport + SLACK) setShort(false);
  };
  const onViewport = ({ nativeEvent }: LayoutChangeEvent) => {
    sizes.current.viewport = nativeEvent.layout.height;
    fitsAgain();
  };
  const onContent = ({ nativeEvent }: LayoutChangeEvent) => {
    sizes.current.content = nativeEvent.layout.height;
    fitsAgain();
  };

  if (listing && !short)
    return (
      <ListRoom.Provider value={room}>
        <View style={[styles.column, styles.side]}>{children}</View>
      </ListRoom.Provider>
    );

  return (
    <ScrollView
      style={styles.column}
      contentContainerStyle={styles.fills}
      onLayout={listing ? onViewport : undefined}
      showsVerticalScrollIndicator={false}
    >
      <ListRoom.Provider value={room}>
        <View style={[styles.side, styles.fills]} onLayout={listing ? onContent : undefined}>
          {children}
        </View>
      </ListRoom.Provider>
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
  const { fontScale } = useWindowDimensions();
  const heading = t('todayScreen.yourEvents').toLocaleUpperCase();
  const { size, measure } = useSideFit(heading, ROOMS.heading, fontScale, 'semibold');
  const row = Math.max(
    tokens.sizeHit,
    ROOMS.event.size * fontScale * LABEL_LINE + 2 * rowPad(fontScale),
  );
  const least =
    events.length === 0
      ? 0
      : size * LABEL_LINE + 2 * tokens.spaceXs + Math.min(events.length, LEAST_ROWS) * row;
  const { short, laid } = useContext(ListRoom);
  const room = useRef<number | null>(null);
  useEffect(() => {
    if (!short && room.current != null) laid(room.current, least);
  }, [short, laid, least]);
  const onLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    room.current = nativeEvent.layout.height;
    if (!short) laid(room.current, least);
  };

  if (events.length === 0) return <View style={styles.grow} />;

  return (
    <View style={short ? { height: least } : styles.list} onLayout={onLayout}>
      {measure}
      <Text
        size={size}
        weight="semibold"
        allowFontScaling={false}
        accessibilityRole="header"
        style={[styles.secondary, styles.caps]}
      >
        {heading}
      </Text>
      <ScrollView style={styles.rows} nestedScrollEnabled>
        {events.map((event) => (
          <SidebarEventRow key={event.id} event={event} />
        ))}
      </ScrollView>
    </View>
  );
}

function SidebarEventRow({ event }: { event: ShownEvent }) {
  const { open } = useTodayShell();
  const { fontScale } = useWindowDimensions();
  const { size, measure } = useSideFit(event.name, ROOMS.event, fontScale, 'medium', 'line');

  return (
    <Pressable
      onPress={() => open({ to: 'event', id: event.id, name: event.name })}
      style={({ pressed }) => [
        styles.event,
        { paddingVertical: rowPad(fontScale) },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={event.name}
    >
      {measure}
      <View style={[styles.dot, { backgroundColor: eventColour(event) }]} />
      <Text
        size={size}
        weight="medium"
        numberOfLines={1}
        allowFontScaling={false}
        accessible={false}
        style={[styles.grow, styles.secondary]}
      >
        {event.name}
      </Text>
    </Pressable>
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
    <SidebarColumn listing>
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
    letterSpacing: HEADING_TRACKING,
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
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingHorizontal: tokens.spaceLg,
    borderRadius: tokens.radiusRow,
    backgroundColor: tokens.colorCard,
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
  list: { flexGrow: 1, flexBasis: 0 },
  rows: { flexGrow: 1, flexBasis: 0 },
  place: {
    minHeight: tokens.sizeHit,
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
    minHeight: tokens.sizeHit,
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
    minHeight: 52,
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
