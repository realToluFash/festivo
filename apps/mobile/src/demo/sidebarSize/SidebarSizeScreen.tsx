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
import { Text } from '../../components/Text.tsx';
import { MeasuredWords } from '../../components/Title.tsx';
import { AREA_GLYPH } from '../../components/areaGlyph.ts';
import { cardTags } from '../../kit/eventsList.ts';
import { nameLines, wordsIn } from '../../layout/textSize.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import type { WeightName } from '../../theme/fonts.ts';
import { tokens } from '../../theme/tokens.ts';
import { Choices } from '../focusedHeader/FocusedHeaderScreen.tsx';
import { shownEvent } from '../events/EventsModel.ts';
import { AREAS, EVENT_OF_KEY, sampleEvent } from '../events/EventsSample.ts';
import { SAMPLE } from '../samples.ts';
import { SIDEBAR_EVENTS } from '../sideEvents.ts';
import {
  CARD_THUMB,
  OPENER_GLYPH,
  ORG_MARK,
  PERSON_GLYPH,
  ROOMS,
  SIDEBAR_LANGUAGES,
  SIDEBAR_PLACES,
  SIDEBAR_SIZES,
  SIDEBAR_WIDTH,
  HEADING_TRACKING,
  type SideRoom,
  lettersIn,
  type SidebarAt,
  type SidebarLanguage,
  type SidebarSize,
  glyphSide,
  rowPad,
  sideTextSize,
  sidebarScale,
} from './sidebarSizeRules.ts';

export interface SidebarSizeStart {
  size: SidebarSize;
  language: SidebarLanguage;
  at: SidebarAt;
}

/** iPad landscape's sidebar at a text size and language the board chooses: each row grows to hold its words, and each word stays whole in the 252 column. */
export function SidebarSizeScreen({ start }: { start: SidebarSizeStart }) {
  const { i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const [size, setSize] = useState(start.size);
  const [language, setLanguage] = useState(start.language);
  const [at, setAt] = useState(start.at);
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
        <Sidebar scale={scale} at={at} onAt={setAt} t={t} />
      </ScrollView>
      <ScrollView
        style={styles.page}
        contentContainerStyle={[styles.pageBody, { paddingTop: insets.top + tokens.space3xl }]}
      >
        <DemoOnly title="Stand-ins for the iPad’s own text size and language, and the page beside the sidebar. The sidebar is main’s 252 column at every size. Through the ninth step it draws as on main; from the tenth each row grows to hold its words and each label steps down only where its widest word would break beside its glyph, never below its size on main. Each place opens here what it opens in the app; the organisation pill and the person open nothing in this board.">
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
        </DemoOnly>
      </ScrollView>
    </View>
  );
}

function Sidebar({
  scale,
  at,
  onAt,
  t,
}: {
  scale: number;
  at: SidebarAt;
  onAt: (at: SidebarAt) => void;
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
      <Org scale={scale} />
      {inEvent ? (
        <InEvent scale={scale} onBack={() => onAt('events')} t={t} />
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

/** A text's size in the sidebar, from its words measured hidden at its full size. */
function useFit(text: string, room: SideRoom, scale: number, weight: WeightName, oneLine = false) {
  const start = room.size * scale;
  const words = wordsIn([text]);
  const key = `${start}|${weight}|${text}`;
  const [measured, setMeasured] = useState<{ key: string; widths: Record<string, number> }>({
    key: '',
    widths: {},
  });
  const widths = measured.key === key ? measured.widths : {};
  const whole = widths[`\n${text}`];
  const known = whole != null && words.every((word) => widths[word] != null);
  const size = sideTextSize(
    room,
    scale,
    known
      ? {
          words: words.map((word) => ({ width: widths[word] ?? 0, letters: lettersIn(word) })),
          whole: { width: whole, letters: lettersIn(text) },
        }
      : null,
    oneLine,
  );
  const keep = (name: string, width: number) =>
    setMeasured((now) => {
      const kept = now.key === key ? now.widths : {};

      return kept[name] === width ? now : { key, widths: { ...kept, [name]: width } };
    });

  return {
    size,
    measure: (
      <>
        <MeasuredWords
          words={words}
          size={start}
          weight={weight}
          allowFontScaling={false}
          onWidth={keep}
        />
        <MeasuredWords
          words={[text]}
          size={start}
          weight={weight}
          allowFontScaling={false}
          onWidth={(_, width) => keep(`\n${text}`, width)}
        />
      </>
    ),
  };
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
  const { size, measure } = useFit(label, ROOMS.place, scale, weight);
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

function Org({ scale }: { scale: number }) {
  const { size, measure } = useFit(SAMPLE.organisation, ROOMS.org, scale, 'semibold', true);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.org,
        { paddingVertical: rowPad(scale) },
        pressed && styles.orgOpen,
      ]}
      accessibilityRole="button"
      accessibilityLabel={SAMPLE.organisation}
      testID="demo.sidebar.org"
    >
      {measure}
      <OrgMark id="ire" name={SAMPLE.organisation} side={ORG_MARK} />
      <Text
        size={size}
        weight="semibold"
        numberOfLines={1}
        allowFontScaling={false}
        accessible={false}
        style={styles.grow}
      >
        {SAMPLE.organisation}
      </Text>
      <Glyph name="updown" size={OPENER_GLYPH} ink={tokens.colorInkSecondary} />
    </Pressable>
  );
}

function Search({ scale, label }: { scale: number; label: string }) {
  const { size, measure } = useFit(label, ROOMS.search, scale, 'medium');

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
  const { size, measure } = useFit(caps, ROOMS.heading, scale, 'semibold');

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
  const { size, measure } = useFit(event.name, ROOMS.event, scale, 'medium', true);

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
  const { size, measure } = useFit(back, ROOMS.back, scale, 'semibold');

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
  const name = useFit(event?.name ?? '', ROOMS.cardName, scale, 'bold');
  const tagged = useFit(tags, ROOMS.cardTags, scale, 'medium');
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
  const name = useFit(SAMPLE.name, ROOMS.person, scale, 'semibold', lines === 1);
  const roleFit = useFit(role, ROOMS.role, scale, 'medium');

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
