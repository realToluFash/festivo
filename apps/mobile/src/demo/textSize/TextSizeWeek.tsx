import type { TFunction } from 'i18next';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { eventColour } from '../../components/EventMesh.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { Text } from '../../components/Text.tsx';
import { EventThumb, Panel, TYPE } from '../../components/TodayParts.tsx';
import { type AgendaDay, type Moment } from '../../kit/today.ts';
import { tokens } from '../../theme/tokens.ts';
import { momentOf, sayIn } from '../today.ts';
import { cardTileShown, weekStripShown, type TextSizeWeekState } from './textSizeRules.ts';

const STRIP = { circle: 34, number: 17, bar: 30 } as const;
const TIME_COLUMN = 70;

/** Home's This week as proposed at a text size: the strip and the agenda at the default sizes; from the accessibility sizes on, the agenda alone, each time over its row, every line whole. */
export function TextSizeWeek({
  scale,
  language,
  state,
}: {
  scale: number;
  language: string;
  state: TextSizeWeekState;
}) {
  const { t } = useTranslation();
  const moment = useMemo(
    () => inWords(momentOf(state === 'nothing' ? 'quiet' : 'plan', sayIn(language), t), t),
    [language, state, t],
  );
  const big = !weekStripShown(scale);

  return (
    <View testID="demo.textSize.week">
      <View style={styles.head}>
        <Text
          size={TYPE.head * scale}
          weight="bold"
          allowFontScaling={false}
          accessibilityRole="header"
          style={styles.title}
        >
          {t('todayScreen.thisWeek')}
        </Text>
        <View style={styles.fill} />
        <Pressable style={styles.link} accessibilityRole="button">
          <Text
            size={14.5 * scale}
            weight="semibold"
            allowFontScaling={false}
            style={styles.accent}
          >
            {t('todayScreen.tab.calendar')}
          </Text>
          <Glyph name="chevron" size={15} ink={tokens.colorAccent} />
        </Pressable>
      </View>
      {big ? null : (
        <View testID="demo.textSize.weekStrip">
          <Strip moment={moment} t={t} />
        </View>
      )}
      {moment.nextUp == null ? (
        <View testID="demo.textSize.agenda">
          <Agenda days={moment.agenda} nothing={moment.nothing} scale={scale} big={big} />
        </View>
      ) : (
        <Panel style={styles.quiet}>
          <Text
            size={TYPE.row * scale}
            weight="semibold"
            allowFontScaling={false}
            style={styles.quietLine}
          >
            {t('todayScreen.nothingOnThisWeek')}
          </Text>
          <Pressable style={styles.nextUp} accessibilityRole="button">
            {cardTileShown(scale) && <EventThumb event={moment.nextUp.event} side={48} />}
            <View style={styles.words}>
              <Text
                size={12 * scale}
                weight="semibold"
                allowFontScaling={false}
                style={[styles.secondary, styles.caps]}
              >
                {t('todayScreen.nextUp').toLocaleUpperCase()}
              </Text>
              <Text size={15 * scale} weight="semibold" allowFontScaling={false}>
                {moment.nextUp.name}
              </Text>
              <Text
                size={13 * scale}
                weight="medium"
                allowFontScaling={false}
                style={styles.secondary}
              >
                {moment.nextUp.when}
              </Text>
            </View>
            <Glyph name="chevron" ink={tokens.colorInkTertiary} />
          </Pressable>
        </Panel>
      )}
    </View>
  );
}

/** The strip as Home draws it at the default sizes, unchanged. */
function Strip({ moment, t }: { moment: Moment; t: TFunction }) {
  return (
    <Panel style={styles.strip}>
      <View style={styles.days}>
        {moment.days.map((day) => (
          <View key={day.number} style={styles.dayColumn}>
            <Text
              size={TYPE.label}
              weight="semibold"
              allowFontScaling={false}
              style={[styles.weekday, day.today ? styles.accent : styles.secondary]}
            >
              {(day.today ? t('todayScreen.todayShort') : day.weekday).toLocaleUpperCase()}
            </Text>
            <View style={[styles.dayCircle, day.today && styles.dayToday]}>
              <Text
                size={STRIP.number}
                weight="bold"
                allowFontScaling={false}
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
        <View style={[styles.bars, { height: STRIP.bar + tokens.spaceXs }]}>
          {moment.bars.map((bar) => (
            <View
              key={bar.event.id}
              style={[
                styles.bar,
                { left: `${(bar.start / 7) * 100}%`, width: `${(bar.span / 7) * 100}%` },
              ]}
            >
              <View style={[styles.barFill, { borderLeftColor: eventColour(bar.event) }]}>
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    styles.tint,
                    { backgroundColor: eventColour(bar.event) },
                  ]}
                />
                <Text size={12} weight="semibold" allowFontScaling={false} numberOfLines={1}>
                  {`${bar.event.name} · ${bar.label}`}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </Panel>
  );
}

function Agenda({
  days,
  nothing,
  scale,
  big,
}: {
  days: AgendaDay[];
  nothing: string;
  scale: number;
  big: boolean;
}) {
  return (
    <Panel style={styles.agenda}>
      {days.map((day, dayIndex) => {
        const ruled = dayIndex < days.length - 1;

        return (
          <View key={day.date}>
            <View style={styles.dayLine}>
              <Text
                size={14 * scale}
                weight="bold"
                allowFontScaling={false}
                style={day.today ? styles.accent : undefined}
              >
                {day.day}
              </Text>
              <Text
                size={TYPE.sub * scale}
                weight="medium"
                allowFontScaling={false}
                style={styles.secondary}
              >
                {`· ${day.when}`}
              </Text>
            </View>
            {day.items.length === 0 ? (
              <Text
                size={14 * scale}
                weight="medium"
                allowFontScaling={false}
                style={[styles.secondary, styles.nothing, ruled && styles.ruled]}
              >
                {nothing}
              </Text>
            ) : (
              day.items.map((item, index) => {
                const last = index === day.items.length - 1;
                const time = (
                  <Text
                    size={14 * scale}
                    weight="bold"
                    allowFontScaling={false}
                    numberOfLines={big ? undefined : item.allDay ? 2 : 1}
                    style={[styles.figures, !big && styles.timeColumn]}
                  >
                    {item.time}
                  </Text>
                );

                return (
                  <View
                    key={`${item.event.id}${item.time}${item.title}`}
                    style={[
                      big ? styles.itemStacked : styles.item,
                      last && styles.itemLast,
                      last && ruled && styles.ruled,
                    ]}
                  >
                    {big && time}
                    <View style={styles.itemRow}>
                      {!big && time}
                      <View style={[styles.stripe, { backgroundColor: eventColour(item.event) }]} />
                      <View style={styles.words}>
                        <Text size={15 * scale} weight="semibold" allowFontScaling={false}>
                          {item.title}
                        </Text>
                        <Text
                          size={13 * scale}
                          weight="medium"
                          allowFontScaling={false}
                          numberOfLines={big ? undefined : 1}
                          style={styles.secondary}
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

/** The sample moment in the board's language: the demo's English day words put in the app's own. */
function inWords(moment: Moment, t: TFunction): Moment {
  const far = (english: string) =>
    english
      .replace(/\bin (\d+) days\b/, (_, count: string) =>
        t('todayScreen.inDays', { count: Number(count) }),
      )
      .replace(/\btomorrow\b/, t('todayScreen.tomorrow'));

  return {
    ...moment,
    nothing: t('todayScreen.nothingToday'),
    agenda: moment.agenda.map((day) => ({
      ...day,
      day: day.today ? t('todayScreen.today') : day.day,
      when: far(day.when),
      items: day.items.map((item) =>
        item.allDay ? { ...item, time: t('todayScreen.allDay') } : item,
      ),
    })),
    nextUp: moment.nextUp == null ? null : { ...moment.nextUp, when: far(moment.nextUp.when) },
  };
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spaceMd,
    marginBottom: tokens.spaceMd,
  },
  title: { flexShrink: 1, color: tokens.colorInk },
  fill: { flexGrow: 1 },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceHair,
    minHeight: tokens.sizeHit,
  },
  accent: { color: tokens.colorAccent },
  secondary: { color: tokens.colorInkSecondary },
  onAccent: { color: tokens.colorInkOnDark },
  figures: { fontVariant: ['tabular-nums'] },
  caps: { letterSpacing: 12 * 0.06 },
  words: { flex: 1, minWidth: 0, gap: tokens.spaceHair },
  ruled: { borderBottomWidth: 1, borderBottomColor: tokens.colorBorder },
  strip: {
    paddingTop: tokens.spaceXl,
    paddingHorizontal: tokens.spaceMd,
    paddingBottom: tokens.spacePillEnd,
  },
  days: { flexDirection: 'row' },
  dayColumn: { flex: 1, alignItems: 'center', gap: 5 },
  weekday: { letterSpacing: TYPE.label * 0.06 },
  dayCircle: {
    width: STRIP.circle,
    height: STRIP.circle,
    borderRadius: STRIP.circle / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayToday: { backgroundColor: tokens.colorAccent },
  dots: { height: tokens.spaceXs, flexDirection: 'row', gap: 3 },
  dot: { width: tokens.spaceXs, height: tokens.spaceXs, borderRadius: 3 },
  bars: { position: 'relative' },
  bar: { position: 'absolute', top: tokens.spaceXs, height: STRIP.bar, paddingRight: 3 },
  barFill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spaceSm,
    overflow: 'hidden',
    marginLeft: 3,
    borderRadius: tokens.spaceMd,
    borderLeftWidth: tokens.spaceXxs,
  },
  tint: { opacity: 0.16 },
  agenda: { marginTop: tokens.spaceMd, paddingVertical: 0, paddingBottom: tokens.spaceHair },
  dayLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: tokens.spaceXs,
    paddingTop: tokens.spacePillEnd,
    paddingBottom: tokens.spaceXxs,
  },
  nothing: { paddingTop: tokens.spaceXxs, paddingBottom: tokens.spacePillEnd },
  item: { paddingVertical: 7 },
  itemStacked: { paddingVertical: 7, gap: tokens.spaceXs },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceLg },
  itemLast: { paddingBottom: 13 },
  timeColumn: { width: TIME_COLUMN },
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
});
