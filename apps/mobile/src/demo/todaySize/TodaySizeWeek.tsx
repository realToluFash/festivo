import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '../../components/Text.tsx';
import { MeasuredWords } from '../../components/Title.tsx';
import { atAccessibilitySizes } from '../../layout/textSize.ts';
import { tokens } from '../../theme/tokens.ts';
import { EVENT_OF_KEY } from '../events/EventsSample.ts';
import { openEvent } from '../events/openEvent.ts';
import { openedOver } from '../events/opener.ts';
import { EVENTS, sayIn } from '../today.ts';
import { FitWords } from './FitWords.tsx';
import {
  DAY_DATE,
  DAY_NAME,
  SIZE_TODAY,
  WEEK_DAYS,
  type WeekDay,
  dayLineShares,
  daysUntil,
  wordsStart,
} from './todaySizeRules.ts';

/** sc-92250: This week's days at a stand-in size, each day line's date after its dot only while it shares the name's line. */
export function WeekDays({ locale, scale, cap }: { locale: string; scale: number; cap: number }) {
  return (
    <View style={styles.panel}>
      {WEEK_DAYS.map((day, index) => (
        <Day
          key={day.date}
          day={day}
          locale={locale}
          scale={scale}
          cap={cap}
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
  ruled,
}: {
  day: WeekDay;
  locale: string;
  scale: number;
  cap: number;
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
      <DayLine name={name} when={when} today={today} scale={scale} cap={cap} />
      {day.rows.map((row, index) => (
        <Pressable
          key={row.key}
          onPress={() => openEvent(EVENT_OF_KEY[row.key], openedOver('today'))}
          style={({ pressed }) => [
            stacked ? styles.itemStacked : styles.item,
            index === day.rows.length - 1 && styles.itemLast,
            index === day.rows.length - 1 && ruled && styles.ruled,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`${row.time} ${EVENTS[row.key].name}`}
          testID="demo.todaySize.weekRow"
        >
          <Text
            size={14 * scale}
            weight="bold"
            allowFontScaling={false}
            style={[styles.figures, !stacked && styles.time]}
          >
            {row.time}
          </Text>
          <Text size={14 * scale} weight="semibold" allowFontScaling={false} style={styles.shrink}>
            {EVENTS[row.key].name}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function DayLine({
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
  // Below AX1 the line is main's and waits for nothing; from AX1 it is hidden until it knows whether the date shares the name's line.
  const pending = atAccessibilitySizes(scale) && !known;
  const keep = (which: 'name' | 'date') => (_: string, width: number) =>
    setMeasured((now) => {
      const kept = now.key === key ? now : { key };

      return kept[which] === width ? now : { ...kept, [which]: width };
    });
  const nameStyle = [today && styles.accent];

  return (
    <View
      style={[styles.dayLine, pending && styles.waiting]}
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
  oneLine: { flexDirection: 'row', alignItems: 'baseline', columnGap: tokens.spaceXs },
  waiting: { opacity: 0 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    paddingVertical: 7,
    minHeight: tokens.sizeHit,
  },
  itemStacked: { paddingVertical: 7, gap: tokens.spaceXs, minHeight: tokens.sizeHit },
  itemLast: { paddingBottom: 13 },
  ruled: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tokens.colorBorder },
  time: { width: 70 },
  figures: { fontVariant: ['tabular-nums'] },
  shrink: { flexShrink: 1 },
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccent },
  pressed: { opacity: 0.7 },
});
