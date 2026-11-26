import { type ReactNode, useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  ScrollView,
  type StyleProp,
  StyleSheet,
  type TextStyle,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';

import { Text, TitleCap } from './Text.tsx';
import { CappedWholeWords, MeasuredWords, MenuWords } from './Title.tsx';
import {
  atAccessibilitySizes,
  capUnderTitle,
  dayLineShares,
  drawnSize,
  fitTracked,
  wholeLineHeight,
} from '../layout/textSize.ts';
import { tokens } from '../theme/tokens.ts';
import { EventMesh, eventColour } from './EventMesh.tsx';
import { Glyph } from './Glyph.tsx';
import { Notice } from './Notice.tsx';
import {
  type AgendaDay,
  type EventCard,
  type Moment,
  type Need,
  type ShownEvent,
  type StripBar,
} from '../kit/today.ts';
import { useTodayShell } from './todayShell.ts';
import { tileWidth } from '../layout/todayTile.ts';

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
  const { fontScale } = useWindowDimensions();
  const [row, setRow] = useState(0);
  const [badge, setBadge] = useState(0);
  const [drawn, setDrawn] = useState<number | null>(null);
  const whole = atAccessibilitySizes(fontScale);
  const room = count == null ? row : badge === 0 ? 0 : row - badge - tokens.spaceMd;
  const cap = whole ? (drawn ?? size * fontScale) : undefined;

  const chip = count != null && (
    <View style={styles.count} onLayout={(event) => setBadge(event.nativeEvent.layout.width)}>
      <Text
        size={TYPE.meta}
        weight="bold"
        maxFontSizeMultiplier={cap == null ? undefined : capUnderTitle(cap, TYPE.meta)}
        style={styles.onAccent}
      >
        {String(count)}
      </Text>
    </View>
  );
  const more = link != null && (
    <Pressable
      onPress={onLink}
      style={[styles.link, whole && styles.stacked]}
      hitSlop={tokens.spaceSm}
      accessibilityRole="button"
      accessibilityLabel={link}
    >
      <Text
        size={14.5}
        weight="semibold"
        maxFontSizeMultiplier={cap == null ? undefined : capUnderTitle(cap, 14.5)}
        style={[styles.accent, whole && styles.shrink]}
        accessible={false}
      >
        {link}
      </Text>
      <Glyph name="chevron" size={15} ink={tokens.colorAccent} />
    </Pressable>
  );

  if (!whole)
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
        {chip}
        <View style={styles.fill} />
        {more}
      </View>
    );

  // From AX1 the link takes the line under, so the heading has the row's width; beside the count it wraps in what the count leaves.
  return (
    <View style={[styles.headStacked, { marginTop: top }]}>
      <View style={styles.headLine} onLayout={(event) => setRow(event.nativeEvent.layout.width)}>
        <View style={styles.besideCount}>
          <CappedWholeWords
            size={size}
            weight="bold"
            room={Math.max(room, 0)}
            breakAfterHyphens
            onDrawn={setDrawn}
            accessibilityRole="header"
            style={[
              styles.title,
              { letterSpacing: size * -0.02 },
              drawn != null && { lineHeight: wholeLineHeight(size, drawn, 1.15) },
            ]}
          >
            {title}
          </CappedWholeWords>
        </View>
        {chip}
      </View>
      {more}
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
  const height = wide ? 32 : 30;
  const [room, setRoom] = useState<number>();
  const [label, setLabel] = useState<number>();
  // A two-day bar on a phone has room for the name or its length, and the name says whose it is.
  const both = room == null || label == null || room - label >= NAME_ROOM;

  return (
    <View
      style={[
        styles.bar,
        {
          top: tokens.spaceXs + (bar.lane ?? 0) * (height + tokens.spaceXs),
          left: `${(bar.start / 7) * 100}%`,
          width: `${(bar.span / 7) * 100}%`,
          height,
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
            <StripLabel
              text={(day.today ? todayShort : day.weekday).toLocaleUpperCase()}
              today={day.today}
            />
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
        <View
          style={[
            styles.bars,
            {
              height:
                (1 + Math.max(...moment.bars.map((bar) => bar.lane ?? 0))) *
                ((wide ? 32 : 30) + tokens.spaceXs),
            },
          ]}
        >
          {moment.bars.map((bar) => (
            <Bar key={bar.event.id} bar={bar} wide={wide} />
          ))}
        </View>
      )}
    </Panel>
  );
}

const STRIP_TRACKING = TYPE.label * 0.06;

/** A day's label in the strip: main's text up to the default size; above it, hidden until measured, it steps down alone to the largest whole size at which it fits its column, never under the default size, keeping the step's line so the circles stay in line (sc-94682). */
function StripLabel({ text, today }: { text: string; today: boolean }) {
  const { fontScale } = useWindowDimensions();
  const cap = useContext(TitleCap);
  const start = drawnSize(
    TYPE.label,
    fontScale,
    cap == null ? undefined : capUnderTitle(cap, TYPE.label),
  );
  const key = `${start}|${text}`;
  const [column, setColumn] = useState<{ key: string; width: number } | null>(null);
  const [measured, setMeasured] = useState<{ key: string; width: number } | null>(null);
  const look = [styles.weekday, today ? styles.accent : styles.secondary];

  if (start <= TYPE.label)
    return (
      <Text size={TYPE.label} weight="semibold" accessible={false} style={look}>
        {text}
      </Text>
    );

  const width = measured?.key === key ? measured.width : undefined;
  // A column's onLayout does not fire again when only the text size changes, so its width is kept per word and size, read again by a new key.
  const room = column?.key === key ? column.width : undefined;
  const known = width != null && room != null && room > 0;
  const drawn = known
    ? fitTracked(TYPE.label, start, width, [...text].length * STRIP_TRACKING, room)
    : start;

  return (
    <View
      key={key}
      style={[styles.labelRoom, { minHeight: wholeLineHeight(start, start) }]}
      onLayout={(event) => setColumn({ key, width: event.nativeEvent.layout.width })}
    >
      <MeasuredWords
        words={[text]}
        size={start}
        weight="semibold"
        allowFontScaling={false}
        style={styles.weekday}
        onWidth={(_, measuredWidth) =>
          setMeasured((now) =>
            now?.key === key && now.width === measuredWidth ? now : { key, width: measuredWidth },
          )
        }
      />
      <Text
        // A new size mounts a new Text, so iOS never draws one size in the box laid out for another (sc-69816).
        key={drawn}
        size={drawn}
        weight="semibold"
        allowFontScaling={false}
        accessible={false}
        style={[look, !known && styles.waiting]}
      >
        {text}
      </Text>
    </View>
  );
}

/** From AX1: hidden until it knows whether the dotted date fits beside the name whole; if not, the date takes the line under without its dot (sc-92250). */
function FittedDayLine({ day }: { day: AgendaDay }) {
  const { fontScale } = useWindowDimensions();
  const dotted = `· ${day.when}`;
  const key = `${fontScale}|${day.day}|${dotted}`;
  const [room, setRoom] = useState(0);
  const [measured, setMeasured] = useState<{ key: string; name?: number; date?: number }>({
    key: '',
  });
  const widths = measured.key === key ? measured : { key };
  const known = widths.name != null && widths.date != null && room > 0;
  const shares = !known || dayLineShares(widths.name ?? 0, widths.date ?? 0, tokens.spaceXs, room);
  const keep = (which: 'name' | 'date') => (_: string, width: number) =>
    setMeasured((now) => {
      const kept = now.key === key ? now : { key };

      return kept[which] === width ? now : { ...kept, [which]: width };
    });
  const nameStyle = day.today ? styles.accent : undefined;

  return (
    <View
      style={[styles.dayLineStacked, !known && styles.waiting]}
      onLayout={(event) => setRoom(event.nativeEvent.layout.width)}
    >
      <MeasuredWords words={[day.day]} size={14} weight="bold" onWidth={keep('name')} />
      <MeasuredWords words={[dotted]} size={TYPE.sub} weight="medium" onWidth={keep('date')} />
      {shares ? (
        <View style={styles.dayLineShared}>
          <Text size={14} weight="bold" style={nameStyle}>
            {day.day}
          </Text>
          <Text size={TYPE.sub} weight="medium" style={styles.secondary}>
            {dotted}
          </Text>
        </View>
      ) : (
        <>
          <CappedWholeWords size={14} weight="bold" room={room} style={nameStyle}>
            {day.day}
          </CappedWholeWords>
          <CappedWholeWords size={TYPE.sub} weight="medium" room={room} style={styles.secondary}>
            {day.when}
          </CappedWholeWords>
        </>
      )}
    </View>
  );
}

function AgendaDays({
  days,
  nothing,
  wide,
  stacked,
}: {
  days: AgendaDay[];
  nothing: string;
  wide: boolean;
  stacked: boolean;
}) {
  return (
    <Panel style={styles.agenda}>
      {days.map((day, dayIndex) => {
        const ruled = dayIndex < days.length - 1;

        return (
          <View key={day.date}>
            {stacked ? (
              <FittedDayLine day={day} />
            ) : (
              <View style={styles.dayLine}>
                <Text size={14} weight="bold" style={day.today ? styles.accent : undefined}>
                  {day.day}
                </Text>
                <Text size={TYPE.sub} weight="medium" style={styles.secondary}>
                  {`· ${day.when}`}
                </Text>
              </View>
            )}
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
                const time = (
                  <Text
                    size={14}
                    weight="bold"
                    numberOfLines={stacked ? undefined : item.allDay ? 2 : 1}
                    style={[styles.figures, !stacked && [styles.time, { width: wide ? 76 : 70 }]]}
                  >
                    {item.time}
                  </Text>
                );

                return (
                  <View
                    key={`${item.event.id}${item.time}${item.title}`}
                    style={[
                      stacked ? styles.itemStacked : styles.item,
                      last && styles.itemLast,
                      last && ruled && styles.ruled,
                    ]}
                  >
                    {stacked && time}
                    <View style={styles.itemRow}>
                      {!stacked && time}
                      <View style={[styles.stripe, { backgroundColor: eventColour(item.event) }]} />
                      <View style={styles.words}>
                        <Text size={15} weight="semibold">
                          {item.title}
                        </Text>
                        <Text
                          size={13}
                          weight="medium"
                          style={styles.secondary}
                          numberOfLines={stacked ? undefined : 1}
                        >
                          {item.event.name + (item.note === '' ? '' : ` · ${item.note}`)}
                        </Text>
                      </View>
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
  const agendaAlone = atAccessibilitySizes(useWindowDimensions().fontScale);

  return (
    <>
      <SectionHead
        title={t('todayScreen.thisWeek')}
        link={t('todayScreen.tab.calendar')}
        onLink={() => open({ to: 'calendar' })}
        top={top}
      />
      {!agendaAlone && <Strip moment={moment} wide={wide} />}
      {nextUp == null ? (
        <AgendaDays
          days={moment.agenda}
          nothing={moment.nothing}
          wide={wide}
          stacked={agendaAlone}
        />
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
            {!agendaAlone && <EventThumb event={nextUp.event} side={48} />}
            <View style={styles.words}>
              <MenuWords
                size={12}
                weight="semibold"
                grows={false}
                style={[styles.secondary, styles.caps]}
              >
                {t('todayScreen.nextUp').toLocaleUpperCase()}
              </MenuWords>
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

const LIVE_DOT = tokens.spaceSm + tokens.spaceXs;

/** A chip's words: main's text below AX1; from AX1 stepping down alone until its widest piece fits the chip, no larger than the name (sc-92090). */
function ChipWords({
  size,
  grown,
  style,
  children,
}: {
  size: number;
  grown: { room: number; under: number } | null;
  style: StyleProp<TextStyle>;
  children: string;
}) {
  if (grown == null)
    return (
      <Text size={size} weight="semibold" style={style}>
        {children}
      </Text>
    );

  return (
    <CappedWholeWords
      size={size}
      weight="semibold"
      room={grown.room}
      under={grown.under}
      breakAfterHyphens
      style={style}
    >
      {children}
    </CappedWholeWords>
  );
}

function CountChip({
  card,
  onCover,
  small,
  grown = null,
}: {
  card: EventCard;
  onCover: boolean;
  small: boolean;
  grown?: { room: number; under: number } | null;
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
      <ChipWords
        size={size}
        grown={
          grown == null || !card.live
            ? grown
            : { ...grown, room: Math.max(grown.room - LIVE_DOT, 0) }
        }
        style={[
          styles.chipWords,
          dark ? styles.onAccent : card.draft ? styles.secondary : undefined,
        ]}
      >
        {words}
      </ChipWords>
    </View>
  );
}

function StageChip({
  stage,
  onCover,
  small,
  grown = null,
}: {
  stage: string;
  onCover: boolean;
  small: boolean;
  grown?: { room: number; under: number } | null;
}) {
  return (
    <View
      style={[styles.chip, small && styles.chipSmall, onCover ? styles.stageOnCover : styles.stage]}
    >
      <ChipWords
        size={small ? 12 : TYPE.meta}
        grown={grown}
        style={[styles.chipWords, onCover ? styles.onAccent : styles.accentText]}
      >
        {stage}
      </ChipWords>
    </View>
  );
}

function Readiness({
  card,
  grown = null,
}: {
  card: EventCard;
  grown?: { room: number; under: number } | null;
}) {
  if (card.ready == null) return null;

  return (
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
      {grown == null ? (
        <Text
          size={TYPE.meta}
          weight="medium"
          style={styles.secondary}
          accessibilityLabel={card.ready.spoken}
        >
          {card.ready.words}
        </Text>
      ) : (
        <CappedWholeWords
          size={TYPE.meta}
          weight="medium"
          room={grown.room}
          under={grown.under}
          breakAfterHyphens
          style={styles.secondary}
          accessibilityLabel={card.ready.spoken}
        >
          {card.ready.words}
        </CappedWholeWords>
      )}
    </View>
  );
}

/** From AX1 a card's words take the whole width, and each label steps down alone until its widest piece fits, none larger than the name (sc-92090). */
function GrownWords({ card }: { card: EventCard }) {
  const [room, setRoom] = useState(0);
  const [name, setName] = useState<number | null>(null);
  // The labels under the name wait for its size, so none starts larger than the name draws.
  const under = name ?? Infinity;
  const labels = { room: name == null ? 0 : room, under };
  const chips = { room: Math.max(labels.room - 2 * tokens.spaceMd, 0), under };

  return (
    <View style={styles.grownWords} onLayout={(event) => setRoom(event.nativeEvent.layout.width)}>
      <CappedWholeWords size={15} weight="semibold" room={room} breakAfterHyphens onDrawn={setName}>
        {card.name}
      </CappedWholeWords>
      <CappedWholeWords
        size={13}
        weight="medium"
        room={labels.room}
        under={under}
        breakAfterHyphens
        style={[styles.secondary, styles.dates]}
      >
        {card.dates}
      </CappedWholeWords>
      <View style={styles.rowChips}>
        <CountChip card={card} onCover={false} small grown={chips} />
        {card.stage != null && <StageChip stage={card.stage} onCover={false} small grown={chips} />}
      </View>
      <Readiness card={card} grown={labels} />
    </View>
  );
}

function Tile({ card }: { card: EventCard }) {
  const { open } = useTodayShell();
  const { fontScale, width } = useWindowDimensions();
  const grown = atAccessibilitySizes(fontScale);

  return (
    <Pressable
      onPress={() => open({ to: 'event', id: card.event.id, name: card.name })}
      style={({ pressed }) => [
        styles.tile,
        { width: tileWidth(fontScale, width) },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
    >
      <View style={styles.tileCover}>
        <EventMesh event={card.event} />
        {!grown && (
          <View style={styles.tileChips}>
            <CountChip card={card} onCover small={false} />
            {card.stage != null && <StageChip stage={card.stage} onCover small={false} />}
          </View>
        )}
      </View>
      <View style={styles.tileBody}>
        {grown ? (
          <GrownWords card={card} />
        ) : (
          <>
            <Text size={15} weight="semibold" numberOfLines={2} style={styles.tileName}>
              {card.name}
            </Text>
            <Text size={13} weight="medium" style={[styles.secondary, styles.dates]}>
              {card.dates}
            </Text>
            <Readiness card={card} />
          </>
        )}
      </View>
    </Pressable>
  );
}

function Row({ card, last }: { card: EventCard; last: boolean }) {
  const { open } = useTodayShell();
  const grown = atAccessibilitySizes(useWindowDimensions().fontScale);

  return (
    <Pressable
      onPress={() => open({ to: 'event', id: card.event.id, name: card.name })}
      style={({ pressed }) => [
        styles.eventRow,
        grown && styles.eventRowStacked,
        !last && styles.ruled,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
    >
      <EventThumb event={card.event} side={56} radius={16} />
      {grown ? (
        <GrownWords card={card} />
      ) : (
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
          <Readiness card={card} />
        </View>
      )}
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
  const { events } = moment;

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
            <Tile key={card.event.id} card={card} />
          ))}
        </ScrollView>
      ) : (
        <Panel style={styles.list}>
          {events.map((card, index) => (
            <Row key={card.event.id} card={card} last={index === events.length - 1} />
          ))}
        </Panel>
      )}
    </>
  );
}

const STEPS = ['name', 'place', 'live'] as const;

export function FirstRun({ wide }: { wide: boolean }) {
  const { t } = useTranslation();
  const { open, creates } = useTodayShell();

  return (
    <View style={[styles.first, wide && styles.firstWide]}>
      <SectionHead title={t('todayScreen.firstTitle')} size={24} top={tokens.spaceXxs} />
      <Text size={15} weight="medium" style={[styles.secondary, styles.firstIntro]}>
        {t('todayScreen.firstIntro')}
      </Text>
      {!creates && (
        <Notice
          tone="quiet"
          mark={tokens.marks.info.glyph}
          body={t('eventsScreen.firstRunAskOwner')}
        />
      )}
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
      {creates && (
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
          <Text
            size={TYPE.row}
            weight="semibold"
            wholeLines
            accessible={false}
            style={[styles.onAccent, styles.createWords]}
          >
            {t('todayScreen.startFirst')}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  words: { flex: 1, minWidth: 0, gap: tokens.spaceHair },
  // Under the thumbnail or a tile's cover, in a column, where flex 1 would leave the words no height.
  grownWords: { alignSelf: 'stretch', gap: tokens.spaceHair },
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
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingHorizontal: tokens.spaceHair,
    marginBottom: tokens.spaceLg,
  },
  headStacked: { paddingHorizontal: tokens.spaceHair, marginBottom: tokens.spaceLg },
  headLine: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceMd },
  besideCount: { flexShrink: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  stacked: { alignSelf: 'flex-start' },
  title: { lineHeight: TYPE.head * 1.15 },
  count: {
    minWidth: tokens.space3xl,
    minHeight: tokens.space3xl,
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
    minHeight: tokens.sizeControlDense,
    paddingVertical: tokens.spaceXxs,
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
  weekday: { letterSpacing: STRIP_TRACKING },
  labelRoom: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  dayCircle: { alignItems: 'center', justifyContent: 'center' },
  dayToday: { backgroundColor: tokens.colorAccent },
  dots: { height: tokens.spaceXs, flexDirection: 'row', gap: 3 },
  dot: { width: tokens.spaceXs, height: tokens.spaceXs, borderRadius: 3 },
  bars: { position: 'relative' },
  bar: { position: 'absolute', paddingRight: 3 },
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
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: tokens.spaceXs,
    paddingTop: tokens.spacePillEnd,
    paddingBottom: tokens.spaceXxs,
  },
  dayLineStacked: { paddingTop: tokens.spacePillEnd, paddingBottom: tokens.spaceXxs },
  dayLineShared: { flexDirection: 'row', alignItems: 'baseline', columnGap: tokens.spaceXs },
  waiting: { opacity: 0 },
  nothing: { paddingTop: tokens.spaceXxs, paddingBottom: tokens.spacePillEnd },
  item: { paddingVertical: 7 },
  itemStacked: { paddingVertical: 7, gap: tokens.spaceXs },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceLg },
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
  dates: { marginTop: tokens.spaceHair },
  list: { paddingVertical: tokens.spaceHair },
  eventRow: { flexDirection: 'row', gap: tokens.spacePillEnd, paddingVertical: 13 },
  eventRowStacked: { flexDirection: 'column', alignItems: 'stretch', gap: tokens.spaceMd },
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
    minHeight: tokens.sizeHitPhoneHero,
    paddingVertical: tokens.spaceSm,
    paddingHorizontal: tokens.spaceLg,
    borderRadius: tokens.sizeHitPhoneHero / 2,
    backgroundColor: tokens.colorAccent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spaceSm,
  },
  createWords: { flexShrink: 1, textAlign: 'center' },
  createWide: { alignSelf: 'flex-start', paddingHorizontal: tokens.space4xl },
});
