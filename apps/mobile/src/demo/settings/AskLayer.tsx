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

import { useSendingWords } from '../../components/ReadOut.tsx';
import { SETTLED_MS } from '../../components/Screen.tsx';
import { moveScreenReaderFocus } from '../../components/screenReaderFocus.ts';
import { type TextHandle, Text } from '../../components/Text.tsx';
import { useLayout } from '../../layout/useLayout.ts';
import { tokens } from '../../theme/tokens.ts';
import { TextAction, TurningMark } from './SummaryRows.tsx';

export interface AskProps {
  title: string;
  line: string;
  /** `off` while the answer is out: the way back waits in Ink 3. */
  keep: { label: string; testID?: string; off?: boolean };
  /** `busy` while the answer is out: the turning mark and these words in Ink 2, off. */
  confirm: { label: string; testID?: string; removes?: boolean; busy?: string | undefined };
  onKeep: () => void;
  onConfirm: () => void;
  testID?: string;
  width?: number;
  /** After the line, 10 apart: a handover's button and list. Too tall for the screen, the Ask scrolls as a whole (sc-614). */
  body?: ReactNode;
  /** A menu is over it, so a screen reader stays in the menu. */
  covered?: boolean;
  /** Placed this far from the window's top rather than centred: up from under the keys. */
  top?: number | null;
  onPlaced?: (top: number) => void;
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
  const measured = widths.room > 0 && widths.keep > 0 && widths.confirm > 0;
  const stacked = measured && widths.keep + tokens.space3xl + widths.confirm > widths.room;
  const fits = frame.height - insets.top - tokens.spaceLg - insets.bottom;
  const tall = body != null && inside > fits;
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
        testID={keep.testID}
      />
    </View>
  );
  const confirmAction = (
    <View key="confirm" onLayout={laid('confirm')}>
      {confirm.busy == null ? (
        <TextAction
          label={confirm.label}
          onPress={onConfirm}
          removes={confirm.removes ?? false}
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
          <TurningMark side={14} />
          <Text size={15} weight="semibold" accessible={false} style={styles.secondary}>
            {confirm.busy}
          </Text>
        </Pressable>
      )}
    </View>
  );

  useSendingWords(confirm.busy);

  useEffect(() => {
    const focus = setTimeout(() => moveScreenReaderFocus(heading.current), SETTLED_MS);

    return () => clearTimeout(focus);
  }, []);

  const lineText = (
    <Text size={15} weight="medium" style={[styles.secondary, styles.askLine]}>
      {line}
    </Text>
  );
  const content = (
    <>
      <Text
        ref={heading}
        size={18}
        weight="bold"
        accessibilityRole="header"
        style={styles.askTitle}
      >
        {title}
      </Text>
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
        onLayout={laid('room')}
      >
        {stacked ? [confirmAction, keepAction] : [keepAction, confirmAction]}
      </View>
    </>
  );
  const placed = tall
    ? { justifyContent: 'flex-start' as const, paddingTop: insets.top + tokens.spaceLg }
    : top == null
      ? null
      : { justifyContent: 'flex-start' as const, paddingTop: top };

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        styles.askScrim,
        placed,
        tall && { paddingBottom: Math.max(insets.bottom, tokens.spaceXxl) },
      ]}
    >
      <View
        style={[
          styles.dialog,
          body != null && styles.dialogScrolls,
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
        {body == null ? (
          content
        ) : (
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
        )}
      </View>
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
    gap: tokens.spaceSm,
    padding: tokens.space3xl,
    paddingBottom: tokens.spaceLg,
    borderRadius: tokens.space3xl,
    backgroundColor: tokens.colorCard,
  },
  dialogScrolls: { padding: 0, paddingBottom: 0, maxHeight: '100%', overflow: 'hidden' },
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
  unmeasured: { opacity: 0 },
});
