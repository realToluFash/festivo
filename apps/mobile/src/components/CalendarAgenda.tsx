import type { CalendarMonth } from '@soirely/domain';
import { type ComponentType, memo, type RefObject, useCallback, useRef } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  type AgendaEntry,
  type Item,
  dayHeading,
  dayNumber,
  monthName,
  weekdayShort,
} from '../kit/calendar.ts';
import { tokens } from '../theme/tokens.ts';
import { DayRows, type RowProps } from './CalendarDay.tsx';
import { Text } from './Text.tsx';

/** Each entry is placed below its rule, so landing on it leaves the rule above the fold. */
const RULE_SPACE = 1 + tokens.spaceXs * 2;

interface AgendaWords {
  /** A day with nothing on it. */
  emptyDay: string;
  /** A month listed with nothing in it. */
  emptyMonth: (month: CalendarMonth) => string;
}

const AgendaRow = memo(function AgendaRow({
  entry,
  first,
  today,
  words,
  Row,
  locale,
  readerZone,
  now,
  big,
  lead,
  onOpen,
  onY,
}: {
  entry: AgendaEntry;
  first: boolean;
  today: string;
  words: AgendaWords;
  Row: ComponentType<RowProps> | undefined;
  locale: string;
  readerZone: string;
  now: Date;
  big: boolean;
  lead: number;
  onOpen: (item: Item) => void;
  onY: (key: string, y: number) => void;
}) {
  const { t } = useTranslation();
  const rule = !first && <View style={styles.rule} />;
  const placed = (y: number) => onY(entry.key, first ? y : y + RULE_SPACE);

  if (entry.kind === 'month')
    return (
      <View onLayout={(event) => placed(event.nativeEvent.layout.y)}>
        {rule}
        <Text
          size={15}
          weight="bold"
          accessibilityRole="header"
          style={[styles.accent, styles.month]}
        >
          {monthName(entry.month, locale)}
        </Text>
      </View>
    );

  if (entry.kind === 'empty')
    return (
      <Text
        size={15}
        weight="medium"
        onLayout={(event) => onY(entry.key, event.nativeEvent.layout.y)}
        style={[styles.secondary, styles.said]}
        testID={`calendar.agenda.${entry.key}`}
      >
        {words.emptyMonth(entry.month)}
      </Text>
    );

  const on = entry.day === today;

  return (
    <View
      onLayout={(event) => placed(event.nativeEvent.layout.y)}
      testID={`calendar.agenda.${entry.day}`}
    >
      {rule}
      <View style={styles.day}>
        <View
          style={[styles.date, { width: lead }]}
          accessible
          accessibilityRole="header"
          accessibilityLabel={dayHeading(entry.day, today, locale, t)}
        >
          <Text
            size={12}
            weight="semibold"
            accessible={false}
            style={[on ? styles.accent : styles.secondary, styles.weekday]}
          >
            {weekdayShort(entry.day, locale)}
          </Text>
          <Text
            size={22}
            weight="bold"
            accessible={false}
            style={[on ? styles.accent : styles.ink, styles.figures, styles.number]}
          >
            {dayNumber(entry.day, locale)}
          </Text>
        </View>
        <View style={[styles.grow, entry.items.length === 0 && styles.emptyAt]}>
          <DayRows
            items={entry.items}
            emptyWords={words.emptyDay}
            Row={Row}
            locale={locale}
            readerZone={readerZone}
            now={now}
            big={big}
            onOpen={onOpen}
          />
        </View>
      </View>
    </View>
  );
});

/** Agenda: the same scroll as a list of days, each with its date column, the month named where it turns. */
export function Agenda({
  entries,
  land,
  today,
  words,
  Row,
  locale,
  readerZone,
  now,
  big,
  lead,
  maxWidth,
  bottom,
  scrollRef,
  onOpen,
  onY,
  onLand,
  onScroll,
}: {
  entries: readonly AgendaEntry[];
  /** The entry it lands on as it opens: today, or the month asked for. */
  land: string;
  today: string;
  words: AgendaWords;
  Row?: ComponentType<RowProps> | undefined;
  locale: string;
  readerZone: string;
  now: Date;
  big: boolean;
  lead: number;
  maxWidth: number | null;
  bottom: number;
  scrollRef: RefObject<ScrollViewInstance | null>;
  onOpen: (item: Item) => void;
  onY: (key: string, y: number) => void;
  onLand: (y: number) => void;
  onScroll: (y: number) => void;
}) {
  const landed = useRef(false);
  const placed = useCallback(
    (key: string, y: number) => {
      onY(key, y);
      if (landed.current || key !== land) return;
      landed.current = true;
      onLand(y);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ y, animated: false }));
    },
    [land, onY, onLand, scrollRef],
  );

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.grow}
      contentContainerStyle={[{ paddingBottom: bottom }, maxWidth != null && { maxWidth }]}
      onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) =>
        onScroll(event.nativeEvent.contentOffset.y)
      }
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      testID="calendar.agenda"
    >
      {entries.map((entry, index) => (
        <AgendaRow
          key={entry.key}
          entry={entry}
          first={index === 0}
          today={today}
          words={words}
          Row={Row}
          locale={locale}
          readerZone={readerZone}
          now={now}
          big={big}
          lead={lead}
          onOpen={onOpen}
          onY={placed}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  ink: { color: tokens.colorInk },
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
  figures: { fontVariant: ['tabular-nums'] },
  rule: { height: 1, marginVertical: tokens.spaceXs, backgroundColor: tokens.colorBorder },
  month: { lineHeight: 15 * 1.3, paddingTop: tokens.spaceXs, paddingBottom: tokens.spaceHair },
  day: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceLg, minHeight: 64 },
  date: { alignItems: 'center', paddingTop: tokens.spaceLg },
  weekday: { lineHeight: 16 },
  number: { lineHeight: 26 },
  emptyAt: { paddingTop: tokens.spaceLg },
  said: { lineHeight: 15 * 1.45, paddingVertical: tokens.spaceSm },
});
