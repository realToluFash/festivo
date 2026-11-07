import { useEffect, useRef, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';

import { SETTLED_MS } from './Screen.tsx';
import { moveScreenReaderFocus } from './screenReaderFocus.ts';
import { type TextHandle, Text } from './Text.tsx';
import { useLayout } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { TextAction } from './SummaryRows.tsx';

export interface AskProps {
  title: string;
  line: string;
  keep: { label: string; testID?: string };
  confirm: { label: string; testID?: string; removes?: boolean };
  onKeep: () => void;
  onConfirm: () => void;
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
  testID,
  width,
}: AskProps) {
  const phone = useLayout().kind === 'phone';
  const heading = useRef<TextHandle>(null);
  const [widths, setWidths] = useState({ room: 0, keep: 0, confirm: 0 });
  const measured = widths.room > 0 && widths.keep > 0 && widths.confirm > 0;
  const stacked = measured && widths.keep + tokens.space3xl + widths.confirm > widths.room;
  const laid = (part: keyof typeof widths) => (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    setWidths((now) => (now[part] === width ? now : { ...now, [part]: width }));
  };
  const keepAction = (
    <View key="keep" onLayout={laid('keep')}>
      <TextAction label={keep.label} onPress={onKeep} testID={keep.testID} />
    </View>
  );
  const confirmAction = (
    <View key="confirm" onLayout={laid('confirm')}>
      <TextAction
        label={confirm.label}
        onPress={onConfirm}
        removes={confirm.removes ?? false}
        testID={confirm.testID}
      />
    </View>
  );

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
        <Text size={15} weight="medium" style={[styles.secondary, styles.askLine]}>
          {line}
        </Text>
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
  unmeasured: { opacity: 0 },
});
