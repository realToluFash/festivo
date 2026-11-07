import { useEffect, useRef, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';

import { Glyph } from '../../components/Glyph.tsx';
import { useReadOut } from '../../components/ReadOut.tsx';
import { SETTLED_MS } from '../../components/Screen.tsx';
import { moveScreenReaderFocus } from '../../components/screenReaderFocus.ts';
import { type TextHandle, Text } from '../../components/Text.tsx';
import { useLayout } from '../../layout/useLayout.ts';
import { tokens } from '../../theme/tokens.ts';
import { TextAction } from './SummaryRows.tsx';

export interface AskProps {
  title: string;
  line: string;
  keep: { label: string; testID?: string };
  /** None once nothing is left to decide: the way back is the one action. */
  confirm: { label: string; testID?: string; removes?: boolean } | null;
  onKeep: () => void;
  onConfirm?: () => void;
  /** The line says the question no longer stands, with the alert mark, and is read out. */
  alert?: boolean;
  testID?: string;
  width?: number;
}

/** B's one question: what happens, in words, then the way back first and the verb last, red when it removes. Two actions too wide for one line stack with the verb on top (sc-22092). */
export function AskLayer({
  title,
  line,
  keep,
  confirm,
  onKeep,
  onConfirm,
  alert = false,
  testID,
  width,
}: AskProps) {
  const phone = useLayout().kind === 'phone';
  const heading = useRef<TextHandle>(null);
  const [widths, setWidths] = useState({ room: 0, keep: 0, confirm: 0 });
  const measured = widths.room > 0 && widths.keep > 0 && (confirm == null || widths.confirm > 0);
  const stacked =
    measured && confirm != null && widths.keep + tokens.space3xl + widths.confirm > widths.room;
  const laid = (part: keyof typeof widths) => (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    setWidths((now) => (now[part] === width ? now : { ...now, [part]: width }));
  };
  const keepAction = (
    <View key="keep" onLayout={laid('keep')}>
      <TextAction label={keep.label} onPress={onKeep} testID={keep.testID} />
    </View>
  );
  const confirmAction = confirm != null && (
    <View key="confirm" onLayout={laid('confirm')}>
      <TextAction
        label={confirm.label}
        onPress={() => onConfirm?.()}
        removes={confirm.removes ?? false}
        testID={confirm.testID}
      />
    </View>
  );

  useReadOut(alert ? line : null);

  useEffect(() => {
    const focus = setTimeout(() => moveScreenReaderFocus(heading.current), SETTLED_MS);

    return () => clearTimeout(focus);
  }, []);

  return (
    <View style={[StyleSheet.absoluteFill, styles.askScrim]}>
      <View
        style={[styles.dialog, { maxWidth: width ?? (phone ? 340 : 400) }]}
        accessibilityViewIsModal
        onAccessibilityEscape={onKeep}
        testID={testID}
      >
        <Text
          ref={heading}
          size={18}
          weight="bold"
          accessibilityRole="header"
          style={styles.askTitle}
        >
          {title}
        </Text>
        {alert ? (
          <View style={styles.alert}>
            <View style={styles.alertMark}>
              <Glyph name="alert" size={18} ink={tokens.colorInkSecondary} weight={2.2} />
            </View>
            <Text size={15} weight="medium" style={[styles.askLine, styles.alertLine]}>
              {line}
            </Text>
          </View>
        ) : (
          <Text size={15} weight="medium" style={[styles.secondary, styles.askLine]}>
            {line}
          </Text>
        )}
        <View
          style={[stacked ? styles.askStack : styles.askActions, !measured && styles.unmeasured]}
          onLayout={laid('room')}
        >
          {stacked ? [confirmAction, keepAction] : [keepAction, confirmAction]}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  secondary: { color: tokens.colorInkSecondary },
  askScrim: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spaceXxl,
    backgroundColor: tokens.scrimDialog,
  },
  dialog: {
    width: '100%',
    gap: tokens.spaceSm,
    padding: tokens.space3xl,
    paddingBottom: tokens.spaceLg,
    borderRadius: tokens.space3xl,
    backgroundColor: tokens.colorCard,
  },
  askTitle: { letterSpacing: 18 * -0.01, lineHeight: 18 * 1.3 },
  askLine: { lineHeight: 15 * 1.45 },
  askActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    columnGap: tokens.space3xl,
    paddingTop: tokens.spaceXs,
  },
  askStack: { alignItems: 'flex-end', paddingTop: tokens.spaceXs },
  alert: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  alertMark: { marginTop: tokens.spaceHair },
  alertLine: { flex: 1 },
  unmeasured: { opacity: 0 },
});
