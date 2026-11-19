import { ApiUnreachableError } from '@soirely/api-client';
import {
  type ExportFormat,
  type ExportScope,
  exportColumns,
  exportFileName,
  exportScope,
} from '@soirely/domain';
import { type Ref, type RefObject, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewInstance,
  useWindowDimensions,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { api } from '../api.ts';
import { exportToShare } from '../kit/guestExport.ts';
import { writeToShare } from '../kit/sharedFile.ts';
import { atAccessibilitySizes, titleSize, wordsIn } from '../layout/textSize.ts';
import { cancelUnder } from '../layout/titleFit.ts';
import type { LayoutKind } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { AlertLine } from './AlertLine.tsx';
import { RadioMark } from './RadioMark.tsx';
import { moveScreenReaderFocus, type ScreenReaderTarget } from './screenReaderFocus.ts';
import { Pill } from './SettingsParts.tsx';
import { CappedWholeWords, MeasuredWords, Title } from './Title.tsx';
import { Sheet, sheetsGone } from './Sheet.tsx';
import { TextAction } from './SummaryRows.tsx';
import { Text, TitleCap, type TextHandle } from './Text.tsx';

type Making = 'ready' | 'preparing' | 'failed';

const SETTLED_MS = 450;

/** Export in the Guests header: a secondary pill as tall as its word, or offline the words and the no-signal mark in its place, each word whole (sc-67659), as `/demo/guests?state=exportOffline` draws it. */
export function ExportButton({
  kind,
  offline,
  onPress,
  ref,
  measured = false,
}: {
  kind: LayoutKind;
  offline: boolean;
  onPress: () => void;
  ref?: Ref<ViewInstance> | undefined;
  /** A hidden copy that is only measured, so it carries no test ids (sc-71821). */
  measured?: boolean;
}) {
  const { t } = useTranslation();

  if (offline)
    return (
      <View
        style={[styles.offline, kind === 'phone' && styles.offlinePhone]}
        accessible
        accessibilityLabel={t('guestExport.needsConnection')}
        testID={measured ? undefined : 'guests.export.offline'}
      >
        <NoSignal />
        <CappedWholeWords
          size={13.5}
          weight="semibold"
          style={[styles.secondary, styles.offlineWords]}
        >
          {t('guestExport.needsConnection')}
        </CappedWholeWords>
      </View>
    );

  return (
    <Pill
      ref={ref}
      label={t('guestExport.export')}
      kind="secondary"
      height={tokens.sizeHit}
      full={false}
      grows
      onPress={onPress}
      {...(measured ? {} : { testID: 'guests.export' })}
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

export interface ExportProps {
  event: { id: string; name: string; timeZone: string };
  now: Date;
  /** The ids in This view and on the whole list, each in the list's order. */
  inView: readonly string[];
  everyone: readonly string[];
  narrowing: string;
  needs: boolean;
  offline: boolean;
  onClose: () => void;
  /** The file is written: the dialog closes, and the share sheet opens once its window has gone. */
  onShare: () => void;
}

function useExport(props: ExportProps) {
  const { t } = useTranslation();
  const [asked, setAsked] = useState<ExportScope>('view');
  const [format, setFormat] = useState<ExportFormat>('xlsx');
  const [making, setMaking] = useState<Making>('ready');
  const [refused, setRefused] = useState(false);
  const scope = exportScope(asked, props.inView.length);
  const file = exportFileName(t, props.event, props.now, format);
  const busy = making === 'preparing';

  const share = async () => {
    if (busy) return;
    setRefused(false);
    if (!props.offline) setMaking('preparing');

    const { shared, hand } = await exportToShare({
      offline: props.offline,
      make: () =>
        api.exportGuests(props.event.id, {
          format,
          scope,
          people: scope === 'view' ? props.inView : props.everyone,
        }),
      write: (bytes) => writeToShare(bytes, file, format),
      unreachable: (error) => error instanceof ApiUnreachableError,
    });

    if (hand == null) {
      setMaking(shared === 'failed' ? 'failed' : 'ready');
      setRefused(shared === 'dropped');
      return;
    }
    props.onShare();
    await sheetsGone();
    // The share sheet says nothing back the app can trust, so whatever it does, nothing is shown.
    hand().catch(() => undefined);
  };

  const body = (
    <>
      {making === 'failed' && <AlertLine text={t('guestExport.failed')} />}
      {refused && <AlertLine text={t('guestExport.dropped')} />}
      <Choices
        legend={t('guestExport.who')}
        options={[
          {
            key: 'view',
            name: t('guestExport.thisView', { count: props.inView.length }),
            line: props.inView.length === 0 ? t('guestExport.nothingInView') : props.narrowing,
            off: props.inView.length === 0,
          },
          { key: 'all', name: t('guestExport.allGuests', { count: props.everyone.length }) },
        ]}
        picked={scope}
        onPick={setAsked}
        testID="guests.export.who"
      />
      <Choices
        legend={t('guestExport.format')}
        options={[
          { key: 'xlsx', name: t('guestExport.excel') },
          { key: 'csv', name: t('guestExport.csv') },
        ]}
        picked={format}
        onPick={setFormat}
        testID="guests.export.format"
      />
      <View style={styles.file}>
        <Text size={15} weight="bold" accessibilityRole="header">
          {t('guestExport.file')}
        </Text>
        <Text size={15} weight="semibold" style={styles.lines} testID="guests.export.file">
          {file}
        </Text>
        <Text size={13.5} weight="medium" style={styles.secondary}>
          {t('guestExport.columns')}
        </Text>
        <Text size={14} weight="medium" style={styles.lines} testID="guests.export.columns">
          {exportColumns(props.needs)
            .map((column) => t(`guestExport.column.${column}`))
            .join(' · ')}
        </Text>
      </View>
      {!props.needs && (
        <Text size={14} weight="medium" style={[styles.secondary, styles.lines]}>
          {t('guestExport.noNeeds')}
        </Text>
      )}
    </>
  );

  const foot = (
    <View style={styles.foot}>
      <Text size={13.5} weight="medium" style={[styles.secondary, styles.small]}>
        {t('guestExport.safety')}
      </Text>
      <Pill
        label={busy ? t('guestExport.preparing') : t('guestExport.share')}
        busy={busy}
        onPress={() => void share()}
        testID="guests.export.share"
      />
    </View>
  );

  return { body, foot, held: busy };
}

/** On a phone a bottom sheet, on a tablet in portrait a centred dialog: the note and Share stay at its foot while its body scrolls. */
export function ExportSheet({
  open,
  opener,
  ...props
}: ExportProps & { open: boolean; opener: RefObject<ScreenReaderTarget | null> }) {
  const { t } = useTranslation();
  const { body, foot, held } = useExport(props);
  const [drawn, setDrawn] = useState<number | null>(null);
  const scrolls = atAccessibilitySizes(useWindowDimensions().fontScale);

  return (
    <Sheet
      open={open}
      onClose={props.onClose}
      opener={opener}
      scrimLabel={t('guestList.cancel')}
      held={held}
      testID="guests.export.sheet"
    >
      <TitleCap.Provider value={drawn}>
        <View style={styles.sheetHead}>
          <Head onClose={props.onClose} off={held} onDrawn={setDrawn} />
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
          <Head onClose={props.onClose} off={held} titleRef={title} onDrawn={setDrawn} />
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
  onClose,
  off,
  titleRef,
  onDrawn,
}: {
  onClose: () => void;
  off: boolean;
  titleRef?: Ref<TextHandle>;
  onDrawn: (size: number) => void;
}) {
  const { t } = useTranslation();
  const title = t('guestExport.title');
  const start = titleSize(TITLE, useWindowDimensions().fontScale);
  const titleWords = wordsIn([title]);
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
          {title}
        </Title>
        <View
          style={under ? styles.cancelUnder : styles.cancelBeside}
          onLayout={(event) => setCancel(event.nativeEvent.layout.width)}
        >
          <TextAction
            label={t('guestList.cancel')}
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
