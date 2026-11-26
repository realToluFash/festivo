import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';

import { eventColour } from '../../components/EventMesh.tsx';
import { Text } from '../../components/Text.tsx';
import { MeasuredWords } from '../../components/Title.tsx';
import { atAccessibilitySizes, dayLineShares } from '../../layout/textSize.ts';
import { tokens } from '../../theme/tokens.ts';
import { EVENTS, sayIn } from '../today.ts';
import { FitWords } from './FitWords.tsx';
import {
  DAY_DATE,
  DAY_NAME,
  SIZE_TODAY,
  WEEK_DAYS,
  type WeekDay,
  daysUntil,
  wordsStart,
} from './todaySizeRules.ts';

/** sc-92250: This week's days at a stand-in size, as main's agenda draws them; only the day line differs, its date after its dot only while it shares the name's line. */
export function WeekDays({
  locale,
  scale,
  cap,
  wide,
}: {
  locale: string;
  scale: number;
  cap: number;
  wide: boolean;
}) {
  return (
    <View style={styles.panel}>
      {WEEK_DAYS.map((day, index) => (
        <Day
          key={day.date}
          day={day}
          locale={locale}
          scale={scale}
          cap={cap}
          wide={wide}
          ruled={index < WEEK_DAYS.length - 1}
        />
      ))}
    </View>
  );
}

function Day({
  day,
  locale,
  scale,
  cap,
  wide,
  ruled,
}: {
  day: WeekDay;
  locale: string;
  scale: number;
  cap: number;
  wide: boolean;
  ruled: boolean;
}) {
  const { t } = useTranslation();
  const say = sayIn(locale);
  const away = daysUntil(SIZE_TODAY, day.date);
  const today = away === 0;
  const name = today ? t('todayScreen.today') : say.day(day.date);
  const when = today
    ? say.day(day.date)
    : away === 1
      ? t('todayScreen.tomorrow')
      : t('todayScreen.inDays', { count: away });
  const stacked = atAccessibilitySizes(scale);

  return (
    <View>
      {stacked ? (
        <FittedDayLine name={name} when={when} today={today} scale={scale} cap={cap} />
      ) : (
        <View style={styles.mainDayLine} testID="demo.todaySize.dayLine">
          <Text
            size={DAY_NAME * scale}
            weight="bold"
            allowFontScaling={false}
            style={today ? styles.accent : undefined}
          >
            {name}
          </Text>
          <Text
            size={DAY_DATE * scale}
            weight="medium"
            allowFontScaling={false}
            style={styles.secondary}
          >
            {`· ${when}`}
          </Text>
        </View>
      )}
      {day.rows.map((row, index) => {
        const last = index === day.rows.length - 1;
        const event = EVENTS[row.key];
        const time = (
          <Text
            size={14 * scale}
            weight="bold"
            allowFontScaling={false}
            numberOfLines={stacked ? undefined : 1}
            style={[styles.figures, !stacked && (wide ? styles.timeWide : styles.time)]}
          >
            {say.clock(row.time)}
          </Text>
        );

        return (
          <View
            key={`${row.key}${row.time}${row.title}`}
            style={[
              stacked ? styles.itemStacked : styles.item,
              last && styles.itemLast,
              last && ruled && styles.ruled,
            ]}
            testID="demo.todaySize.weekRow"
          >
            {stacked && time}
            <View style={styles.itemRow}>
              {!stacked && time}
              <View style={[styles.stripe, { backgroundColor: eventColour(event) }]} />
              <View style={styles.words}>
                <Text size={15 * scale} weight="semibold" allowFontScaling={false}>
                  {row.title}
                </Text>
                <Text
                  size={13 * scale}
                  weight="medium"
                  allowFontScaling={false}
                  numberOfLines={stacked ? undefined : 1}
                  style={styles.secondary}
                >
                  {event.name + (row.note === '' ? '' : ` · ${row.note}`)}
                </Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** From AX1: hidden until it knows whether the dotted date fits beside the name whole; if not, the date takes the line under without its dot. */
function FittedDayLine({
  name,
  when,
  today,
  scale,
  cap,
}: {
  name: string;
  when: string;
  today: boolean;
  scale: number;
  cap: number;
}) {
  const nameAt = wordsStart(DAY_NAME, scale, cap);
  const dateAt = wordsStart(DAY_DATE, scale, cap);
  const dotted = `· ${when}`;
  const key = `${nameAt}|${dateAt}|${name}|${when}`;
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
  const nameStyle = [today && styles.accent];

  return (
    <View
      style={[styles.dayLine, !known && styles.waiting]}
      onLayout={(event: LayoutChangeEvent) => setRoom(event.nativeEvent.layout.width)}
      testID="demo.todaySize.dayLine"
    >
      <MeasuredWords
        words={[name]}
        size={nameAt}
        weight="bold"
        allowFontScaling={false}
        onWidth={keep('name')}
      />
      <MeasuredWords
        words={[dotted]}
        size={dateAt}
        weight="medium"
        allowFontScaling={false}
        onWidth={keep('date')}
      />
      {shares ? (
        <View style={styles.oneLine}>
          <Text size={nameAt} weight="bold" allowFontScaling={false} style={nameStyle}>
            {name}
          </Text>
          <Text size={dateAt} weight="medium" allowFontScaling={false} style={styles.secondary}>
            {dotted}
          </Text>
        </View>
      ) : (
        <>
          <FitWords
            text={name}
            size={DAY_NAME}
            scale={scale}
            cap={cap}
            room={room}
            weight="bold"
            line={1.22}
            style={nameStyle}
          />
          <FitWords
            text={when}
            size={DAY_DATE}
            scale={scale}
            cap={cap}
            room={room}
            weight="medium"
            line={1.22}
            style={styles.secondary}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: tokens.colorInset,
    borderRadius: tokens.space3xl,
    paddingHorizontal: tokens.spaceXl,
    paddingBottom: tokens.spaceHair,
  },
  dayLine: { paddingTop: tokens.spacePillEnd, paddingBottom: tokens.spaceXxs },
  mainDayLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: tokens.spaceXs,
    paddingTop: tokens.spacePillEnd,
    paddingBottom: tokens.spaceXxs,
  },
  oneLine: { flexDirection: 'row', alignItems: 'baseline', columnGap: tokens.spaceXs },
  waiting: { opacity: 0 },
  item: { paddingVertical: 7 },
  itemStacked: { paddingVertical: 7, gap: tokens.spaceXs },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceLg },
  itemLast: { paddingBottom: 13 },
  ruled: { borderBottomWidth: 1, borderBottomColor: tokens.colorBorder },
  time: { width: 70 },
  timeWide: { width: 76 },
  stripe: { width: tokens.spaceXxs, alignSelf: 'stretch', borderRadius: tokens.spaceHair },
  words: { flex: 1, minWidth: 0, gap: tokens.spaceHair },
  figures: { fontVariant: ['tabular-nums'] },
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccent },
});
