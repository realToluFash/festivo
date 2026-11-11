import { type ReactNode, type RefObject, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import {
  BACK_GLYPH,
  HEADER_TEXT,
  NAV_BUTTON_SIDE,
  NAV_LEAST,
  NAV_SIDE,
  TITLE_ROW_SIDE,
  backWidth,
  buttonWidth,
  headerForm,
  titleOnItsRow,
} from '../layout/focusedHeader.ts';
import { tokens } from '../theme/tokens.ts';
import { Glyph } from './Glyph.tsx';
import { TurningMark } from './SummaryRows.tsx';
import { Text, type TextHandle } from './Text.tsx';
import { MeasuredWords } from './Title.tsx';

export interface FocusVerb {
  label: string;
  on: boolean;
  onPress: () => void;
  removes?: boolean;
  /** While its request is out: the turning mark and its words in Ink 2, off until the answer. */
  busy?: boolean;
  testID?: string;
}

const BUSY_MARK = 14;

/** The first of the header's forms that keeps every word whole; a back label shortens to "Back" before the title takes a second line, as iOS does. */
export function FocusNav({
  title,
  titleRef,
  verb,
  back,
  cancels,
  cancelLabel,
  waits,
  onCancel,
  cancelTestID,
}: {
  title: string;
  titleRef: RefObject<TextHandle | null>;
  verb: FocusVerb | null;
  back: string | undefined;
  cancels: boolean;
  cancelLabel?: string | undefined;
  waits: boolean;
  onCancel: () => void;
  cancelTestID?: string | undefined;
}) {
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const size = HEADER_TEXT * fontScale;
  const [width, setWidth] = useState(0);
  const [measured, setMeasured] = useState<Readonly<Record<string, number>>>({});
  const titleWords = title.split(/\s+/u).filter((word) => word !== '');
  const leftWords = !cancels
    ? []
    : back == null
      ? [cancelLabel ?? t('frame.cancel')]
      : [back, t('frame.back')];
  const groups = [
    { kind: 'm', weight: 'medium', texts: leftWords },
    { kind: 's', weight: 'semibold', texts: verb == null ? [] : [verb.label] },
    { kind: 'b', weight: 'bold', texts: [...titleWords, title] },
  ] as const;
  const known =
    width > 0 &&
    groups.every(({ kind, texts }) =>
      texts.every((text) => measured[`${kind}|${size}|${text}`] != null),
    );
  const widthOf = (kind: string, text: string) => measured[`${kind}|${size}|${text}`] ?? 0;
  const words = titleWords.map((word) => widthOf('b', word));
  const space =
    words.length > 1
      ? (widthOf('b', title) - words.reduce((sum, word) => sum + word, 0)) / (words.length - 1)
      : 0;
  const lefts =
    leftWords.length === 0
      ? [tokens.sizeHit]
      : back == null
        ? leftWords.map((word) => buttonWidth(widthOf('m', word)))
        : leftWords.map((word) => backWidth(widthOf('m', word), fontScale));
  const verbWidth =
    verb == null
      ? 0
      : buttonWidth(
          widthOf('s', verb.label) + (verb.busy === true ? BUSY_MARK + tokens.spaceXs : 0),
        );
  const { form, at } = known
    ? headerForm({ width, lefts, verb: verbWidth, words, space })
    : { form: 'row' as const, at: 0 };
  const titleSize = form === 'row' ? size : titleOnItsRow(fontScale, Math.max(...words), width);
  const leftWord = leftWords[at] ?? leftWords[0];

  const leftSide =
    leftWord == null ? (
      <View style={styles.empty} />
    ) : (
      <Pressable
        onPress={onCancel}
        disabled={waits}
        style={({ pressed }) => [
          styles.button,
          back != null && styles.buttonBack,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={back ?? leftWord}
        accessibilityState={waits ? { disabled: true } : undefined}
        testID={cancelTestID}
      >
        {back != null && (
          <Glyph
            name="back"
            size={BACK_GLYPH * fontScale}
            ink={tokens.colorAccentText}
            weight={2.4}
          />
        )}
        <Text
          size={size}
          weight="medium"
          allowFontScaling={false}
          accessible={false}
          style={waits ? styles.waiting : styles.accent}
        >
          {leftWord}
        </Text>
      </Pressable>
    );
  const verbSide =
    verb == null ? null : (
      <Pressable
        onPress={verb.on ? verb.onPress : undefined}
        disabled={!verb.on}
        style={({ pressed }) => [
          styles.button,
          verb.busy === true && styles.buttonBusy,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={verb.label}
        accessibilityState={{ disabled: !verb.on, busy: verb.busy === true }}
        testID={verb.testID}
      >
        {verb.busy === true && <TurningMark side={BUSY_MARK} />}
        <Text
          size={size}
          weight="semibold"
          allowFontScaling={false}
          accessible={false}
          style={{
            color:
              verb.busy === true
                ? tokens.colorInkSecondary
                : !verb.on
                  ? tokens.colorInkTertiary
                  : verb.removes === true
                    ? tokens.colorBroken
                    : tokens.colorAccentText,
          }}
        >
          {verb.label}
        </Text>
      </Pressable>
    );
  const heading = (
    <Text
      ref={titleRef}
      size={titleSize}
      weight="bold"
      allowFontScaling={false}
      accessibilityRole="header"
      style={form === 'row' ? styles.titleCentred : styles.titleStart}
    >
      {title}
    </Text>
  );
  const rows: Record<typeof form, ReactNode> = {
    row: (
      <View style={styles.row}>
        {leftSide}
        <View style={styles.slot} pointerEvents="none">
          {heading}
        </View>
        {verbSide}
      </View>
    ),
    under: (
      <>
        <View style={[styles.row, styles.apart]}>
          {leftSide}
          {verbSide}
        </View>
        <View style={[styles.titleRow, styles.titleUnder]} pointerEvents="none">
          {heading}
        </View>
      </>
    ),
    stacked: (
      <>
        <View style={styles.row}>{leftSide}</View>
        <View style={[styles.titleRow, styles.titleBetween]} pointerEvents="none">
          {heading}
        </View>
        <View style={[styles.row, styles.end]}>{verbSide}</View>
      </>
    ),
  };

  return (
    <View
      style={styles.nav}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      testID={`focus.header.${form}`}
    >
      {groups.map(({ kind, weight, texts }) => (
        <MeasuredWords
          key={kind}
          words={texts}
          size={size}
          weight={weight}
          allowFontScaling={false}
          onWidth={(text, value) => {
            const key = `${kind}|${size}|${text}`;
            setMeasured((now) => (now[key] === value ? now : { ...now, [key]: value }));
          }}
        />
      ))}
      {rows[form]}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    borderBottomWidth: 1,
    borderBottomColor: tokens.colorBorder,
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
  slot: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: tokens.spaceXxs,
    paddingVertical: tokens.spaceSm,
    alignItems: 'center',
  },
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
  buttonBusy: { gap: tokens.spaceXs },
  accent: { color: tokens.colorAccentText },
  waiting: { color: tokens.colorInkTertiary },
  pressed: { opacity: tokens.opacityPressed },
});
