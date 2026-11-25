import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

import { EventMesh, eventColour } from '../../components/EventMesh.tsx';
import { EventThumb } from '../../components/TodayParts.tsx';
import { daysWords } from '../../kit/eventsList.ts';
import type { ShownEvent } from '../../kit/today.ts';
import { atAccessibilitySizes } from '../../layout/textSize.ts';
import { tokens } from '../../theme/tokens.ts';
import { EVENT_OF_KEY } from '../events/EventsSample.ts';
import { openEvent } from '../events/openEvent.ts';
import { openedOver } from '../events/opener.ts';
import { EVENTS } from '../today.ts';
import { FitWords } from './FitWords.tsx';
import {
  EVENT_CHIP,
  EVENT_CHIP_ON_COVER,
  EVENT_DATES,
  EVENT_NAME,
  EVENT_READY,
  SIZE_TODAY,
  type SizeEvent,
  TODAY_GUTTER,
  chipsUnderDates,
  daysUntil,
  thumbAbove,
  tileWidth,
  underName,
} from './todaySizeRules.ts';

interface Shown {
  event: ShownEvent;
  key: SizeEvent['key'];
  name: string;
  dates: string;
  count: string;
  draft: boolean;
  stage: string | null;
  ready: { words: string; spoken?: string; percent: number; track?: boolean } | null;
}

/** The product's own words for a card (kit/todayMoment), on the size demo's events. */
function useShown(events: readonly SizeEvent[], locale: string): Shown[] {
  const { t } = useTranslation();

  return events.map((one) => {
    const until = daysUntil(SIZE_TODAY, one.first);
    const share = one.invited === 0 ? 0 : Math.round((one.replied / one.invited) * 100);
    const parts =
      one.coming == null
        ? null
        : {
            coming: t('todayScreen.repliesComing', { count: one.coming }),
            replied: t('todayScreen.repliesShare', { count: share, share: share / 100 }),
          };

    return {
      event: { id: one.key, name: one.name, mesh: EVENTS[one.key].mesh, photo: null },
      key: one.key,
      name: one.name,
      dates: daysWords(
        {
          status: one.draft ? 'draft' : 'live',
          startsAt: `${one.first}T12:00:00Z`,
          endsAt: `${one.last}T12:00:00Z`,
          timeZone: 'UTC',
          concludedAt: null,
        },
        new Date(`${SIZE_TODAY}T12:00:00Z`),
        locale,
        true,
        t,
      ),
      count: one.draft
        ? t('todayScreen.draft')
        : until === 1
          ? t('todayScreen.tomorrowCapital')
          : t('todayScreen.inDaysCapital', { count: until }),
      draft: one.draft,
      stage: !one.draft && until > 0 && until <= 7 ? t('todayScreen.finalWeek') : null,
      ready: one.draft
        ? null
        : parts == null
          ? { words: t('todayScreen.invitationsNotSent'), percent: 0 }
          : {
              words: t('todayScreen.replies', parts),
              spoken: t('todayScreen.repliesSpoken', parts),
              percent: share,
              track: true,
            },
    };
  });
}

function open(key: SizeEvent['key']) {
  openEvent(EVENT_OF_KEY[key], openedOver('today'));
}

/** sc-92090: the rows under Your events, or the phone's tiles, at the stand-in size, every word whole. */
export function SizeEvents({
  events,
  locale,
  scale,
  cap,
  tiles,
}: {
  events: readonly SizeEvent[];
  locale: string;
  scale: number;
  cap: number;
  tiles: boolean;
}) {
  const shown = useShown(events, locale);

  if (tiles)
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.carousel}
        contentContainerStyle={styles.carouselRow}
      >
        {shown.map((card) => (
          <Tile key={card.key} card={card} scale={scale} cap={cap} />
        ))}
      </ScrollView>
    );

  return (
    <View style={styles.panel}>
      {shown.map((card, index) => (
        <Row key={card.key} card={card} scale={scale} cap={cap} last={index === shown.length - 1} />
      ))}
    </View>
  );
}

function Row({
  card,
  scale,
  cap,
  last,
}: {
  card: Shown;
  scale: number;
  cap: number;
  last: boolean;
}) {
  const above = thumbAbove(scale);

  return (
    <Pressable
      onPress={() => open(card.key)}
      style={({ pressed }) => [
        styles.eventRow,
        above && styles.eventRowStacked,
        !last && styles.ruled,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      testID={`demo.todaySize.event.${card.key}`}
    >
      <EventThumb event={card.event} side={56} radius={16} />
      <Words card={card} scale={scale} cap={cap} chips />
    </Pressable>
  );
}

function Tile({ card, scale, cap }: { card: Shown; scale: number; cap: number }) {
  const { width } = useWindowDimensions();
  const under = chipsUnderDates(scale);

  return (
    <Pressable
      onPress={() => open(card.key)}
      style={({ pressed }) => [
        styles.tile,
        { width: tileWidth(scale, width) },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      testID={`demo.todaySize.tile.${card.key}`}
    >
      <View style={styles.tileCover}>
        <EventMesh event={card.event} />
        {!under && (
          <View style={styles.tileChips}>
            <Chip
              words={card.count}
              draft={card.draft}
              dark={card.draft}
              cover
              size={{ scale, cap, room: 0 }}
            />
            {card.stage != null && (
              <Chip words={card.stage} stage cover size={{ scale, cap, room: 0 }} />
            )}
          </View>
        )}
      </View>
      <View style={styles.tileBody}>
        <Words card={card} scale={scale} cap={cap} chips={under} twoLines={!under} />
      </View>
    </Pressable>
  );
}

/** Each label steps down alone to the largest size its widest word fits, none larger than the name. */
function Words({
  card,
  scale,
  cap,
  chips,
  twoLines = false,
}: {
  card: Shown;
  scale: number;
  cap: number;
  chips: boolean;
  twoLines?: boolean;
}) {
  const [room, setRoom] = useState(0);
  const [name, setName] = useState<number | null>(null);
  const below = underName(cap, name);
  // From AX1 the labels under the name wait for it, so none shows at a size the name then steps under.
  const under = atAccessibilitySizes(scale) && name == null ? 0 : room;
  const chipRoom = Math.max(under - 2 * tokens.spaceMd, 0);

  return (
    <View
      style={styles.words}
      onLayout={(event: LayoutChangeEvent) => setRoom(event.nativeEvent.layout.width)}
    >
      <FitWords
        text={card.name}
        size={EVENT_NAME}
        scale={scale}
        cap={cap}
        room={room}
        weight="semibold"
        line={1.22}
        lines={twoLines ? 2 : undefined}
        style={twoLines ? styles.tileName : undefined}
        onDrawn={setName}
        testID="demo.todaySize.eventName"
      />
      <FitWords
        text={card.dates}
        size={EVENT_DATES}
        scale={scale}
        cap={below}
        room={under}
        weight="medium"
        line={1.22}
        style={[styles.secondary, styles.dates]}
        testID="demo.todaySize.eventDates"
      />
      {chips && (
        <View style={styles.rowChips}>
          <Chip
            words={card.count}
            draft={card.draft}
            size={{ scale, cap: below, room: chipRoom }}
          />
          {card.stage != null && (
            <Chip words={card.stage} stage size={{ scale, cap: below, room: chipRoom }} />
          )}
        </View>
      )}
      {card.ready != null && (
        <View style={styles.ready}>
          {(card.ready.percent > 0 || card.ready.track === true) && (
            <View style={styles.track}>
              <View
                style={[
                  styles.progress,
                  { width: `${card.ready.percent}%`, backgroundColor: eventColour(card.event) },
                ]}
              />
            </View>
          )}
          <View accessibilityLabel={card.ready.spoken} accessible={card.ready.spoken != null}>
            <FitWords
              text={card.ready.words}
              size={EVENT_READY}
              scale={scale}
              cap={below}
              room={under}
              weight="medium"
              line={1.22}
              style={styles.secondary}
              testID="demo.todaySize.eventReady"
            />
          </View>
        </View>
      )}
    </View>
  );
}

function Chip({
  words,
  draft = false,
  dark = false,
  stage = false,
  cover = false,
  size,
}: {
  words: string;
  draft?: boolean;
  dark?: boolean;
  stage?: boolean;
  cover?: boolean;
  size: { scale: number; cap: number; room: number };
}) {
  const look = stage
    ? cover
      ? styles.stageOnCover
      : styles.stage
    : draft
      ? cover
        ? styles.chipDark
        : styles.chipDraft
      : styles.chipLight;
  const ink =
    dark || (stage && cover)
      ? styles.onAccent
      : stage
        ? styles.accentText
        : draft
          ? styles.secondary
          : undefined;

  return (
    <View style={[styles.chip, !cover && styles.chipSmall, look]}>
      <FitWords
        text={words}
        size={cover ? EVENT_CHIP_ON_COVER : EVENT_CHIP}
        scale={size.scale}
        cap={size.cap}
        room={size.room}
        weight="semibold"
        line={1.22}
        style={[styles.chipWords, ink]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: tokens.colorInset,
    borderRadius: tokens.space3xl,
    paddingVertical: tokens.spaceHair,
    paddingHorizontal: tokens.spaceXl,
  },
  eventRow: { flexDirection: 'row', gap: tokens.spacePillEnd, paddingVertical: 13 },
  eventRowStacked: { flexDirection: 'column', alignItems: 'stretch', gap: tokens.spaceMd },
  ruled: { borderBottomWidth: 1, borderBottomColor: tokens.colorBorder },
  pressed: { opacity: 0.7 },
  words: { flex: 1, minWidth: 0, gap: tokens.spaceHair },
  secondary: { color: tokens.colorInkSecondary },
  accentText: { color: tokens.colorAccentText },
  onAccent: { color: tokens.colorInkOnDark },
  dates: { marginTop: tokens.spaceHair },
  rowChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spaceXs,
    marginTop: tokens.spaceSm,
  },
  chip: {
    minHeight: 26,
    paddingVertical: tokens.spaceHair,
    paddingHorizontal: 11,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    flexShrink: 1,
  },
  chipWords: { flexShrink: 1 },
  chipSmall: {
    minHeight: tokens.space3xl,
    paddingHorizontal: tokens.spaceMd,
    borderRadius: tokens.spaceLg,
  },
  chipLight: { backgroundColor: tokens.colorCard },
  chipDark: { backgroundColor: tokens.scrimDialog },
  chipDraft: { backgroundColor: tokens.colorBorder },
  stage: { backgroundColor: tokens.colorAccentTint },
  stageOnCover: { backgroundColor: tokens.colorAccent },
  ready: { gap: tokens.spaceXs, marginTop: 9 },
  track: { height: 5, borderRadius: 5, backgroundColor: tokens.colorBorder, overflow: 'hidden' },
  progress: { height: 5, borderRadius: 5 },
  carousel: { marginHorizontal: -TODAY_GUTTER },
  carouselRow: { paddingHorizontal: TODAY_GUTTER, gap: tokens.spaceLg, alignItems: 'flex-start' },
  tile: {
    backgroundColor: tokens.colorInset,
    borderRadius: tokens.space3xl,
    overflow: 'hidden',
  },
  tileCover: { height: 124, overflow: 'hidden' },
  tileChips: {
    position: 'absolute',
    left: tokens.spaceMd,
    right: tokens.spaceMd,
    top: tokens.spaceMd,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: tokens.spaceXs,
  },
  tileBody: {
    paddingTop: tokens.spaceLg,
    paddingHorizontal: tokens.spacePillEnd,
    paddingBottom: tokens.spacePillEnd,
  },
  tileName: { minHeight: 39 },
});
