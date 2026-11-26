import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Text } from '../../components/Text.tsx';
import { MeasuredWords } from '../../components/Title.tsx';
import { atAccessibilitySizes } from '../../layout/textSize.ts';
import { tokens } from '../../theme/tokens.ts';
import { FitWords } from './FitWords.tsx';
import {
  type ArrivedCount,
  FIGURE_LABEL,
  FIGURE_LABEL_LINE,
  FIGURE_NUMBERS,
  FIGURE_NUMBERS_LINE,
  FIGURE_RING,
  figureRing,
  figureRoom,
  wordsSize,
  wordsStart,
} from './todaySizeRules.ts';

/** sc-94022: the live cover's arrived figure at the stand-in size. Below AX1 it is main's (sc-29978). From AX1 its numbers step down as one unit only where they would not fit one line beside the ring, never under 18 and never larger than the name; arrived steps alone, never larger than the numbers; the ring is as tall as the two lines. */
export function SizeFigure({
  count,
  scale,
  cap,
  column,
}: {
  count: ArrivedCount;
  scale: number;
  cap: number;
  column: number;
}) {
  const { t, i18n } = useTranslation();
  const numbers = new Intl.NumberFormat(i18n.language);
  const arrived = numbers.format(count.arrived);
  const of = `/${numbers.format(count.expected)}`;
  const whole = `${arrived}${of}`;
  const big = atAccessibilitySizes(scale);
  const start = wordsStart(FIGURE_NUMBERS, scale, cap);
  const ring = big
    ? figureRing(start, wordsStart(FIGURE_LABEL, scale, Math.min(cap, start)))
    : FIGURE_RING;
  const room = figureRoom(column, ring, tokens.spaceMd);
  const [measured, setMeasured] = useState<{ key: string; width: number } | null>(null);
  const key = `${start}|${whole}`;
  const width = measured?.key === key ? measured.width : null;
  const pending = big && (width == null || column === 0);
  const drawn =
    pending || width == null
      ? start
      : wordsSize(FIGURE_NUMBERS, scale, cap, width, Math.max(room, 1));
  const line = { lineHeight: Math.ceil(drawn * FIGURE_NUMBERS_LINE) };

  return (
    <>
      <MeasuredWords
        words={[whole]}
        size={start}
        weight="bold"
        allowFontScaling={false}
        onWidth={(_, measuredWidth) =>
          setMeasured((now) =>
            now?.key === key && now.width === measuredWidth ? now : { key, width: measuredWidth },
          )
        }
      />
      <View
        style={[styles.figure, pending && styles.waiting]}
        accessible
        accessibilityLabel={t('todayScreen.arrivedOf', {
          count: count.arrived,
          expected: count.expected,
        })}
        testID="demo.todaySize.arrived"
      >
        <Ring side={ring} share={count.arrived / count.expected} />
        <View style={styles.shrink}>
          <View style={styles.numbers} testID="demo.todaySize.arrivedNumbers">
            <Text
              key={`count|${drawn}`}
              size={drawn}
              weight="bold"
              allowFontScaling={false}
              accessible={false}
              style={[styles.white, styles.tabular, line]}
            >
              {arrived}
            </Text>
            <Text
              key={`of|${drawn}`}
              size={drawn}
              weight="semibold"
              allowFontScaling={false}
              accessible={false}
              style={[styles.white, styles.tabular, styles.soft, styles.tight, line]}
            >
              {of}
            </Text>
          </View>
          <FitWords
            text={t('todayScreen.arrivedCount', { count: count.arrived })}
            size={FIGURE_LABEL}
            scale={scale}
            cap={Math.min(cap, drawn)}
            room={room}
            weight="medium"
            line={FIGURE_LABEL_LINE}
            style={[styles.white, styles.soft]}
          />
        </View>
      </View>
    </>
  );
}

/** Main's ring, its stroke growing with its side; read with the figure's words, never on its own. */
function Ring({ side, share }: { side: number; share: number }) {
  const stroke = Math.max(4, Math.round(side / 11));
  const r = (side - stroke) / 2;
  const round = 2 * Math.PI * r;

  return (
    <Svg
      width={side}
      height={side}
      style={styles.ring}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Circle
        cx={side / 2}
        cy={side / 2}
        r={r}
        fill="none"
        stroke={tokens.colorInkOnDark}
        strokeOpacity={0.18}
        strokeWidth={stroke}
      />
      <Circle
        cx={side / 2}
        cy={side / 2}
        r={r}
        fill="none"
        stroke={tokens.colorInkOnDark}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${round * share} ${round}`}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  figure: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceMd },
  numbers: { flexDirection: 'row', alignItems: 'baseline' },
  shrink: { flexShrink: 1 },
  white: { color: tokens.colorInkOnDark },
  soft: { opacity: 0.84 },
  tabular: { fontVariant: ['tabular-nums'] },
  tight: { marginLeft: 1 },
  ring: { transform: [{ rotate: '-90deg' }] },
  waiting: { opacity: 0 },
});
