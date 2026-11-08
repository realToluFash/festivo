import { type Href, router } from 'expo-router';
import { Fragment } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { eventColour } from '../../components/EventMesh.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { EventThumb } from '../events/EventCard.tsx';
import { rowTag } from '../events/EventsModel.ts';
import { type Item, dayHeading, itemHref, itemKey, rowTitle, rowWhen } from './CalendarModel.ts';
import { CW } from './CalendarWords.ts';
import { EventSquare } from './CalendarWeeks.tsx';
import { Tag } from '../../components/SummaryRows.tsx';

const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

/** The Event owner's tag on a milestone's row: its square and "Event", in Sunk. */
function EventTag() {
  return (
    <View style={styles.ownerTag}>
      <EventSquare side={10} />
      <Text
        size={12.5}
        weight="semibold"
        numberOfLines={1}
        accessible={false}
        style={styles.secondary}
      >
        {CW.event}
      </Text>
    </View>
  );
}

function MilestoneLead({ item, side }: { item: Item; side: number }) {
  const dot = eventColour(item.event);

  return (
    <View {...hidden} style={[styles.lead, { width: side, height: side }]}>
      <View style={[StyleSheet.absoluteFill, styles.tint, { backgroundColor: dot }]} />
      <EventSquare side={15} ink={dot} border={2.2} />
    </View>
  );
}

/** A row in the Events list's system: an event's cover, name, tag and line; a milestone's tinted square, its title and Event. */
export function CalRow({
  item,
  locale,
  big,
  onOpen,
}: {
  item: Item;
  locale: string;
  big: boolean;
  onOpen: (href: string) => void;
}) {
  const title = rowTitle(item);
  const line = rowWhen(item, locale);
  const tag = item.kind === 'event' ? rowTag(item.event, true) : null;
  const side = big ? 48 : 40;

  return (
    <Pressable
      onPress={() => onOpen(itemHref(item))}
      style={({ pressed }) => [styles.row, big && styles.rowBig, pressed && styles.rowPressed]}
      accessibilityRole="link"
      accessibilityLabel={[title, tag?.word ?? CW.event, line].join(', ')}
      testID={`calendar.row.${itemKey(item)}`}
    >
      {item.kind === 'event' ? (
        <EventThumb event={item.event} side={side} radius={12} />
      ) : (
        <MilestoneLead item={item} side={side} />
      )}
      <View style={styles.words}>
        <View style={[styles.titleRow, big && styles.titleStack]}>
          <Text size={16} weight="semibold" accessible={false} style={styles.title}>
            {title}
          </Text>
          {tag != null ? <Tag kind={tag.kind} word={tag.word} /> : <EventTag />}
        </View>
        <Text
          size={14}
          weight="medium"
          accessible={false}
          style={[styles.secondary, styles.line, styles.figures]}
        >
          {line}
        </Text>
      </View>
      <Glyph name="chevron" size={17} ink={tokens.colorInkTertiary} weight={2.3} />
    </Pressable>
  );
}

export function DayRows({
  items,
  locale,
  big,
  onOpen,
}: {
  items: readonly Item[];
  locale: string;
  big: boolean;
  onOpen: (href: string) => void;
}) {
  if (items.length === 0)
    return (
      <Text size={15} weight="medium" style={[styles.secondary, styles.empty]}>
        {CW.emptyDay}
      </Text>
    );

  return (
    <View>
      {items.map((item, index) => (
        <Fragment key={itemKey(item)}>
          {index > 0 && <View style={[styles.hairline, { marginLeft: (big ? 48 : 40) + 12 }]} />}
          <CalRow item={item} locale={locale} big={big} onOpen={onOpen} />
        </Fragment>
      ))}
    </View>
  );
}

/** The day open: main's heading for the day with Close, then its rows. */
export function DayList({
  day,
  today,
  items,
  locale,
  big,
  onClose,
}: {
  day: string;
  today: string;
  items: readonly Item[];
  locale: string;
  big: boolean;
  onClose: () => void;
}) {
  const open = (href: string) => {
    onClose();
    router.push(href as Href);
  };

  return (
    <View style={styles.list} testID="calendar.dayList">
      <View style={styles.head}>
        <Text
          size={18}
          weight="bold"
          accessibilityRole="header"
          style={[styles.grow, styles.heading]}
        >
          {dayHeading(day, today, locale)}
        </Text>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={CW.close}
          testID="calendar.day.close"
        >
          <Text size={16} weight="semibold" accessible={false} style={styles.accent}>
            {CW.close}
          </Text>
        </Pressable>
      </View>
      <DayRows items={items} locale={locale} big={big} onOpen={open} />
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
  figures: { fontVariant: ['tabular-nums'] },
  pressed: { opacity: tokens.opacityPressed },
  list: { gap: tokens.spaceXs },
  head: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
  },
  heading: { lineHeight: 18 * 1.3, letterSpacing: -0.18 },
  close: {
    minHeight: tokens.sizeHit,
    minWidth: tokens.sizeHit,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceXxs,
  },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    paddingVertical: 11,
    paddingHorizontal: tokens.spaceSm,
    marginHorizontal: -tokens.spaceSm,
    borderRadius: tokens.radiusRow,
  },
  rowBig: { alignItems: 'flex-start' },
  rowPressed: { backgroundColor: tokens.colorAccentTint },
  lead: {
    borderRadius: tokens.spaceLg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: tokens.colorCard,
  },
  tint: { opacity: 0.16 },
  words: { flex: 1, minWidth: 0, gap: 3 },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 8,
    rowGap: 4,
  },
  titleStack: { flexDirection: 'column', alignItems: 'flex-start' },
  title: { flexShrink: 1, lineHeight: 16 * 1.3 },
  line: { lineHeight: 14 * 1.4 },
  ownerTag: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexShrink: 0,
    gap: tokens.spaceXs,
    paddingLeft: tokens.spaceSm,
    paddingRight: 9,
    borderRadius: tokens.spaceLg,
    backgroundColor: tokens.colorInsetBorder,
  },
  hairline: { height: 1, backgroundColor: tokens.colorBorder },
  empty: { lineHeight: 15 * 1.45, paddingVertical: tokens.spaceSm },
});
