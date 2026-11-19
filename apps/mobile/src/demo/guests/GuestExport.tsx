import { type ReactNode, type Ref, type RefObject, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewInstance,
  useWindowDimensions,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { AlertLine } from '../../components/AlertLine.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { RadioMark } from '../../components/RadioMark.tsx';
import {
  moveScreenReaderFocus,
  type ScreenReaderTarget,
} from '../../components/screenReaderFocus.ts';
import { Pill } from '../../components/SettingsParts.tsx';
import { Sheet } from '../../components/Sheet.tsx';
import { TextAction } from '../../components/Summary.tsx';
import { Text, TitleCap, type TextHandle } from '../../components/Text.tsx';
import { CappedWholeWords, MeasuredWords, Title } from '../../components/Title.tsx';
import { atAccessibilitySizes, titleSize, wordsIn } from '../../layout/textSize.ts';
import { cancelUnder } from '../../layout/titleFit.ts';
import { tokens } from '../../theme/tokens.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import {
  type Format,
  type Making,
  type Scope,
  type SheetWords,
  XW,
  scopeFor,
} from './GuestExportModel.ts';
import type { Layout } from './GuestsParts.tsx';

const MAKING_MS = 900;
const SETTLED_MS = 450;

/** Export in the Guests header: a secondary pill as tall as its word, or offline the words and the no-signal mark in its place, each word whole (sc-67659). */
export function ExportButton({
  layout,
  offline,
  words = { export: XW.export, needsConnection: XW.needsConnection },
  onPress,
  ref,
}: {
  layout: Layout;
  offline: boolean;
  words?: { export: string; needsConnection: string } | undefined;
  onPress: () => void;
  ref: Ref<ViewInstance>;
}) {
  if (offline)
    return (
      <View
        style={[styles.offline, layout === 'phone' && styles.offlinePhone]}
        accessible
        accessibilityLabel={words.needsConnection}
        testID="guests.export.offline"
      >
        <NoSignal />
        <CappedWholeWords
          size={13.5}
          weight="semibold"
          style={[styles.secondary, styles.offlineWords]}
        >
          {words.needsConnection}
        </CappedWholeWords>
      </View>
    );

  return (
    <Pill
      ref={ref}
      label={words.export}
      kind="secondary"
      height={tokens.sizeHit}
      full={false}
      grows
      onPress={onPress}
      testID="guests.export"
    />
  );
}

function NoSignal() {
  return (
    <Svg
      width={16}
      height={16}
      viewBox="0 0 16 16"
      fill="none"
      stroke={tokens.colorInkSecondary}
      strokeWidth={1.8}
      strokeLinecap="round"
    >
      <Path d="M1.5 6a9.5 9.5 0 0 1 13 0M3.8 8.6a6.2 6.2 0 0 1 8.4 0M6.1 11.1a2.9 2.9 0 0 1 3.8 0" />
      <Path d="M2 2l12 12" />
    </Svg>
  );
}

interface ExportProps {
  words: SheetWords;
  file: (format: Format) => string;
  inView: number;
  everyone: number;
  narrowed: string;
  needs: boolean;
  offline: boolean;
  format: Format;
  making: Making;
  refused: boolean;
  onClose: () => void;
  onShare: (file: string) => void;
}

function useExport(props: ExportProps) {
  const [asked, setAsked] = useState<Scope>('view');
  const [format, setFormat] = useState<Format>(props.format);
  const [making, setMaking] = useState<Making>(props.making);
  const [refused, setRefused] = useState(props.refused);
  const [pressed, setPressed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const file = props.file(format);
  const busy = making === 'preparing';

  useEffect(() => () => clearTimeout(timer.current), []);

  const words = props.words;
  const share = () => {
    if (busy) return;
    if (props.offline) {
      setRefused(true);
      return;
    }
    setRefused(false);
    setPressed(true);
    setMaking('preparing');
    timer.current = setTimeout(() => props.onShare(file), MAKING_MS);
  };

  const body = (
    <>
      {making === 'failed' && <AlertLine text={words.failed} />}
      {refused && <AlertLine text={words.dropped} />}
      <Choices
        legend={words.who}
        options={[
          {
            key: 'view',
            name: words.thisView(props.inView),
            line: props.inView === 0 ? words.nothingInView : props.narrowed,
            off: props.inView === 0,
          },
          { key: 'all', name: words.allGuests(props.everyone) },
        ]}
        picked={scopeFor(asked, props.inView)}
        onPick={setAsked}
        testID="guests.export.who"
      />
      <Choices
        legend={words.format}
        options={[
          { key: 'xlsx', name: words.excel },
          { key: 'csv', name: words.csv },
        ]}
        picked={format}
        onPick={setFormat}
        testID="guests.export.format"
      />
      <View style={styles.file}>
        <Text size={15} weight="bold" accessibilityRole="header">
          {words.file}
        </Text>
        <Text size={15} weight="semibold" style={styles.lines} testID="guests.export.file">
          {file}
        </Text>
        <Text size={13.5} weight="medium" style={styles.secondary}>
          {words.columns}
        </Text>
        <Text size={14} weight="medium" style={styles.lines} testID="guests.export.columns">
          {words.columnsFor(props.needs).join(' · ')}
        </Text>
      </View>
      {!props.needs && (
        <Text size={14} weight="medium" style={[styles.secondary, styles.lines]}>
          {words.noNeeds}
        </Text>
      )}
    </>
  );

  const foot = (
    <View style={styles.foot}>
      <Text size={13.5} weight="medium" style={[styles.secondary, styles.small]}>
        {words.safety}
      </Text>
      <Pill
        label={busy ? words.preparing : words.share}
        busy={busy}
        onPress={share}
        testID="guests.export.share"
      />
    </View>
  );

  return { body, foot, held: busy && pressed };
}

/** On a phone a bottom sheet, on a tablet in portrait a centred dialog: the note and Share stay at its foot while its body scrolls. */
export function ExportSheet({
  open,
  opener,
  ...props
}: ExportProps & { open: boolean; opener: RefObject<ScreenReaderTarget | null> }) {
  const { body, foot, held } = useExport(props);
  const [drawn, setDrawn] = useState<number | null>(null);
  const scrolls = atAccessibilitySizes(useWindowDimensions().fontScale);

  return (
    <Sheet
      open={open}
      onClose={props.onClose}
      opener={opener}
      scrimLabel={props.words.close}
      held={held}
      testID="guests.export.sheet"
    >
      <TitleCap.Provider value={drawn}>
        <View style={styles.sheetHead}>
          <Head words={props.words} onClose={props.onClose} off={held} onDrawn={setDrawn} />
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.body} bounces={false}>
          {body}
          {scrolls && <View style={styles.footScrolled}>{foot}</View>}
        </ScrollView>
        {!scrolls && <View style={styles.sheetFoot}>{foot}</View>}
      </TitleCap.Provider>
    </Sheet>
  );
}

/** On a tablet in landscape the dialog docks beside the list, not modal: the list stays usable and This view follows it. */
export function ExportPanel(props: ExportProps) {
  const { body, foot, held } = useExport(props);
  const title = useRef<TextHandle>(null);
  const [drawn, setDrawn] = useState<number | null>(null);
  const scrolls = atAccessibilitySizes(useWindowDimensions().fontScale);

  useEffect(() => {
    const wait = setTimeout(() => moveScreenReaderFocus(title.current), SETTLED_MS);
    return () => clearTimeout(wait);
  }, []);

  return (
    <View style={styles.panel} testID="guests.export.panel">
      <TitleCap.Provider value={drawn}>
        <View style={styles.panelHead}>
          <Head
            words={props.words}
            onClose={props.onClose}
            off={held}
            titleRef={title}
            onDrawn={setDrawn}
          />
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.panelBody}>
          {body}
          {scrolls && <View style={styles.footScrolled}>{foot}</View>}
        </ScrollView>
        {!scrolls && <View style={styles.panelFoot}>{foot}</View>}
      </TitleCap.Provider>
    </View>
  );
}

const TITLE = tokens.typeTitleDialog.size;

/** sc-72136: the title at a title's steps, each word whole, never under its default size; Cancel beside it where its longest word and Cancel fit the row, else on the row under it at its end. Read in that order: the title, then Cancel. */
function Head({
  words,
  onClose,
  off,
  titleRef,
  onDrawn,
}: {
  words: SheetWords;
  onClose: () => void;
  off: boolean;
  titleRef?: Ref<TextHandle>;
  onDrawn: (size: number) => void;
}) {
  const start = titleSize(TITLE, useWindowDimensions().fontScale);
  const titleWords = wordsIn([words.title]);
  const [measured, setMeasured] = useState<Readonly<Record<string, number>>>({});
  const [room, setRoom] = useState(0);
  const [cancel, setCancel] = useState(0);
  const widths = titleWords.map((word) => measured[`${start}|${word}`]);
  const widest = widths.every((width) => width != null) ? Math.max(0, ...widths) : 0;
  const under = cancelUnder({ room, widest, cancel, gap: tokens.spaceMd });

  return (
    <View onLayout={(event) => setRoom(event.nativeEvent.layout.width)}>
      <MeasuredWords
        words={titleWords}
        size={TITLE}
        weight="bold"
        maxFontSizeMultiplier={start / TITLE}
        onWidth={(word, width) => {
          const key = `${start}|${word}`;
          setMeasured((now) => (now[key] === width ? now : { ...now, [key]: width }));
        }}
      />
      <View style={[styles.head, under && styles.headUnder]} testID="guests.export.head">
        <Title
          size={TITLE}
          accessibilityRole="header"
          style={under ? null : styles.grow}
          ref={titleRef}
          room={room > 0 ? (under ? room : room - tokens.spaceMd - cancel) : undefined}
          onDrawn={onDrawn}
        >
          {words.title}
        </Title>
        <View
          style={under ? styles.cancelUnder : styles.cancelBeside}
          onLayout={(event) => setCancel(event.nativeEvent.layout.width)}
        >
          <TextAction
            label={words.close}
            off={off}
            onPress={onClose}
            testID="guests.export.close"
          />
        </View>
      </View>
    </View>
  );
}

interface Option<Key extends string> {
  key: Key;
  name: string;
  line?: string;
  off?: boolean;
}

function Choices<Key extends string>({
  legend,
  options,
  picked,
  onPick,
  testID,
}: {
  legend: string;
  options: readonly Option<Key>[];
  picked: Key;
  onPick: (key: Key) => void;
  testID: string;
}) {
  return (
    <View style={styles.choices} accessibilityRole="radiogroup">
      <Text size={15} weight="bold" accessibilityRole="header">
        {legend}
      </Text>
      {options.map((option) => {
        const on = option.key === picked;
        const off = option.off === true;

        return (
          <Pressable
            key={option.key}
            onPress={off ? undefined : () => onPick(option.key)}
            disabled={off}
            style={({ pressed }) => [styles.row, on && styles.lit, pressed && styles.pressed]}
            accessibilityRole="radio"
            accessibilityState={{ checked: on, disabled: off }}
            accessibilityLabel={
              option.line == null ? option.name : `${option.name}, ${option.line}`
            }
            testID={`${testID}.${option.key}`}
          >
            <View style={styles.grow}>
              <Text
                size={16}
                weight="semibold"
                accessible={false}
                style={[styles.figures, on && styles.accent, off && styles.secondary]}
              >
                {option.name}
              </Text>
              {option.line != null && (
                <Text
                  size={14}
                  weight="medium"
                  accessible={false}
                  style={[styles.secondary, styles.lines]}
                >
                  {option.line}
                </Text>
              )}
            </View>
            {off ? <View style={styles.offMark} /> : <RadioMark on={on} />}
          </Pressable>
        );
      })}
    </View>
  );
}

/** iOS and Android draw their own share sheet: the demo stands in for it. */
export function ShareStandIn({
  file,
  opener,
  onClose,
}: {
  file: string | null;
  opener: RefObject<ScreenReaderTarget | null>;
  onClose: () => void;
}): ReactNode {
  return (
    <Sheet
      open={file != null}
      onClose={onClose}
      opener={opener}
      scrimLabel={XW.closeShareSheet}
      testID="guests.export.shareSheet"
    >
      <View style={styles.body}>
        <View style={styles.head}>
          <Text size={20} weight="bold" accessibilityRole="header" style={styles.grow}>
            {XW.shareSheet}
          </Text>
        </View>
        <View style={styles.fileRow}>
          <Glyph name="copy" size={18} ink={tokens.colorInkSecondary} weight={2.1} />
          <Text size={15} weight="semibold" style={[styles.grow, styles.lines]}>
            {file}
          </Text>
        </View>
        <DemoOnly title={XW.shareSheetDemo(file ?? '')}>
          <Pill
            label={XW.closeShareSheet}
            kind="secondary"
            height={tokens.sizeHit}
            onPress={onClose}
            testID="guests.export.shareSheet.close"
          />
        </DemoOnly>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
  figures: { fontVariant: ['tabular-nums'] },
  pressed: { opacity: tokens.opacityPressed },
  lines: { lineHeight: 15 * 1.45 },
  small: { lineHeight: 13.5 * 1.45 },
  offline: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
  },
  offlinePhone: { maxWidth: 132 },
  offlineWords: { flexShrink: 1, lineHeight: 13.5 * 1.3 },
  head: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
  },
  headUnder: { flexDirection: 'column', alignItems: 'stretch', gap: tokens.spaceSm },
  cancelBeside: { flexShrink: 0 },
  cancelUnder: { alignSelf: 'flex-end' },
  footScrolled: { paddingBottom: 12 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  sheetHead: { paddingHorizontal: tokens.spaceXxl, paddingTop: 20 },
  body: { gap: 18, paddingHorizontal: tokens.spaceXxl, paddingTop: 12, paddingBottom: 8 },
  sheetFoot: { paddingHorizontal: tokens.spaceXxl, paddingTop: 12, paddingBottom: 20 },
  foot: { gap: 12 },
  choices: { gap: 6 },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: -10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: tokens.radiusRow,
  },
  lit: { backgroundColor: tokens.colorAccentTint },
  offMark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: tokens.colorControlBorder,
  },
  file: {
    gap: 4,
    padding: 16,
    borderWidth: 1,
    borderColor: tokens.colorInsetBorder,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorInset,
  },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXs },
  panel: { flex: 1, backgroundColor: tokens.colorCard },
  panelHead: { paddingHorizontal: 32, paddingTop: 22 },
  panelBody: { gap: 18, paddingHorizontal: 32, paddingTop: 12, paddingBottom: 12 },
  panelFoot: {
    paddingHorizontal: 32,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: tokens.colorBorder,
  },
});
