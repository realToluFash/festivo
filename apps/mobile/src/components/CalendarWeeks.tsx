import { type CalendarMonth, weekdayNames } from '@soirely/domain';
import { memo, type Ref, useEffect, useMemo, useRef } from 'react';
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  View,
  type ViewInstance,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  type Item,
  type Piece,
  type Week,
  type WeekLook,
  barLook,
  barWords,
  dayLabel,
  dayNumber,
  firstNamed,
  isYou,
  markWords,
  monthKey,
  offRule,
  offsetsOf,
  piecesOf,
  rowsTop,
  shownIn,
  topIndex,
  weekHeight,
} from '../kit/calendar.ts';
import { tokens } from '../theme/tokens.ts';
import { eventColour } from './EventMesh.tsx';
import { Glyph } from './Glyph.tsx';
import { type MarkKind, ShapeMark } from './StatusMark.tsx';
import { Text } from './Text.tsx';

/** Whether a milestone is drawn late: the demo's Only what needs you marks a passed one. */
export type LateOf = (item: Item) => boolean;

const NEVER_LATE: LateOf = () => false;

const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

/** The grid's words are drawn at their own sizes, and at the largest text by the big look, so the lanes keep their measure. */
const FIXED = 1;

export interface GridLook {
  week: WeekLook;
  /** The iPad's: names and words on every bar, a milestone's title after its time. */
  wide: boolean;
  /** The largest text: bars with no words, "+n" for more. */
  big: boolean;
}

/** Main's Event square: a small box with a bar inside, drawn so no fallback font draws ▦. */
export function EventSquare({
  side = 9,
  ink = tokens.colorInkSecondary,
  border = 1.6,
}: {
  side?: number;
  ink?: string;
  border?: number;
}) {
  return (
    <View
      {...hidden}
      style={[styles.square, { width: side, height: side, borderWidth: border, borderColor: ink }]}
    >
      <View
        style={{
          width: Math.max(1, Math.round(side - 2 * border - 3)),
          height: 1.4,
          backgroundColor: ink,
        }}
      />
    </View>
  );
}

/** Main's You shape, ●, drawn as a filled circle. */
export function YouDot({
  side = 8,
  ink = tokens.colorAttentionText,
}: {
  side?: number;
  ink?: string;
}) {
  return (
    <View
      {...hidden}
      style={{ width: side, height: side, borderRadius: side / 2, backgroundColor: ink }}
    />
  );
}

export function markOf(kind: string | undefined): MarkKind | null {
  return kind === 'notyet' || kind === 'paused' || kind === 'ended' ? kind : null;
}

export function WeekdayHeads({
  firstDay,
  locale,
  width,
  look,
}: {
  firstDay: number;
  locale: string;
  width: number;
  look: GridLook;
}) {
  const names = weekdayNames(locale, firstDay, look.wide ? 'short' : 'narrow');
  const size = look.big ? 24 : 12;

  return (
    <View {...hidden} style={styles.heads}>
      {names.map((name, index) => (
        <View key={index} style={[styles.head, { width: width / 7 }]}>
          <Text
            size={size}
            weight="semibold"
            numberOfLines={1}
            maxFontSizeMultiplier={FIXED}
            accessible={false}
            style={[
              styles.secondary,
              { width: look.wide ? undefined : look.week.numH, lineHeight: look.big ? 32 : 22 },
              !look.wide && styles.centred,
            ]}
          >
            {name}
          </Text>
        </View>
      ))}
    </View>
  );
}

function DayNumber({
  day,
  today,
  lit,
  look,
  locale,
}: {
  day: string;
  today: string;
  lit: boolean;
  look: GridLook;
  locale: string;
}) {
  const side = look.week.numH;
  const size = look.big ? 24 : 13;

  if (day.endsWith('-01') && day !== today)
    return (
      <View style={[styles.first, { height: side }]}>
        <Text
          size={Math.max(12.5, size - 0.5)}
          weight="bold"
          numberOfLines={1}
          maxFontSizeMultiplier={FIXED}
          accessible={false}
          style={styles.accent}
        >
          {firstNamed(day, locale)}
        </Text>
      </View>
    );

  const on = day === today || lit;

  return (
    <View
      style={[
        styles.disc,
        { width: side, height: side, borderRadius: side / 2 },
        day === today ? styles.discToday : lit ? styles.discLit : null,
      ]}
    >
      <Text
        size={size}
        weight={on ? 'bold' : 'semibold'}
        maxFontSizeMultiplier={FIXED}
        accessible={false}
        style={[styles.figures, day === today ? styles.onDark : lit ? styles.accent : styles.ink]}
      >
        {dayNumber(day, locale)}
      </Text>
    </View>
  );
}

function Bar({
  piece,
  width,
  look,
}: {
  piece: Extract<Piece, { kind: 'bar' }>;
  width: number;
  look: GridLook;
}) {
  const { t } = useTranslation();
  const { event, lane, from, to, first, last } = piece;
  const { rowH, gap } = look.week;
  const left = from * width + (first ? 2 : 0);
  const radius = rowH >= 18 ? 6 : 4;
  const kind = barLook(event);
  const dot = eventColour(event);
  const mark = markOf(offRule(event, t)?.kind);
  const words = look.big ? '' : barWords(event, look.wide, to - from + 1, t);

  return (
    <View
      style={[
        styles.bar,
        {
          left,
          top: rowsTop(look.week) + lane * (rowH + gap),
          width: (to + 1) * width - (last ? 2 : 0) - left,
          height: rowH,
          paddingLeft: first ? 7 : 5,
          borderTopLeftRadius: first ? radius : 0,
          borderBottomLeftRadius: first ? radius : 0,
          borderTopRightRadius: last ? radius : 0,
          borderBottomRightRadius: last ? radius : 0,
        },
        kind === 'sunk' && styles.barSunk,
        kind === 'draft' && { borderWidth: 1.5, borderColor: dot, paddingLeft: first ? 5.5 : 3.5 },
      ]}
    >
      {kind === 'tint' && (
        <View style={[StyleSheet.absoluteFill, styles.tint, { backgroundColor: dot }]} />
      )}
      {first && kind !== 'draft' && (
        <View
          style={[
            styles.stripe,
            { backgroundColor: kind === 'sunk' ? tokens.colorInkTertiary : dot },
          ]}
        />
      )}
      {mark != null && <ShapeMark kind={mark} side={10} ink={tokens.colorInkSecondary} />}
      {words !== '' && (
        <Text
          size={look.wide ? 12.5 : 12}
          weight="semibold"
          numberOfLines={1}
          maxFontSizeMultiplier={FIXED}
          accessible={false}
          style={[
            styles.grow,
            kind === 'sunk' ? styles.secondary : styles.ink,
            { lineHeight: rowH },
          ]}
        >
          {words}
        </Text>
      )}
    </View>
  );
}

function MarkShape({ item, late }: { item: Item; late: boolean }) {
  if (late) return <Glyph name="clock" size={11} ink={tokens.colorBroken} weight={2.4} />;

  return isYou(item) ? <YouDot side={8} /> : <EventSquare />;
}

function Mark({
  piece,
  width,
  look,
  locale,
  lateOf,
}: {
  piece: Extract<Piece, { kind: 'mark' }>;
  width: number;
  look: GridLook;
  locale: string;
  lateOf: LateOf;
}) {
  const { rowH, gap } = look.week;
  const late = lateOf(piece.item);

  return (
    <View
      style={[
        styles.mark,
        {
          left: piece.col * width + 5,
          top: rowsTop(look.week) + piece.lane * (rowH + gap),
          width: width - 9,
          height: rowH,
        },
      ]}
    >
      <MarkShape item={piece.item} late={late} />
      {!look.big && (
        <Text
          size={look.wide ? 12.5 : 12}
          weight={late ? 'semibold' : 'medium'}
          numberOfLines={1}
          maxFontSizeMultiplier={FIXED}
          accessible={false}
          style={[
            styles.grow,
            late ? styles.late : styles.secondary,
            styles.figures,
            { lineHeight: rowH },
          ]}
        >
          {markWords(piece.item, look.wide, locale)}
        </Text>
      )}
    </View>
  );
}

function DayCell({
  day,
  index,
  width,
  height,
  count,
  today,
  lit,
  look,
  locale,
  onDay,
}: {
  day: string;
  index: number;
  width: number;
  height: number;
  count: number;
  today: string;
  lit: boolean;
  look: GridLook;
  locale: string;
  onDay: (day: string, opener: ViewInstance | null) => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<ViewInstance>(null);

  return (
    <Pressable
      ref={ref}
      onPress={() => onDay(day, ref.current)}
      style={[styles.day, { left: index * width, width, height }]}
      accessibilityRole="button"
      accessibilityLabel={dayLabel(day, today, count, locale, t)}
      accessibilityState={{ selected: lit }}
      testID={`calendar.day.${day}`}
    >
      {({ pressed }) => (
        <>
          {(lit || pressed) && <View style={styles.lit} />}
          {index > 0 && <View style={styles.between} />}
          <View style={[styles.number, { top: look.week.padT }]}>
            <DayNumber day={day} today={today} lit={lit} look={look} locale={locale} />
          </View>
        </>
      )}
    </Pressable>
  );
}

export const WeekRow = memo(function WeekRow({
  week,
  width,
  look,
  today,
  lit,
  locale,
  lateOf,
  walked,
  onDay,
}: {
  week: Week;
  width: number;
  look: GridLook;
  today: string;
  lit: string | null;
  locale: string;
  lateOf: LateOf;
  /** Out of the pinned month, a week is left to scrolling, so a screen reader walks that month's weeks. */
  walked: boolean;
  onDay: (day: string, opener: ViewInstance | null) => void;
}) {
  const { t } = useTranslation();
  const cw = width / 7;
  const height = weekHeight(week, look.week);
  const { fit, rowH, gap, moreH } = look.week;
  const pieces = piecesOf(week, fit);

  return (
    <View
      style={[styles.week, { height }]}
      {...(walked ? {} : hidden)}
      testID={`calendar.week.${week.start}`}
    >
      <View style={styles.rule} />
      {week.cells.map((cell, index) => (
        <DayCell
          key={cell.day}
          day={cell.day}
          index={index}
          width={cw}
          height={height}
          count={cell.items.length}
          today={today}
          lit={lit === cell.day}
          look={look}
          locale={locale}
          onDay={onDay}
        />
      ))}
      <View {...hidden} style={StyleSheet.absoluteFill} pointerEvents="none">
        {pieces.map((piece) =>
          piece.kind === 'bar' ? (
            <Bar key={`bar-${piece.event.id}`} piece={piece} width={cw} look={look} />
          ) : (
            <Mark
              key={`mark-${piece.col}-${piece.lane}`}
              piece={piece}
              width={cw}
              look={look}
              locale={locale}
              lateOf={lateOf}
            />
          ),
        )}
        {week.cells.map((cell, index) => {
          const { more } = shownIn(cell, fit);

          return (
            more > 0 && (
              <Text
                key={`more-${cell.day}`}
                size={look.big ? 22 : 12}
                weight="semibold"
                numberOfLines={1}
                maxFontSizeMultiplier={FIXED}
                accessible={false}
                style={[
                  styles.more,
                  styles.secondary,
                  styles.figures,
                  {
                    left: index * cw + 4,
                    top: rowsTop(look.week) + fit * (rowH + gap),
                    lineHeight: moreH - 2,
                  },
                ]}
              >
                {look.big
                  ? t('calendar.more', { count: more })
                  : t('calendar.moreItems', { count: more })}
              </Text>
            )
          );
        })}
      </View>
    </View>
  );
});

/** Where the weeks will fill while the calendar loads: the real dates, with Sunk bars. */
const SKELETON: readonly (readonly [number, number, number])[][] = [
  [
    [4, 0, 3],
    [4, 1, 1],
  ],
  [
    [4, 0, 2],
    [5, 1, 2],
    [6, 0, 1],
  ],
  [],
  [[4, 0, 1]],
  [[6, 0, 1]],
  [],
];

export function LoadingWeeks({
  weeks,
  width,
  look,
  today,
  locale,
}: {
  weeks: readonly Week[];
  width: number;
  look: GridLook;
  today: string;
  locale: string;
}) {
  const cw = width / 7;
  const { rowH, gap, padB, minH } = look.week;
  const height = Math.max(minH, rowsTop(look.week) + 2 * (rowH + gap) + padB);

  return (
    <View {...hidden} testID="calendar.loadingWeeks">
      {weeks.map((week, row) => (
        <View key={week.start} style={[styles.week, { height }]}>
          <View style={styles.rule} />
          {week.cells.map((cell, index) => (
            <View key={cell.day} style={[styles.day, { left: index * cw, width: cw, height }]}>
              {index > 0 && <View style={styles.between} />}
              <View style={[styles.number, { top: look.week.padT }]}>
                <DayNumber day={cell.day} today={today} lit={false} look={look} locale={locale} />
              </View>
            </View>
          ))}
          {(SKELETON[row % SKELETON.length] ?? []).map(([col, lane, span]) => (
            <View
              key={`${col}-${lane}`}
              style={[
                styles.skeleton,
                {
                  left: col * cw + 2,
                  top: rowsTop(look.week) + lane * (rowH + gap),
                  width: span * cw - 4,
                  height: rowH,
                },
              ]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

/** The endless scroll of weeks, each as tall as its busiest day, with the top week's month pinned above. */
export function WeekList({
  weeks,
  width,
  look,
  today,
  lit,
  pinned,
  locale,
  lateOf = NEVER_LATE,
  start,
  bottom,
  onDay,
  onTop,
  listRef,
}: {
  weeks: readonly Week[];
  width: number;
  look: GridLook;
  today: string;
  lit: string | null;
  pinned: CalendarMonth;
  locale: string;
  lateOf?: LateOf | undefined;
  start: number;
  bottom: number;
  onDay: (day: string, opener: ViewInstance | null) => void;
  onTop: (index: number, y: number) => void;
  listRef: Ref<FlatList<Week>>;
}) {
  const offsets = useMemo(() => offsetsOf(weeks, look.week), [weeks, look.week]);
  const key = monthKey(pinned);
  const landed = useRef({ start, offset: offsets[start] ?? 0, onTop });

  useEffect(() => {
    const { start: index, offset, onTop: told } = landed.current;
    told(index, offset);
  }, []);

  return (
    <FlatList
      ref={listRef}
      data={weeks}
      keyExtractor={(week) => week.start}
      extraData={`${lit ?? ''}:${key}:${width}`}
      getItemLayout={(_data, index) => ({
        length: (offsets[index + 1] ?? 0) - (offsets[index] ?? 0),
        offset: offsets[index] ?? 0,
        index,
      })}
      initialScrollIndex={start}
      initialNumToRender={10}
      windowSize={9}
      renderItem={({ item }) => (
        <WeekRow
          week={item}
          width={width}
          look={look}
          today={today}
          lit={lit}
          locale={locale}
          lateOf={lateOf}
          walked={item.cells.some((cell) => cell.day.startsWith(key))}
          onDay={onDay}
        />
      )}
      onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const y = event.nativeEvent.contentOffset.y;
        onTop(topIndex(offsets, y), y);
      }}
      scrollEventThrottle={16}
      contentContainerStyle={{ paddingBottom: bottom }}
      showsVerticalScrollIndicator={false}
      testID="calendar.grid"
    />
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  ink: { color: tokens.colorInk },
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
  onDark: { color: tokens.colorInkOnDark },
  figures: { fontVariant: ['tabular-nums'] },
  centred: { textAlign: 'center' },
  heads: { flexDirection: 'row' },
  head: { paddingLeft: tokens.spaceXxs },
  week: { position: 'relative' },
  rule: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: tokens.colorBorder,
  },
  day: { position: 'absolute', top: 0 },
  lit: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    left: 1,
    right: 1,
    borderRadius: tokens.spaceLg,
    backgroundColor: tokens.colorAccentTint,
  },
  between: {
    position: 'absolute',
    left: 0,
    top: 1,
    bottom: 0,
    width: 1,
    backgroundColor: tokens.colorBorder,
    opacity: 0.6,
  },
  number: { position: 'absolute', left: tokens.spaceXxs },
  first: { justifyContent: 'center', paddingHorizontal: tokens.spaceXxs },
  disc: { alignItems: 'center', justifyContent: 'center' },
  discToday: { backgroundColor: tokens.colorAccent },
  discLit: { backgroundColor: tokens.colorCard },
  bar: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXxs,
    paddingRight: 5,
    overflow: 'hidden',
    backgroundColor: tokens.colorCard,
  },
  barSunk: { backgroundColor: tokens.colorInsetBorder },
  tint: { opacity: 0.16 },
  stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  mark: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXxs },
  late: { color: tokens.colorBroken },
  square: { borderRadius: 2, alignItems: 'center', justifyContent: 'center' },
  more: { position: 'absolute' },
  skeleton: { position: 'absolute', borderRadius: 6, backgroundColor: tokens.colorInsetBorder },
});
