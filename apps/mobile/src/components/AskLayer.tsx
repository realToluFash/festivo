import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glyph } from './Glyph.tsx';
import { useReadOut, useSendingWords } from './ReadOut.tsx';
import { SETTLED_MS } from './Screen.tsx';
import { moveScreenReaderFocus } from './screenReaderFocus.ts';
import { type TextHandle, Text } from './Text.tsx';
import { Title, useWholeWords } from './Title.tsx';
import { useLayout } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { TextAction, TurningMark } from './SummaryRows.tsx';

export interface AskProps {
  title: string;
  line: string;
  /** `off` while the answer is out: the way back waits in Ink 3. */
  keep: { label: string; testID?: string; off?: boolean };
  /** `busy` while the answer is out: the turning mark and these words in Ink 2, off. None once nothing is left to decide. */
  confirm: {
    label: string;
    testID?: string;
    removes?: boolean;
    busy?: string | undefined;
    /** The words `busy` will say, known before sending, so the two buttons are sized for them from the start. */
    busyWords?: string | undefined;
  } | null;
  onKeep: () => void;
  onConfirm?: () => void;
  /** The line says the question no longer stands, with the alert mark, and is read out. */
  alert?: boolean;
  /** Why the answer did not go, under the line with the alert mark and read out; the verb tries again. */
  failed?: string | null;
  testID?: string;
  width?: number;
  /** After the line, 10 apart: a handover's button and list. */
  body?: ReactNode;
  /** A menu is over it, so a screen reader stays in the menu. */
  covered?: boolean;
  /** Placed this far from the window's top rather than centred: up from under the keys. */
  top?: number | null;
  onPlaced?: (top: number) => void;
}

/** B's one question: what happens, in words, then the way back first and the verb last, red when it removes. Two actions too wide for one line stack with the verb on top (sc-22092). The title and the two actions each step down to keep every word whole; the line keeps the person's size (sc-66727). Too tall for the screen, as at the largest text, it scrolls as a whole (sc-614, sc-30894). */
export function AskLayer({
  title,
  line,
  keep,
  confirm,
  onKeep,
  onConfirm,
  alert = false,
  failed = null,
  testID,
  width,
  body,
  covered = false,
  top = null,
  onPlaced,
}: AskProps) {
  const phone = useLayout().kind === 'phone';
  const frame = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const heading = useRef<TextHandle>(null);
  const [widths, setWidths] = useState({ room: 0, keep: 0, confirm: 0 });
  const [inside, setInside] = useState(0);
  const actionWords = useWholeWords(
    ACTION,
    ACTION * frame.fontScale,
    [keep.label, confirm?.label].filter((label) => label != null),
    { weight: 'semibold' },
  );
  const busyWords = useWholeWords(
    ACTION,
    ACTION * frame.fontScale,
    [confirm?.busyWords ?? confirm?.busy].filter((label) => label != null),
    { weight: 'semibold' },
  );
  const actionScale = Math.min(actionWords.maxFontSizeMultiplier, busyWords.maxFontSizeMultiplier);
  const measured = widths.room > 0 && widths.keep > 0 && (confirm == null || widths.confirm > 0);
  const stacked =
    measured && confirm != null && widths.keep + tokens.space3xl + widths.confirm > widths.room;
  const tallTop = insets.top + tokens.spaceLg;
  const tallBottom = Math.max(insets.bottom, tokens.spaceXxl);
  const placedRoom = frame.height - (top ?? tokens.spaceXxl) - tokens.spaceXxl;
  const tallRoom = frame.height - tallTop - tallBottom;
  const tall = inside > Math.min(placedRoom, tallRoom);
  const laid = (part: keyof typeof widths) => (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    setWidths((now) => (now[part] === width ? now : { ...now, [part]: width }));
  };
  const keepAction = (
    <View key="keep" onLayout={laid('keep')}>
      <TextAction
        label={keep.label}
        onPress={onKeep}
        off={keep.off ?? false}
        maxFontSizeMultiplier={actionScale}
        testID={keep.testID}
      />
    </View>
  );
  const confirmAction = confirm != null && (
    <View key="confirm" onLayout={laid('confirm')}>
      {confirm.busy == null ? (
        <TextAction
          label={confirm.label}
          onPress={() => onConfirm?.()}
          removes={confirm.removes ?? false}
          maxFontSizeMultiplier={actionScale}
          testID={confirm.testID}
        />
      ) : (
        <Pressable
          disabled
          style={styles.busy}
          accessibilityRole="button"
          accessibilityLabel={confirm.busy}
          accessibilityState={{ disabled: true, busy: true }}
          testID={confirm.testID}
        >
          <TurningMark side={BUSY_MARK} />
          <Text
            size={ACTION}
            weight="semibold"
            accessible={false}
            maxFontSizeMultiplier={actionScale}
            style={styles.secondary}
          >
            {confirm.busy}
          </Text>
        </Pressable>
      )}
    </View>
  );

  useSendingWords(confirm?.busy);
  useReadOut(alert ? line : failed);

  useEffect(() => {
    const focus = setTimeout(() => moveScreenReaderFocus(heading.current), SETTLED_MS);

    return () => clearTimeout(focus);
  }, []);

  const lineText = alert ? (
    <AlertLine words={line} />
  ) : (
    <>
      <Text size={15} weight="medium" style={[styles.secondary, styles.askLine]}>
        {line}
      </Text>
      {failed != null && <AlertLine words={failed} />}
    </>
  );
  const content = (
    <>
      <Title ref={heading} size={18} accessibilityRole="header" style={styles.askTitle}>
        {title}
      </Title>
      {body == null ? (
        lineText
      ) : (
        <View style={styles.body}>
          {lineText}
          {body}
        </View>
      )}
      <View
        style={[stacked ? styles.askStack : styles.askActions, !measured && styles.unmeasured]}
        onLayout={(event) => {
          laid('room')(event);
          actionWords.room(event.nativeEvent.layout.width);
          busyWords.room(event.nativeEvent.layout.width - BUSY_MARK - tokens.spaceXs);
        }}
      >
        {actionWords.measure}
        {busyWords.measure}
        {stacked ? [confirmAction, keepAction] : [keepAction, confirmAction]}
      </View>
    </>
  );
  const placed = tall
    ? { justifyContent: 'flex-start' as const, paddingTop: tallTop }
    : top == null
      ? null
      : { justifyContent: 'flex-start' as const, paddingTop: top };

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        styles.askScrim,
        placed,
        tall && { paddingBottom: tallBottom },
      ]}
    >
      <View
        style={[
          styles.dialog,
          tall && styles.dialogTall,
          { maxWidth: width ?? (phone ? 340 : 400) },
        ]}
        accessibilityViewIsModal
        onAccessibilityEscape={onKeep}
        accessibilityElementsHidden={covered}
        importantForAccessibility={covered ? 'no-hide-descendants' : 'auto'}
        onLayout={(event) => onPlaced?.(event.nativeEvent.layout.y)}
        testID={testID}
      >
        <ScrollView
          style={styles.grow}
          contentContainerStyle={styles.inside}
          scrollEnabled={tall}
          bounces={false}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={(_width, height) => setInside(height)}
        >
          {content}
        </ScrollView>
      </View>
    </View>
  );
}

const ACTION = 15;
const BUSY_MARK = 14;

function AlertLine({ words }: { words: string }) {
  return (
    <View style={styles.alert}>
      <View style={styles.alertMark}>
        <Glyph name="alert" size={18} ink={tokens.colorInkSecondary} weight={2.2} />
      </View>
      <Text size={15} weight="medium" style={[styles.askLine, styles.alertLine]}>
        {words}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  secondary: { color: tokens.colorInkSecondary },
  grow: { flexGrow: 0, flexShrink: 1 },
  askScrim: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spaceXxl,
    backgroundColor: tokens.scrimDialog,
  },
  dialog: {
    width: '100%',
    maxHeight: '100%',
    overflow: 'hidden',
    borderRadius: tokens.space3xl,
    backgroundColor: tokens.colorCard,
  },
  dialogTall: { flexShrink: 1 },
  inside: {
    gap: tokens.spaceSm,
    padding: tokens.space3xl,
    paddingBottom: tokens.spaceLg,
  },
  body: { gap: tokens.spaceMd },
  askTitle: { letterSpacing: 18 * -0.01, lineHeight: 18 * 1.3 },
  askLine: { lineHeight: 15 * 1.45 },
  askActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    columnGap: tokens.space3xl,
    paddingTop: tokens.spaceXs,
  },
  askStack: { alignItems: 'flex-end', paddingTop: tokens.spaceXs },
  busy: {
    minHeight: tokens.sizeHit,
    minWidth: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
  },
  alert: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  alertMark: { marginTop: tokens.spaceHair },
  alertLine: { flex: 1 },
  unmeasured: { opacity: 0 },
});
