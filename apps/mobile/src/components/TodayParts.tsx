import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  ScrollView,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { Text } from './Text.tsx';
import { tokens } from '../theme/tokens.ts';
import { EventMesh, eventColour } from './EventMesh.tsx';
import { Glyph } from './Glyph.tsx';
import {
  type AgendaDay,
  type EventCard,
  type Moment,
  type Need,
  type ShownEvent,
  type StripBar,
} from '../kit/today.ts';
import { useTodayShell } from './todayShell.ts';

/** The board's type, in Instrument Sans: titles at 700 and set close, rows from 13 to 16. */
export const TYPE = {
  head: 22,
  row: 16,
  sub: 13.5,
  meta: 12.5,
  label: 11,
} as const;

const SIDE = tokens.spaceXxl;

/** What a tap opens when it is not drawn yet: the screen says so in a toast. */
export type Tell = (words: string) => void;

export function Panel({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export function SectionHead({
  title,
  count,
  link,
  onLink,
  top,
  size = TYPE.head,
}: {
  title: string;
  count?: number;
  link?: string;
  onLink?: () => void;
  top: number;
  size?: number;
}) {
  return (
    <View style={[styles.head, { marginTop: top }]}>
      <Text
        size={size}
        weight="bold"
        accessibilityRole="header"
        style={[styles.title, { letterSpacing: size * -0.02 }]}
      >
        {title}
      </Text>
      {count != null && (
        <View style={styles.count}>
          <Text size={TYPE.meta} weight="bold" style={styles.onAccent}>
            {String(count)}
          </Text>
        </View>
      )}
      <View style={styles.fill} />
      {link != null && (
        <Pressable
          onPress={onLink}
          style={styles.link}
          hitSlop={tokens.spaceSm}
          accessibilityRole="button"
          accessibilityLabel={link}
        >
          <Text size={14.5} weight="semibold" style={styles.accent} accessible={false}>
            {link}
          </Text>
          <Glyph name="chevron" size={15} ink={tokens.colorAccent} />
        </Pressable>
      )}
    </View>
  );
}

export function EventThumb({
  event,
  side,
  radius = tokens.radiusInset,
}: {
  event: ShownEvent;
  side: number;
  radius?: number;
}) {
  return (
    <View style={[styles.thumb, { width: side, height: side, borderRadius: radius }]}>
      <EventMesh event={event} />
    </View>
  );
}

function ActionButton({
  label,
  filled,
  onPress,
}: {
  label: string;
  filled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 4, bottom: 4 }}
      style={({ pressed }) => [
        styles.action,
        filled ? styles.actionFilled : styles.actionSoft,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
    >
      <Text
        size={tokens.typeButton.size}
        weight="semibold"
        style={filled ? styles.onAccent : undefined}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function NeedRow({
  need,
  first,
  last,
  wide,
}: {
  need: Need;
  first: boolean;
  last: boolean;
  wide: boolean;
}) {
  const { open } = useTodayShell();
  const { id, name } = need.event;
  const due = (
    <View style={styles.due}>
      {need.late && <Glyph name="clock" size={13} ink={tokens.colorBroken} weight={2.4} />}
      <Text
        size={wide ? 14 : TYPE.sub}
        weight={need.late || first ? 'semibold' : 'medium'}
        style={need.late ? styles.late : first ? undefined : styles.secondary}
        numberOfLines={1}
      >
        {need.due}
      </Text>
    </View>
  );

  return (
    <View style={[styles.needRow, !last && styles.ruled]}>
      <EventThumb event={need.event} side={wide ? 46 : 44} />
      <View style={styles.words}>
        <Text size={TYPE.row} weight="semibold">
          {need.title}
        </Text>
        {wide ? (
          <View style={styles.inline}>
            {due}
            <Text size={14} weight="medium" style={styles.secondary} numberOfLines={1}>
              {` · ${name}`}
            </Text>
          </View>
        ) : (
          <>
            <Text size={TYPE.sub} weight="medium" style={styles.secondary} numberOfLines={1}>
              {name}
            </Text>
            {due}
          </>
        )}
      </View>
      <ActionButton
        label={need.action}
        filled={first}
        onPress={() => open({ to: 'event', id, name })}
      />
    </View>
  );
}

export function NeedsYou({ moment, wide, top }: { moment: Moment; wide: boolean; top: number }) {
  const { t } = useTranslation();
  const { needs } = moment;

  if (needs == null) return null;

  if (needs.length === 0)
    return (
      <>
        <SectionHead title={t('todayScreen.needsYou')} top={top} />
        <Panel>
          <View style={styles.clear}>
            <View style={styles.tick}>
              <Glyph name="tick" size={22} ink={tokens.colorAccentText} weight={2.6} />
            </View>
            <View style={styles.words}>
              <Text size={TYPE.row} weight="semibold">
                {t('todayScreen.nothingNeedsYou')}
              </Text>
              <Text size={14} weight="medium" style={styles.secondary}>
                {t('todayScreen.upToDate')}
              </Text>
            </View>
          </View>
        </Panel>
      </>
    );

  return (
    <>
      <SectionHead title={t('todayScreen.needsYou')} count={needs.length} top={top} />
      <Panel style={wide && styles.panelWide}>
        {needs.map((need, index) => (
          <NeedRow
            key={need.title}
            need={need}
            first={index === 0}
            last={index === needs.length - 1}
            wide={wide}
          />
        ))}
      </Panel>
    </>
  );
}

/** The least room a bar leaves its event's name, as the board does, before it gives up its "· 3 days". */
const NAME_ROOM = 64;

function Bar({ bar, wide }: { bar: StripBar; wide: boolean }) {
  const colour = eventColour(bar.event);
  const [room, setRoom] = useState<number>();
  const [label, setLabel] = useState<number>();
  // A two-day bar on a phone has room for the name or its length, and the name says whose it is.
  const both = room == null || label == null || room - label >= NAME_ROOM;

  return (
    <View
      style={[
        styles.bar,
        {
          left: `${(bar.start / 7) * 100}%`,
          width: `${(bar.span / 7) * 100}%`,
          height: wide ? 32 : 30,
        },
      ]}
    >
      <View
        onLayout={(event) => setRoom(event.nativeEvent.layout.width)}
        style={[
          styles.barFill,
          bar.openLeft ? styles.barOpen : [styles.barClosed, { borderLeftColor: colour }],
        ]}
      >
        <View style={[StyleSheet.absoluteFill, styles.tint, { backgroundColor: colour }]} />
        <Text size={12} weight="semibold" numberOfLines={1} style={styles.barName}>
          {bar.event.name}
        </Text>
        <Text
          size={12}
          weight="medium"
          numberOfLines={1}
          onLayout={(event) => {
            const width = event.nativeEvent.layout.width;
            setLabel((was) => was ?? width);
          }}
          style={[styles.barLabel, !both && styles.gone]}
        >
          {` · ${bar.label}`}
        </Text>
      </View>
    </View>
  );
}

function Strip({ moment, wide }: { moment: Moment; wide: boolean }) {
  const { t } = useTranslation();
  const circle = wide ? 38 : 34;
  const today = t('todayScreen.today');
  const todayShort = t('todayScreen.todayShort');

  return (
    <Panel style={[styles.strip, moment.bars.length > 0 && styles.stripWithBars]}>
      <View style={styles.days}>
        {moment.days.map((day) => (
          <View
            key={day.number}
            style={styles.dayColumn}
            accessible
            accessibilityLabel={`${day.today ? today : day.weekday} ${day.number}${
              day.dots.length > 0 ? `, ${day.dots.map((event) => event.name).join(', ')}` : ''
            }`}
          >
            <Text
              size={TYPE.label}
              weight="semibold"
              accessible={false}
              style={[styles.weekday, day.today ? styles.accent : styles.secondary]}
            >
              {(day.today ? todayShort : day.weekday).toLocaleUpperCase()}
            </Text>
            <View
              style={[
                styles.dayCircle,
                { width: circle, height: circle, borderRadius: circle / 2 },
                day.today && styles.dayToday,
              ]}
            >
              <Text
                size={wide ? 18 : 17}
                weight="bold"
                accessible={false}
                style={[styles.figures, day.today && styles.onAccent]}
              >
                {day.number}
              </Text>
            </View>
            <View style={styles.dots}>
              {day.dots.map((event) => (
                <View
                  key={event.id}
                  style={[styles.dot, { backgroundColor: eventColour(event) }]}
                />
              ))}
            </View>
          </View>
        ))}
      </View>
      {moment.bars.length > 0 && (
        <View style={[styles.bars, { height: (wide ? 32 : 30) + tokens.spaceXs }]}>
          {moment.bars.map((bar) => (
            <Bar key={bar.event.id} bar={bar} wide={wide} />
          ))}
        </View>
      )}
    </Panel>
  );
}

function AgendaDays({
  days,
  nothing,
  wide,
}: {
  days: AgendaDay[];
  nothing: string;
  wide: boolean;
}) {
  return (
    <Panel style={styles.agenda}>
      {days.map((day, dayIndex) => {
        const ruled = dayIndex < days.length - 1;

        return (
          <View key={day.date}>
            <View style={styles.dayLine}>
              <Text size={14} weight="bold" style={day.today ? styles.accent : undefined}>
                {day.day}
              </Text>
              <Text size={TYPE.sub} weight="medium" style={styles.secondary}>
                {`· ${day.when}`}
              </Text>
            </View>
            {day.items.length === 0 ? (
              <Text
                size={14}
                weight="medium"
                style={[styles.secondary, styles.nothing, ruled && styles.ruled]}
              >
                {nothing}
              </Text>
            ) : (
              day.items.map((item, index) => {
                const last = index === day.items.length - 1;

                return (
                  <View
                    key={`${item.time}${item.title}`}
                    style={[styles.item, last && styles.itemLast, last && ruled && styles.ruled]}
                  >
                    <Text
                      size={14}
                      weight="bold"
                      numberOfLines={item.allDay ? 2 : 1}
                      style={[styles.figures, styles.time, { width: wide ? 76 : 70 }]}
                    >
                      {item.time}
                    </Text>
                    <View style={[styles.stripe, { backgroundColor: eventColour(item.event) }]} />
                    <View style={styles.words}>
                      <Text size={15} weight="semibold">
                        {item.title}
                      </Text>
                      <Text size={13} weight="medium" style={styles.secondary} numberOfLines={1}>
                        {item.event.name + (item.note === '' ? '' : ` · ${item.note}`)}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        );
      })}
    </Panel>
  );
}

export function ThisWeek({ moment, wide, top }: { moment: Moment; wide: boolean; top: number }) {
  const { t } = useTranslation();
  const { open } = useTodayShell();
  const { nextUp } = moment;

  return (
    <>
      <SectionHead
        title={t('todayScreen.thisWeek')}
        link={t('todayScreen.tab.calendar')}
        onLink={() => open({ to: 'calendar' })}
        top={top}
      />
      <Strip moment={moment} wide={wide} />
      {nextUp == null ? (
        <AgendaDays days={moment.agenda} nothing={moment.nothing} wide={wide} />
      ) : (
        <Panel style={styles.quiet}>
          <Text size={TYPE.row} weight="semibold" style={styles.quietLine}>
            {t('todayScreen.nothingOnThisWeek')}
          </Text>
          <Pressable
            onPress={() => open({ to: 'event', id: nextUp.event.id, name: nextUp.name })}
            style={({ pressed }) => [styles.nextUp, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t('todayScreen.nextUpLabel', {
              name: nextUp.name,
              when: nextUp.when,
            })}
          >
            <EventThumb event={nextUp.event} side={48} />
            <View style={styles.words}>
              <Text
                size={12}
                weight="semibold"
                accessible={false}
                style={[styles.secondary, styles.caps]}
              >
                {t('todayScreen.nextUp').toLocaleUpperCase()}
              </Text>
              <Text size={15} weight="semibold" accessible={false}>
                {nextUp.name}
              </Text>
              <Text size={13} weight="medium" accessible={false} style={styles.secondary}>
                {nextUp.when}
              </Text>
            </View>
            <Glyph name="chevron" ink={tokens.colorInkTertiary} />
          </Pressable>
        </Panel>
      )}
    </>
  );
}

function CountChip({
  card,
  onCover,
  small,
}: {
  card: EventCard;
  onCover: boolean;
  small: boolean;
}) {
  const { t } = useTranslation();
  const size = small ? 12 : TYPE.meta;
  const words = card.live
    ? t('todayScreen.liveCount', { words: card.count.toLocaleLowerCase() })
    : card.count;
  const dark = card.draft && onCover;

  return (
    <View
      style={[
        styles.chip,
        small && styles.chipSmall,
        card.draft ? (onCover ? styles.chipDark : styles.chipDraft) : styles.chipLight,
      ]}
    >
      {card.live && <View style={styles.liveDot} />}
      <Text
        size={size}
        weight="semibold"
        numberOfLines={1}
        style={dark ? styles.onAccent : card.draft ? styles.secondary : undefined}
      >
        {words}
      </Text>
    </View>
  );
}

function StageChip({ stage, onCover, small }: { stage: string; onCover: boolean; small: boolean }) {
  return (
    <View
      style={[styles.chip, small && styles.chipSmall, onCover ? styles.stageOnCover : styles.stage]}
    >
      <Text
        size={small ? 12 : TYPE.meta}
        weight="semibold"
        numberOfLines={1}
        style={onCover ? styles.onAccent : styles.accentText}
      >
        {stage}
      </Text>
    </View>
  );
}

function Readiness({ card, full }: { card: EventCard; full: boolean }) {
  if (!full || card.ready == null) return null;

  return (
    <View style={styles.ready}>
      {card.ready.percent > 0 && (
        <View style={styles.track}>
          <View
            style={[
              styles.progress,
              { width: `${card.ready.percent}%`, backgroundColor: eventColour(card.event) },
            ]}
          />
        </View>
      )}
      <Text size={TYPE.meta} weight="medium" style={styles.secondary}>
        {card.ready.words}
      </Text>
    </View>
  );
}

function Tile({ card, full }: { card: EventCard; full: boolean }) {
  const { open } = useTodayShell();

  return (
    <Pressable
      onPress={() => open({ to: 'event', id: card.event.id, name: card.name })}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
      accessibilityRole="button"
    >
      <View style={styles.tileCover}>
        <EventMesh event={card.event} />
        <View style={styles.tileChips}>
          <CountChip card={card} onCover small={false} />
          {card.stage != null && <StageChip stage={card.stage} onCover small={false} />}
        </View>
      </View>
      <View style={styles.tileBody}>
        <Text size={15} weight="semibold" numberOfLines={2} style={styles.tileName}>
          {card.name}
        </Text>
        <Text size={13} weight="medium" style={[styles.secondary, styles.dates]}>
          {card.dates}
        </Text>
        <Readiness card={card} full={full} />
      </View>
    </Pressable>
  );
}

function Row({ card, full, last }: { card: EventCard; full: boolean; last: boolean }) {
  const { open } = useTodayShell();

  return (
    <Pressable
      onPress={() => open({ to: 'event', id: card.event.id, name: card.name })}
      style={({ pressed }) => [styles.eventRow, !last && styles.ruled, pressed && styles.pressed]}
      accessibilityRole="button"
    >
      <EventThumb event={card.event} side={56} radius={16} />
      <View style={styles.words}>
        <Text size={15} weight="semibold">
          {card.name}
        </Text>
        <Text size={13} weight="medium" style={[styles.secondary, styles.dates]}>
          {card.dates}
        </Text>
        <View style={styles.rowChips}>
          <CountChip card={card} onCover={false} small />
          {card.stage != null && <StageChip stage={card.stage} onCover={false} small />}
        </View>
        <Readiness card={card} full={full} />
      </View>
    </Pressable>
  );
}

export function YourEvents({
  moment,
  layout,
  top,
}: {
  moment: Moment;
  layout: 'carousel' | 'list';
  top: number;
}) {
  const { t } = useTranslation();
  const { open } = useTodayShell();
  const { events, full } = moment;

  return (
    <>
      <SectionHead
        title={t('todayScreen.yourEvents')}
        link={t('todayScreen.allEvents')}
        onLink={() => open({ to: 'events' })}
        top={top}
      />
      {layout === 'carousel' ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.carousel}
          contentContainerStyle={styles.carouselRow}
        >
          {events.map((card) => (
            <Tile key={card.event.id} card={card} full={full} />
          ))}
        </ScrollView>
      ) : (
        <Panel style={styles.list}>
          {events.map((card, index) => (
            <Row key={card.event.id} card={card} full={full} last={index === events.length - 1} />
          ))}
        </Panel>
      )}
    </>
  );
}

const STEPS = ['name', 'place', 'live'] as const;

export function FirstRun({ wide }: { wide: boolean }) {
  const { t } = useTranslation();
  const { open } = useTodayShell();

  return (
    <View style={[styles.first, wide && styles.firstWide]}>
      <SectionHead title={t('todayScreen.firstTitle')} size={24} top={tokens.spaceXxs} />
      <Text size={15} weight="medium" style={[styles.secondary, styles.firstIntro]}>
        {t('todayScreen.firstIntro')}
      </Text>
      <Panel style={styles.list}>
        {STEPS.map((step, index) => (
          <View key={step} style={[styles.step, index < STEPS.length - 1 && styles.ruled]}>
            <View
              style={styles.stepNumber}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Text
                size={17}
                weight="bold"
                accessible={false}
                style={[styles.accent, styles.figures]}
              >
                {t('todayScreen.stepNumber', { n: index + 1 })}
              </Text>
            </View>
            <View style={styles.words}>
              <Text size={TYPE.row} weight="semibold">
                {t(`todayScreen.firstStep.${step}Title`)}
              </Text>
              <Text size={14} weight="medium" style={styles.secondary}>
                {t(`todayScreen.firstStep.${step}Body`)}
              </Text>
            </View>
          </View>
        ))}
      </Panel>
      <Pressable
        onPress={() => open({ to: 'create' })}
        style={({ pressed }) => [
          styles.create,
          wide && styles.createWide,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('todayScreen.startFirst')}
      >
        <Glyph name="plus" ink={tokens.colorInkOnDark} />
        <Text size={TYPE.row} weight="semibold" accessible={false} style={styles.onAccent}>
          {t('todayScreen.startFirst')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  words: { flex: 1, minWidth: 0, gap: tokens.spaceHair },
  inline: { flexDirection: 'row', alignItems: 'center', marginTop: 1 },
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccent },
  accentText: { color: tokens.colorAccentText },
  onAccent: { color: tokens.colorInkOnDark },
  late: { color: tokens.colorBroken },
  figures: { fontVariant: ['tabular-nums'] },
  caps: { letterSpacing: 12 * 0.06 },
  pressed: { opacity: 0.7 },
  ruled: { borderBottomWidth: 1, borderBottomColor: tokens.colorBorder },
  panel: {
    backgroundColor: tokens.colorInset,
    borderRadius: tokens.space3xl,
    paddingVertical: tokens.spaceXxs,
    paddingHorizontal: tokens.spaceXl,
  },
  panelWide: { paddingHorizontal: 18 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingHorizontal: tokens.spaceHair,
    marginBottom: tokens.spaceLg,
  },
  title: { lineHeight: TYPE.head * 1.15 },
  count: {
    minWidth: tokens.space3xl,
    height: tokens.space3xl,
    paddingHorizontal: tokens.spaceSm,
    borderRadius: tokens.spaceLg,
    backgroundColor: tokens.colorAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceHair,
    minHeight: tokens.sizeHit,
  },
  thumb: { overflow: 'hidden', flex: 0 },
  action: {
    height: tokens.sizeControlDense,
    paddingHorizontal: 15,
    borderRadius: tokens.sizeControlDense / 2,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 0,
  },
  actionFilled: { backgroundColor: tokens.colorAccent },
  actionSoft: { backgroundColor: tokens.colorCard },
  due: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXxs, flexShrink: 0 },
  needRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacePillEnd,
    paddingVertical: tokens.spaceLg,
  },
  clear: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacePillEnd,
    paddingVertical: tokens.spacePillEnd,
  },
  tick: {
    width: tokens.sizeHit,
    height: tokens.sizeHit,
    borderRadius: tokens.sizeHit / 2,
    backgroundColor: tokens.colorAccentTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  strip: {
    paddingTop: tokens.spaceXl,
    paddingHorizontal: tokens.spaceMd,
    paddingBottom: tokens.spaceMd,
  },
  stripWithBars: { paddingBottom: tokens.spacePillEnd },
  days: { flexDirection: 'row' },
  dayColumn: { flex: 1, alignItems: 'center', gap: 5 },
  weekday: { letterSpacing: TYPE.label * 0.06 },
  dayCircle: { alignItems: 'center', justifyContent: 'center' },
  dayToday: { backgroundColor: tokens.colorAccent },
  dots: { height: tokens.spaceXs, flexDirection: 'row', gap: 3 },
  dot: { width: tokens.spaceXs, height: tokens.spaceXs, borderRadius: 3 },
  bars: { position: 'relative' },
  bar: { position: 'absolute', top: tokens.spaceXs, paddingRight: 3 },
  barFill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spaceSm,
    overflow: 'hidden',
  },
  barOpen: { borderTopRightRadius: tokens.spaceMd, borderBottomRightRadius: tokens.spaceMd },
  barClosed: { marginLeft: 3, borderRadius: tokens.spaceMd, borderLeftWidth: tokens.spaceXxs },
  tint: { opacity: 0.16 },
  barName: { flexShrink: 1 },
  barLabel: { flexShrink: 0 },
  gone: { display: 'none' },
  agenda: { marginTop: tokens.spaceMd, paddingVertical: 0, paddingBottom: tokens.spaceHair },
  dayLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: tokens.spaceXs,
    paddingTop: tokens.spacePillEnd,
    paddingBottom: tokens.spaceXxs,
  },
  nothing: { paddingTop: tokens.spaceXxs, paddingBottom: tokens.spacePillEnd },
  item: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceLg, paddingVertical: 7 },
  itemLast: { paddingBottom: 13 },
  time: { flex: 0 },
  stripe: { width: tokens.spaceXxs, alignSelf: 'stretch', borderRadius: tokens.spaceHair },
  quiet: { marginTop: tokens.spaceMd, padding: tokens.spacePillEnd },
  quietLine: {
    paddingTop: tokens.spaceXxs,
    paddingHorizontal: tokens.spaceHair,
    paddingBottom: tokens.spaceLg,
  },
  nextUp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacePillEnd,
    padding: tokens.spaceLg,
    borderRadius: 18,
    backgroundColor: tokens.colorCard,
  },
  chip: {
    height: 26,
    paddingHorizontal: 11,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    flex: 0,
  },
  chipSmall: {
    height: tokens.space3xl,
    paddingHorizontal: tokens.spaceMd,
    borderRadius: tokens.spaceLg,
  },
  chipLight: { backgroundColor: tokens.colorCard },
  chipDark: { backgroundColor: tokens.scrimDialog },
  chipDraft: { backgroundColor: tokens.colorBorder },
  liveDot: {
    width: tokens.spaceSm,
    height: tokens.spaceSm,
    borderRadius: 4,
    backgroundColor: tokens.colorBroken,
  },
  stage: { backgroundColor: tokens.colorAccentTint },
  stageOnCover: { backgroundColor: tokens.colorAccent },
  ready: { gap: tokens.spaceXs, marginTop: 9 },
  track: { height: 5, borderRadius: 5, backgroundColor: tokens.colorBorder, overflow: 'hidden' },
  progress: { height: 5, borderRadius: 5 },
  carousel: { marginHorizontal: -SIDE },
  carouselRow: { paddingHorizontal: SIDE, gap: tokens.spaceLg, alignItems: 'flex-start' },
  tile: {
    width: 232,
    backgroundColor: tokens.colorInset,
    borderRadius: tokens.space3xl,
    overflow: 'hidden',
  },
  tileCover: { height: 124, overflow: 'hidden' },
  tileChips: {
    position: 'absolute',
    left: tokens.spaceMd,
    top: tokens.spaceMd,
    flexDirection: 'row',
    gap: tokens.spaceXs,
  },
  tileBody: {
    paddingTop: tokens.spaceLg,
    paddingHorizontal: tokens.spacePillEnd,
    paddingBottom: tokens.spacePillEnd,
  },
  tileName: { minHeight: 39 },
  dates: { marginTop: tokens.spaceHair },
  list: { paddingVertical: tokens.spaceHair },
  eventRow: { flexDirection: 'row', gap: tokens.spacePillEnd, paddingVertical: 13 },
  rowChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spaceXs,
    marginTop: tokens.spaceSm,
  },
  first: { gap: tokens.spaceXl },
  firstWide: { maxWidth: 560 },
  firstIntro: { marginTop: -tokens.spaceXs, lineHeight: 15 * 1.5 },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacePillEnd,
    paddingVertical: 13,
  },
  stepNumber: {
    width: tokens.sizeHit,
    height: tokens.sizeHit,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorAccentTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  create: {
    height: tokens.sizeHitPhoneHero,
    borderRadius: tokens.sizeHitPhoneHero / 2,
    backgroundColor: tokens.colorAccent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spaceSm,
  },
  createWide: { alignSelf: 'flex-start', paddingHorizontal: tokens.space4xl },
});
