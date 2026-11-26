import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { eventColour } from '../../components/EventMesh.tsx';
import { Text } from '../../components/Text.tsx';
import { Panel } from '../../components/TodayParts.tsx';
import { MeasuredWords } from '../../components/Title.tsx';
import { tokens } from '../../theme/tokens.ts';
import { EVENTS, sayIn } from '../today.ts';
import {
  STRIP_LABEL,
  STRIP_TRACKING,
  type TodayWeek,
  stripDays,
  stripLabelSize,
} from './todaySizeRules.ts';

/** sc-94682: This week's strip at a stand-in size below AX1, as main draws it; only each day's label differs, stepping down alone where it outgrows its column. */
export function SizeStrip({
  locale,
  scale,
  week,
  wide,
}: {
  locale: string;
  scale: number;
  week: TodayWeek;
  wide: boolean;
}) {
  const { t } = useTranslation();
  const say = sayIn(locale);
  const circle = wide ? 38 : 34;

  return (
    <Panel style={styles.strip}>
      <View style={styles.days}>
        {stripDays(week).map((day, index) => {
          const today = index === 0;
          const dots = day.dots.map((key) => ({ key, ...EVENTS[key] }));

          return (
            <View
              key={day.date}
              style={styles.dayColumn}
              accessible
              accessibilityLabel={`${today ? t('todayScreen.today') : say.weekday(day.date)} ${say.number(day.date)}${
                dots.length > 0 ? `, ${dots.map((event) => event.name).join(', ')}` : ''
              }`}
              testID="demo.todaySize.stripDay"
            >
              <StripLabel
                text={(today
                  ? t('todayScreen.todayShort')
                  : say.weekday(day.date)
                ).toLocaleUpperCase(locale)}
                today={today}
                scale={scale}
              />
              <View
                style={[
                  styles.dayCircle,
                  { width: circle, height: circle, borderRadius: circle / 2 },
                  today && styles.dayToday,
                ]}
              >
                <Text
                  size={(wide ? 18 : 17) * scale}
                  weight="bold"
                  allowFontScaling={false}
                  accessible={false}
                  style={[styles.figures, today && styles.onAccent]}
                >
                  {say.number(day.date)}
                </Text>
              </View>
              <View style={styles.dots}>
                {dots.map((event) => (
                  <View
                    key={event.key}
                    style={[styles.dot, { backgroundColor: eventColour(event) }]}
                  />
                ))}
              </View>
            </View>
          );
        })}
      </View>
    </Panel>
  );
}

/** Above the default size it is hidden until its word and its column are measured, so TODA / Y is never drawn for a frame. */
function StripLabel({ text, today, scale }: { text: string; today: boolean; scale: number }) {
  const start = STRIP_LABEL * scale;
  const key = `${start}|${text}`;
  const [column, setColumn] = useState(0);
  const [measured, setMeasured] = useState<{ key: string; width?: number }>({ key: '' });
  const width = measured.key === key ? measured.width : undefined;
  const known = width != null && column > 0;
  const drawn = known ? stripLabelSize(start, width, [...text].length, column) : start;
  const look = [styles.label, today ? styles.accent : styles.secondary];

  return (
    <View style={styles.labelRoom} onLayout={(event) => setColumn(event.nativeEvent.layout.width)}>
      <MeasuredWords
        words={[text]}
        size={start}
        weight="semibold"
        allowFontScaling={false}
        style={styles.label}
        onWidth={(_, measuredWidth) =>
          setMeasured((now) =>
            now.key === key && now.width === measuredWidth ? now : { key, width: measuredWidth },
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
        style={[look, !known && scale > 1 && styles.waiting]}
        testID={today ? 'demo.todaySize.stripToday' : undefined}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    paddingTop: tokens.spaceXl,
    paddingHorizontal: tokens.spaceMd,
    paddingBottom: tokens.spaceMd,
    marginBottom: tokens.spaceMd,
  },
  days: { flexDirection: 'row' },
  dayColumn: { flex: 1, alignItems: 'center', gap: 5 },
  labelRoom: { alignSelf: 'stretch', alignItems: 'center' },
  label: { letterSpacing: STRIP_TRACKING, textAlign: 'center' },
  dayCircle: { alignItems: 'center', justifyContent: 'center' },
  dayToday: { backgroundColor: tokens.colorAccent },
  dots: { height: tokens.spaceXs, flexDirection: 'row', gap: 3 },
  dot: { width: tokens.spaceXs, height: tokens.spaceXs, borderRadius: 3 },
  figures: { fontVariant: ['tabular-nums'] },
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccent },
  onAccent: { color: tokens.colorInkOnDark },
  waiting: { opacity: 0 },
});
