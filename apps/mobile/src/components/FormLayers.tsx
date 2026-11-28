import { type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { tokens } from '../theme/tokens.ts';
import { Glyph } from './Glyph.tsx';
import { useReadOut } from './ReadOut.tsx';
import { useShellLayout } from './settingsShell.ts';
import { TextAction } from './Summary.tsx';
import { Text } from './Text.tsx';

/** A form's section heading, with the line that counts or explains it. */
export function Legend({ text, line }: { text: string; line?: string | null }) {
  return (
    <View style={styles.legend}>
      <Text size={15} weight="bold" accessibilityRole="header">
        {text}
      </Text>
      {line != null && (
        <Text size={14.5} weight="medium" style={[styles.secondary, styles.figures]}>
          {line}
        </Text>
      )}
    </View>
  );
}

/** A sheet over a focused screen, in that screen's window, since iOS shows one window at a time. */
export function SheetLayer({
  onClose,
  label,
  alert = false,
  onDrawn,
  children,
}: {
  onClose: () => void;
  label: string;
  alert?: boolean;
  onDrawn?: () => void;
  children: ReactNode;
}) {
  const phone = useShellLayout() === 'phone';

  return (
    <View style={[StyleSheet.absoluteFill, !phone && styles.centred]}>
      <Pressable
        style={[StyleSheet.absoluteFill, styles.scrim]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={label}
      />
      <View
        style={phone ? styles.layerPhone : styles.layerWide}
        onLayout={onDrawn}
        accessibilityViewIsModal
        onAccessibilityEscape={onClose}
        accessibilityRole={alert ? 'alert' : undefined}
      >
        <ScrollView bounces={false} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

export function SheetBody({
  title,
  close,
  onClose,
  closeTestID = 'guests.sheet.close',
  children,
}: {
  title: string;
  close: string;
  onClose: () => void;
  closeTestID?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.sheet}>
      <View style={styles.sheetHead}>
        <Text size={20} weight="bold" accessibilityRole="header" style={styles.grow}>
          {title}
        </Text>
        <TextAction label={close} onPress={onClose} testID={closeTestID} />
      </View>
      {children}
    </View>
  );
}

/** Done, said as it shows: the tick and its words. */
export function DoneLine({
  text,
  size = 15,
  reads = true,
}: {
  text: string;
  size?: number;
  /** False where the line's words are said by whatever comes next. */
  reads?: boolean;
}) {
  useReadOut(reads ? text : null);

  return (
    <View style={styles.done}>
      <View style={styles.doneMark}>
        <Glyph name="tick" size={17} ink={tokens.marks.done.fill} weight={2.6} />
      </View>
      <Text size={size} weight="semibold" style={[styles.grow, { lineHeight: size * 1.4 }]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  figures: { fontVariant: ['tabular-nums'] },
  legend: { gap: 4 },
  sheet: { gap: 14, paddingHorizontal: tokens.spaceXxl, paddingTop: 20, paddingBottom: 34 },
  centred: { alignItems: 'center', justifyContent: 'center' },
  scrim: { backgroundColor: tokens.scrimSheet },
  layerPhone: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '88%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: tokens.colorCard,
  },
  layerWide: {
    width: 540,
    maxWidth: '92%',
    maxHeight: '88%',
    borderRadius: tokens.space3xl,
    backgroundColor: tokens.colorCard,
    overflow: 'hidden',
  },
  sheetHead: { minHeight: tokens.sizeHit, flexDirection: 'row', alignItems: 'center' },
  done: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  doneMark: { paddingTop: 1 },
});
