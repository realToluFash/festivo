import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Glyph } from '../../components/Glyph.tsx';
import { Text } from '../../components/Text.tsx';
import { type WeightName } from '../../theme/fonts.ts';
import { tokens } from '../../theme/tokens.ts';
import {
  BACK_GLYPH,
  HEADER_TEXT,
  NAV_BUTTON_SIDE,
  NAV_LEAST,
  NAV_SIDE,
  PILL_ABOVE,
  PILL_GAP,
  PILL_GLYPH,
  PILL_LEFT,
  PILL_RIGHT,
  PILL_TEXT,
  TITLE_ROW_SIDE,
  backWidth,
  buttonWidth,
  headerForm,
  pillTextSize,
  titleOnItsRow,
} from './focusedHeaderRules.ts';

const LINE = 1.22;

export interface NavSide {
  word: string;
  heard: string;
  onPress: () => void;
  testID: string;
  /** A back label in Cancel's place, and the word it shortens to. */
  short?: string | undefined;
}

type Measured = Readonly<Record<string, number>>;

function Measure({
  texts,
  onWidth,
}: {
  texts: readonly { key: string; text: string; size: number; weight: WeightName }[];
  onWidth: (key: string, width: number) => void;
}) {
  return (
    <View
      style={styles.measure}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {texts.map(({ key, text, size, weight }) => (
        <Text
          key={key}
          size={size}
          weight={weight}
          allowFontScaling={false}
          accessible={false}
          onLayout={(event) => onWidth(key, event.nativeEvent.layout.width)}
        >
          {text}
        </Text>
      ))}
    </View>
  );
}

function NavButton({
  side,
  word,
  weight,
  size,
  scale,
  glyph,
}: {
  side: NavSide;
  word: string;
  weight: WeightName;
  size: number;
  scale: number;
  glyph: boolean;
}) {
  return (
    <Pressable
      onPress={side.onPress}
      style={({ pressed }) => [
        styles.button,
        glyph && styles.buttonBack,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={side.heard}
      testID={side.testID}
    >
      {glyph && (
        <Glyph name="back" size={BACK_GLYPH * scale} ink={tokens.colorAccentText} weight={2.4} />
      )}
      <Text
        size={size}
        weight={weight}
        allowFontScaling={false}
        accessible={false}
        style={styles.accent}
      >
        {word}
      </Text>
    </Pressable>
  );
}

/** FocusNav as proposed, drawn at `scale`: one row, the title under Cancel and the verb, or three rows, whichever first keeps every word whole. */
export function DemoFocusNav({
  scale,
  width,
  title,
  left,
  verb,
}: {
  scale: number;
  width: number;
  title: string;
  left: NavSide | null;
  verb: NavSide | null;
}) {
  const size = HEADER_TEXT * scale;
  const [measured, setMeasured] = useState<Measured>({});
  const titleWords = title.split(/\s+/u).filter((word) => word !== '');
  const leftWords = left == null ? [] : left.short == null ? [left.word] : [left.word, left.short];
  const texts = [
    ...leftWords.map((text) => ({ key: `m|${text}`, text, size, weight: 'medium' as const })),
    ...(verb == null
      ? []
      : [{ key: `s|${verb.word}`, text: verb.word, size, weight: 'semibold' as const }]),
    ...[...new Set([...titleWords, title])].map((text) => ({
      key: `b|${text}`,
      text,
      size,
      weight: 'bold' as const,
    })),
  ];
  const known = texts.every(({ key }) => measured[key] != null);
  const widthOf = (key: string) => measured[key] ?? 0;
  const words = titleWords.map((word) => widthOf(`b|${word}`));
  const space =
    words.length > 1
      ? (widthOf(`b|${title}`) - words.reduce((sum, word) => sum + word, 0)) / (words.length - 1)
      : 0;
  const lefts =
    left == null
      ? [tokens.sizeHit]
      : left.short == null
        ? [buttonWidth(widthOf(`m|${left.word}`))]
        : leftWords.map((word) => backWidth(widthOf(`m|${word}`), scale));
  const verbWidth = verb == null ? 0 : buttonWidth(widthOf(`s|${verb.word}`));
  const { form, at } = known
    ? headerForm({ width, lefts, verb: verbWidth, words, space })
    : { form: 'row' as const, at: 0 };
  const titleSize = form === 'row' ? size : titleOnItsRow(scale, Math.max(...words), width);
  const leftWord = leftWords[at] ?? leftWords[0];
  const back = left?.short != null;

  const leftSide =
    left == null || leftWord == null ? (
      <View style={styles.empty} />
    ) : (
      <NavButton
        side={left}
        word={leftWord}
        weight="medium"
        size={size}
        scale={scale}
        glyph={back}
      />
    );
  const verbSide =
    verb == null ? null : (
      <NavButton
        side={verb}
        word={verb.word}
        weight="semibold"
        size={size}
        scale={scale}
        glyph={false}
      />
    );
  const heading = (
    <Text
      size={titleSize}
      weight="bold"
      allowFontScaling={false}
      accessibilityRole="header"
      style={form === 'row' ? styles.titleCentred : styles.titleStart}
    >
      {title}
    </Text>
  );

  return (
    <View style={styles.nav} testID={`demo.header.${form}`}>
      <Measure
        texts={texts}
        onWidth={(key, value) => {
          setMeasured((now) => (now[key] === value ? now : { ...now, [key]: value }));
        }}
      />
      {form === 'row' && (
        <View style={styles.row}>
          {leftSide}
          <View style={styles.slot}>{heading}</View>
          {verbSide}
        </View>
      )}
      {form === 'under' && (
        <>
          <View style={[styles.row, styles.apart]}>
            {leftSide}
            {verbSide}
          </View>
          <View style={[styles.titleRow, styles.titleUnder]}>{heading}</View>
        </>
      )}
      {form === 'stacked' && (
        <>
          <View style={styles.row}>{leftSide}</View>
          <View style={[styles.titleRow, styles.titleBetween]}>{heading}</View>
          <View style={[styles.row, styles.end]}>{verbSide}</View>
        </>
      )}
    </View>
  );
}

/** Back as proposed: at least 44, a capsule as tall as its word, the ‹ growing with it. */
export function DemoBack({
  scale,
  word,
  heard,
  room,
  onPress,
  testID,
}: {
  scale: number;
  word: string;
  heard: string;
  room: number;
  onPress: () => void;
  testID: string;
}) {
  const full = PILL_TEXT * scale;
  const [measured, setMeasured] = useState<{ key: string; width: number } | null>(null);
  const key = `${full}|${word}`;
  const size = measured?.key === key ? pillTextSize(scale, measured.width, room) : full;

  return (
    <>
      <Measure
        texts={[{ key, text: word, size: full, weight: 'semibold' }]}
        onWidth={(at, width) => setMeasured({ key: at, width })}
      />
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={heard}
        testID={testID}
      >
        <View style={[styles.backGlyph, { height: size * LINE }]}>
          <Glyph
            name="back"
            size={(PILL_GLYPH / PILL_TEXT) * size}
            ink={tokens.colorInk}
            weight={2.4}
          />
        </View>
        <Text size={size} weight="semibold" allowFontScaling={false} accessible={false}>
          {word}
        </Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  measure: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 10000,
    alignItems: 'flex-start',
    opacity: 0,
  },
  nav: {
    borderBottomWidth: 1,
    borderBottomColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  row: {
    minHeight: NAV_LEAST,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: NAV_SIDE,
    paddingVertical: tokens.spaceXxs,
  },
  apart: { justifyContent: 'space-between' },
  end: { justifyContent: 'flex-end' },
  slot: { flex: 1, minWidth: 0, marginHorizontal: tokens.spaceXxs, alignItems: 'center' },
  titleRow: { paddingHorizontal: TITLE_ROW_SIDE },
  titleUnder: { paddingBottom: tokens.spaceLg },
  titleBetween: { paddingBottom: tokens.spaceXxs },
  titleCentred: { textAlign: 'center' },
  titleStart: { textAlign: 'left' },
  empty: { width: tokens.sizeHit, height: tokens.sizeHit },
  button: {
    minHeight: tokens.sizeHit,
    minWidth: tokens.sizeHit,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: NAV_BUTTON_SIDE,
  },
  buttonBack: { gap: tokens.spaceHair, paddingLeft: 6 },
  accent: { color: tokens.colorAccentText },
  pressed: { opacity: tokens.opacityPressed },
  back: {
    alignSelf: 'flex-start',
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: PILL_GAP,
    paddingVertical: PILL_ABOVE,
    paddingLeft: PILL_LEFT,
    paddingRight: PILL_RIGHT,
    borderRadius: tokens.radiusPill,
    backgroundColor: tokens.colorInset,
  },
  backGlyph: { justifyContent: 'center' },
});
