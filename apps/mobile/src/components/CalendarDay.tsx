import { type ComponentType, Fragment, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { type Item, dayHeading, isYou, itemKey, rowTitle, rowWhen } from '../kit/calendar.ts';
import { rowTag } from '../kit/eventsList.ts';
import { tokens } from '../theme/tokens.ts';
import { EventSquare, YouDot } from './CalendarWeeks.tsx';
import { EventThumb } from './EventThumb.tsx';
import { eventColour } from './EventMesh.tsx';
import { Glyph } from './Glyph.tsx';
import { Tag, TITLE_BESIDE_TAG, TitleBesideTag } from './SummaryRows.tsx';
import { Text } from './Text.tsx';

const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

const OWNER_WORD = {
  event: 'timeline.owner_event',
  you: 'timeline.owner_you',
  automatic: 'timeline.owner_automatic',
} as const;

export interface RowProps {
  item: Item;
  locale: string;
  readerZone: string;
  big: boolean;
  onOpen: (item: Item) => void;
}

/** A milestone owner's tag on its row: the Event square and its word, in Sunk. */
function OwnerTag({ word }: { word: string }) {
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
        {word}
      </Text>
    </View>
  );
}

/** The You owner's tag, where the Event tag sits: the dot and "You", in the attention tint. */
export function YouTag() {
  const { t } = useTranslation();

  return (
    <View style={[styles.ownerTag, styles.youTag]}>
      <YouDot side={8} />
      <Text
        size={12.5}
        weight="semibold"
        numberOfLines={1}
        accessible={false}
        style={styles.youWords}
      >
        {t('timeline.owner_you')}
      </Text>
    </View>
  );
}

export function MilestoneLead({ item, side }: { item: Item; side: number }) {
  const dot = eventColour(item.event);

  return (
    <View {...hidden} style={[styles.lead, { width: side, height: side }]}>
      <View style={[StyleSheet.absoluteFill, styles.tint, { backgroundColor: dot }]} />
      {isYou(item) ? (
        <YouDot side={14} ink={dot} />
      ) : (
        <EventSquare side={15} ink={dot} border={2.2} />
      )}
    </View>
  );
}

export function leadSide(big: boolean): number {
  return big ? 48 : 40;
}

/** A day's row: its lead, the title with its tag, then its lines, opening on a tap. */
export function DayRow({
  item,
  big,
  lead,
  tag,
  label,
  onOpen,
  children,
}: {
  item: Item;
  big: boolean;
  lead: ReactNode;
  tag: ReactNode;
  label: string;
  onOpen: (item: Item) => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={() => onOpen(item)}
      style={({ pressed }) => [styles.row, big && styles.rowBig, pressed && styles.rowPressed]}
      accessibilityRole="link"
      accessibilityLabel={label}
      testID={`calendar.row.${itemKey(item)}`}
    >
      {lead}
      <View style={styles.words}>
        <TitleBesideTag
          style={big && styles.titleStack}
          title={
            <Text size={16} weight="semibold" accessible={false} style={styles.title}>
              {rowTitle(item)}
            </Text>
          }
          tag={tag}
        />
        {children}
      </View>
      <Glyph name="chevron" size={17} ink={tokens.colorInkTertiary} weight={2.3} />
    </Pressable>
  );
}

/** A line under a row's title, in secondary ink. */
export function RowLine({
  words,
  figures = false,
  late = false,
}: {
  words: string;
  figures?: boolean;
  late?: boolean;
}) {
  return (
    <Text
      size={14}
      weight={late ? 'semibold' : 'medium'}
      accessible={false}
      style={[late ? styles.late : styles.secondary, styles.line, figures && styles.figures]}
    >
      {words}
    </Text>
  );
}

/** A row in the Events list's system: an event's cover, name, tag and line; a milestone's tinted square, its title and its owner. */
export function CalRow({ item, locale, readerZone, big, onOpen }: RowProps) {
  const { t } = useTranslation();
  const line = rowWhen(item, locale, readerZone, t);
  const tag = item.kind === 'event' ? rowTag(item.event, true, t) : null;
  const owner = item.kind === 'milestone' ? item.milestone.owner : null;
  const side = leadSide(big);

  return (
    <DayRow
      item={item}
      big={big}
      lead={
        item.kind === 'event' ? (
          <EventThumb event={item.event} side={side} radius={12} />
        ) : (
          <MilestoneLead item={item} side={side} />
        )
      }
      tag={
        tag != null ? (
          <Tag kind={tag.kind} word={tag.word} />
        ) : owner === 'you' ? (
          <YouTag />
        ) : owner != null ? (
          <OwnerTag word={t(OWNER_WORD[owner])} />
        ) : null
      }
      label={t('calendar.rowLabel', {
        title: rowTitle(item),
        tag: tag?.word ?? (owner == null ? '' : t(OWNER_WORD[owner])),
        when: line,
      })}
      onOpen={onOpen}
    >
      <RowLine words={line} figures />
    </DayRow>
  );
}

export function DayRows({
  items,
  emptyWords,
  Row = CalRow,
  ...row
}: {
  items: readonly Item[];
  emptyWords: string;
  Row?: ComponentType<RowProps> | undefined;
} & Omit<RowProps, 'item'>) {
  if (items.length === 0)
    return (
      <Text
        size={15}
        weight="medium"
        style={[styles.secondary, styles.empty]}
        testID="calendar.emptyDay"
      >
        {emptyWords}
      </Text>
    );

  return (
    <View>
      {items.map((item, index) => (
        <Fragment key={itemKey(item)}>
          {index > 0 && <View style={[styles.hairline, { marginLeft: leadSide(row.big) + 12 }]} />}
          <Row item={item} {...row} />
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
  emptyWords,
  Row,
  locale,
  readerZone,
  big,
  onOpen,
  onClose,
}: {
  day: string;
  today: string;
  items: readonly Item[];
  emptyWords: string;
  Row?: ComponentType<RowProps> | undefined;
  locale: string;
  readerZone: string;
  big: boolean;
  onOpen: (item: Item) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.list} testID="calendar.dayList">
      <View style={styles.head}>
        <Text
          size={18}
          weight="bold"
          accessibilityRole="header"
          style={[styles.grow, styles.heading]}
        >
          {dayHeading(day, today, locale, t)}
        </Text>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t('calendar.close')}
          testID="calendar.dayList.close"
        >
          <Text size={16} weight="semibold" accessible={false} style={styles.accent}>
            {t('calendar.close')}
          </Text>
        </Pressable>
      </View>
      <DayRows
        items={items}
        emptyWords={emptyWords}
        Row={Row}
        locale={locale}
        readerZone={readerZone}
        big={big}
        onOpen={(item) => {
          onClose();
          onOpen(item);
        }}
      />
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
  titleStack: { flexDirection: 'column', alignItems: 'flex-start' },
  title: { ...TITLE_BESIDE_TAG, lineHeight: 16 * 1.3 },
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
  youTag: { backgroundColor: tokens.colorAttentionTint },
  youWords: { color: tokens.colorAttentionText },
  late: { color: tokens.colorBroken },
  hairline: { height: 1, backgroundColor: tokens.colorBorder },
  empty: { lineHeight: 15 * 1.45, paddingVertical: tokens.spaceSm },
});
