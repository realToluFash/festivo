import type { TFunction } from 'i18next';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand } from '../../components/Brand.tsx';
import { EventMesh, eventColour } from '../../components/EventMesh.tsx';
import { EventThumb } from '../../components/EventThumb.tsx';
import { Glyph, type GlyphName } from '../../components/Glyph.tsx';
import { Initials } from '../../components/Initials.tsx';
import { OrgMark } from '../../components/OrgMark.tsx';
import { Text, TitleCap } from '../../components/Text.tsx';
import { AREA_GLYPH } from '../../components/areaGlyph.ts';
import { cardTags } from '../../kit/eventsList.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { Choices } from '../focusedHeader/FocusedHeaderScreen.tsx';
import { shownEvent } from '../events/EventsModel.ts';
import { AREAS, EVENT_OF_KEY, sampleEvent } from '../events/EventsSample.ts';
import { SAMPLE } from '../samples.ts';
import { SIDEBAR_EVENTS } from '../sideEvents.ts';
import { useSideFit } from '../../components/sideFit.tsx';
import {
  CARD_THUMB,
  HEADING_TRACKING,
  OPENER_GLYPH,
  ORG_MARK,
  PERSON_GLYPH,
  ROOMS,
  glyphSide,
  rowPad,
} from '../../layout/sidebarSize.ts';
import { PANE_TITLE } from '../../components/topTitle.ts';
import {
  SIDEBAR_WIDTH,
  atAccessibilitySizes,
  nameLines,
  titleSize,
} from '../../layout/textSize.ts';
import {
  SIDEBAR_LANGUAGES,
  SIDEBAR_ORGS,
  SIDEBAR_PLACES,
  SIDEBAR_SIZES,
  type SidebarAt,
  type SidebarLanguage,
  type SidebarOrg,
  type SidebarSize,
  sidebarOrgName,
  sidebarScale,
} from './sidebarSizeRules.ts';

export interface SidebarSizeStart {
  size: SidebarSize;
  language: SidebarLanguage;
  at: SidebarAt;
  org: SidebarOrg;
}

/** iPad landscape's sidebar at a text size and language the board chooses: each row grows to hold its words, and each word stays whole in the 252 column. */
export function SidebarSizeScreen({ start }: { start: SidebarSizeStart }) {
  const { i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const [size, setSize] = useState(start.size);
  const [language, setLanguage] = useState(start.language);
  const [at, setAt] = useState(start.at);
  const [org, setOrg] = useState(start.org);
  const words = useMemo(
    () => i18n.cloneInstance({ lng: language, initAsync: false }),
    [i18n, language],
  );
  const t = words.t.bind(words) as TFunction;
  const scale = sidebarScale(size, fontScale);

  return (
    <View style={styles.frame}>
      <ScrollView
        key={`${size}|${language}`}
        style={styles.column}
        contentContainerStyle={[
          styles.side,
          { paddingTop: insets.top + 22, paddingBottom: insets.bottom + tokens.spacePillEnd },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Sidebar scale={scale} at={at} onAt={setAt} org={org} t={t} />
      </ScrollView>
      <ScrollView
        style={styles.page}
        contentContainerStyle={[styles.pageBody, { paddingTop: insets.top + tokens.space3xl }]}
      >
        <DemoOnly title="Stand-ins for the iPad’s own text size and language, the organisation’s name, and the page beside the sidebar. The sidebar is main’s 252 column at every size. Below the tenth step it draws as on main, except that a label whose widest word would break beside main’s glyph steps down alone, as Événements does at the ninth step in French, and a name main’s size would cut steps down until it fits its lines, from the fifth step. Organisation chooses the pill’s name: Ire Events fits at main’s size at the eighth step, and QA Organisation steps down there to read whole on one line. From the tenth each row grows to hold its words and each label steps down only where its widest word would break beside its glyph, never below its size on main. Each place opens here what it opens in the app; the organisation pill and the person open nothing in this board.">
          <Choices
            heading="Text size"
            options={SIDEBAR_SIZES}
            chosen={size}
            onChoose={setSize}
            id="size"
            prefix="demo.sidebar"
          />
          <Choices
            heading="Language"
            options={SIDEBAR_LANGUAGES}
            chosen={language}
            onChoose={setLanguage}
            id="language"
            prefix="demo.sidebar"
          />
          <Choices
            heading="Page"
            options={SIDEBAR_PLACES}
            chosen={at}
            onChoose={setAt}
            id="at"
            prefix="demo.sidebar"
          />
          <Choices
            heading="Organisation"
            options={SIDEBAR_ORGS}
            chosen={org}
            onChoose={setOrg}
            id="org"
            prefix="demo.sidebar"
          />
        </DemoOnly>
      </ScrollView>
    </View>
  );
}

function Sidebar({
  scale,
  at,
  onAt,
  org,
  t,
}: {
  scale: number;
  at: SidebarAt;
  onAt: (at: SidebarAt) => void;
  org: SidebarOrg;
  t: TFunction;
}) {
  const inEvent = at === 'event';
  const settings = (
    <Place
      label={t('todayScreen.tab.settings')}
      glyph="settings"
      on={at === 'members'}
      onPress={() => onAt('members')}
      scale={scale}
      testID="demo.sidebar.settings"
    />
  );

  return (
    <>
      <View style={styles.logo}>
        <Brand lockup height={24} />
      </View>
      <Org scale={scale} org={org} />
      {inEvent ? (
        <TitleCap.Provider
          value={atAccessibilitySizes(scale) ? titleSize(PANE_TITLE, scale) : null}
        >
          <InEvent scale={scale} onBack={() => onAt('events')} t={t} />
        </TitleCap.Provider>
      ) : (
        <>
          <Search scale={scale} label={t('todayScreen.search')} />
          <View style={styles.places} accessibilityRole="tablist">
            {(
              [
                ['today', 'today'],
                ['events', 'events'],
                ['calendar', 'calendar'],
              ] as const
            ).map(([place, glyph]) => (
              <Place
                key={place}
                label={t(`todayScreen.tab.${glyph}`)}
                glyph={glyph}
                on={at === place}
                onPress={() => onAt(place)}
                scale={scale}
                testID={`demo.sidebar.${place}`}
              />
            ))}
          </View>
          <YourEvents
            scale={scale}
            heading={t('todayScreen.yourEvents')}
            onOpen={() => onAt('event')}
          />
        </>
      )}
      <View style={styles.grow} />
      <View style={styles.places} accessibilityRole="tablist">
        {settings}
      </View>
      <Person
        scale={scale}
        role={t('roles.owner')}
        label={t('todayScreen.personRole', { name: SAMPLE.name, role: t('roles.owner') })}
      />
    </>
  );
}

function Place({
  label,
  glyph,
  on,
  onPress,
  scale,
  testID,
}: {
  label: string;
  glyph: GlyphName;
  on: boolean;
  onPress: () => void;
  scale: number;
  testID: string;
}) {
  const weight = on ? 'semibold' : 'medium';
  const { size, measure } = useSideFit(label, ROOMS.place, scale, weight);
  const ink = on ? tokens.colorInk : tokens.colorInkSecondary;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.place,
        { paddingVertical: rowPad(scale) },
        on && styles.placeOn,
        pressed && styles.pressed,
      ]}
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
      testID={testID}
    >
      {measure}
      <Glyph name={glyph} size={glyphSide(ROOMS.place, scale, size)} ink={ink} />
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

function Org({ scale, org }: { scale: number; org: SidebarOrg }) {
  const name = sidebarOrgName(org);
  const { size, measure } = useSideFit(name, ROOMS.org, scale, 'semibold', 'line');

  return (
    <Pressable
      style={({ pressed }) => [
        styles.org,
        { paddingVertical: rowPad(scale) },
        pressed && styles.orgOpen,
      ]}
      accessibilityRole="button"
      accessibilityLabel={name}
      testID="demo.sidebar.org"
    >
      {measure}
      <OrgMark id={org} name={name} side={ORG_MARK} />
      <Text
        size={size}
        weight="semibold"
        numberOfLines={1}
        allowFontScaling={false}
        accessible={false}
        style={styles.grow}
      >
        {name}
      </Text>
      <Glyph name="updown" size={OPENER_GLYPH} ink={tokens.colorInkSecondary} />
    </Pressable>
  );
}

function Search({ scale, label }: { scale: number; label: string }) {
  const { size, measure } = useSideFit(label, ROOMS.search, scale, 'medium');

  return (
    <Pressable
      style={[styles.search, { paddingVertical: rowPad(scale) }]}
      accessibilityRole="search"
      accessibilityLabel={label}
    >
      {measure}
      <Glyph
        name="search"
        size={glyphSide(ROOMS.search, scale, size)}
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

function YourEvents({
  scale,
  heading,
  onOpen,
}: {
  scale: number;
  heading: string;
  onOpen: () => void;
}) {
  const caps = heading.toLocaleUpperCase();
  const { size, measure } = useSideFit(caps, ROOMS.heading, scale, 'semibold');

  return (
    <View style={styles.list}>
      {measure}
      <Text
        size={size}
        weight="semibold"
        allowFontScaling={false}
        accessibilityRole="header"
        style={[styles.secondary, styles.caps]}
      >
        {caps}
      </Text>
      {SIDEBAR_EVENTS.map((event) => (
        <EventRow key={event.id} event={event} scale={scale} onOpen={onOpen} />
      ))}
    </View>
  );
}

function EventRow({
  event,
  scale,
  onOpen,
}: {
  event: (typeof SIDEBAR_EVENTS)[number];
  scale: number;
  onOpen: () => void;
}) {
  const { size, measure } = useSideFit(event.name, ROOMS.event, scale, 'medium', 'line');

  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [
        styles.event,
        { paddingVertical: rowPad(scale) },
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

const CARD_EVENT = sampleEvent(EVENT_OF_KEY.wed);

function InEvent({ scale, onBack, t }: { scale: number; onBack: () => void; t: TFunction }) {
  const [area, setArea] = useState<(typeof AREAS)[number]>('overview');
  const back = t('todayScreen.tab.events');
  const { size, measure } = useSideFit(back, ROOMS.back, scale, 'semibold');

  return (
    <>
      <Pressable
        onPress={onBack}
        style={({ pressed }) => [
          styles.back,
          { paddingVertical: rowPad(scale) },
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('frame.backTo', { place: back })}
        testID="demo.sidebar.back"
      >
        {measure}
        <Glyph
          name="back"
          size={glyphSide(ROOMS.back, scale, size)}
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
          {back}
        </Text>
      </Pressable>
      {CARD_EVENT != null && <Card scale={scale} t={t} />}
      <View style={styles.places} accessibilityRole="tablist">
        {AREAS.map((one) => (
          <Place
            key={one}
            label={t(`eventNav.${one}`)}
            glyph={AREA_GLYPH[one]}
            on={one === area}
            onPress={() => setArea(one)}
            scale={scale}
            testID={`demo.sidebar.${one}`}
          />
        ))}
      </View>
    </>
  );
}

function Card({ scale, t }: { scale: number; t: TFunction }) {
  const now = useMemo(() => new Date(), []);
  const event = useMemo(() => (CARD_EVENT == null ? null : shownEvent(CARD_EVENT, now)), [now]);
  const tags =
    event == null
      ? ''
      : cardTags(event, now, t)
          .map((tag) => tag.word)
          .join(' · ');
  const name = useSideFit(event?.name ?? '', ROOMS.cardName, scale, 'bold', 'lines');
  const tagged = useSideFit(tags, ROOMS.cardTags, scale, 'medium');
  if (event == null) return null;

  return (
    <View style={styles.card} accessible accessibilityLabel={`${event.name}. ${tags}`}>
      {name.measure}
      {tagged.measure}
      <EventThumb event={event} side={CARD_THUMB} radius={12} />
      <View style={styles.grow}>
        <Text
          size={name.size}
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
          {tags}
        </Text>
      </View>
    </View>
  );
}

function Person({ scale, role, label }: { scale: number; role: string; label: string }) {
  const lines = nameLines(scale);
  const name = useSideFit(
    SAMPLE.name,
    ROOMS.person,
    scale,
    'semibold',
    lines === 1 ? 'line' : 'lines',
  );
  const roleFit = useSideFit(role, ROOMS.role, scale, 'medium');

  return (
    <Pressable
      style={({ pressed }) => [
        styles.person,
        { paddingVertical: rowPad(scale) },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID="demo.sidebar.person"
    >
      {name.measure}
      {roleFit.measure}
      <View
        style={styles.avatar}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <EventMesh event={{ mesh: 'amber', photo: null }} />
        <Initials name={SAMPLE.name} size={12} weight="bold" />
      </View>
      <View style={styles.grow}>
        <Text
          size={name.size}
          weight="semibold"
          numberOfLines={lines}
          allowFontScaling={false}
          accessible={false}
        >
          {SAMPLE.name}
        </Text>
        <Text
          size={roleFit.size}
          weight="medium"
          allowFontScaling={false}
          accessible={false}
          style={styles.secondary}
        >
          {role}
        </Text>
      </View>
      <Glyph name="updown" size={PERSON_GLYPH} ink={tokens.colorInkSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, flexDirection: 'row', backgroundColor: tokens.colorPage },
  column: { width: SIDEBAR_WIDTH, flexGrow: 0 },
  side: {
    flexGrow: 1,
    paddingHorizontal: tokens.spacePillEnd,
    gap: tokens.spacePillEnd,
  },
  page: { flex: 1, backgroundColor: tokens.colorCard },
  pageBody: { padding: tokens.space3xl },
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  pressed: { opacity: tokens.opacityPressed },
  logo: { height: 30, justifyContent: 'center', paddingHorizontal: tokens.spaceMd },
  org: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingLeft: tokens.spaceSm,
    paddingRight: tokens.spaceMd,
    borderRadius: tokens.radiusRow,
  },
  orgOpen: { backgroundColor: tokens.colorCard },
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
  list: { gap: 0 },
  caps: {
    letterSpacing: HEADING_TRACKING,
    paddingHorizontal: tokens.spaceLg,
    paddingVertical: tokens.spaceXs,
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
  back: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    paddingHorizontal: tokens.spaceMd,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    padding: tokens.spaceMd,
    borderRadius: tokens.spaceXl,
    backgroundColor: tokens.colorCard,
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
