import type { ReactNode, Ref } from 'react';
import { type ScrollViewInstance, StyleSheet, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RadioMark } from './RadioMark.tsx';
import { Text } from './Text.tsx';
import { tokens } from '../theme/tokens.ts';
import { Glyph } from './Glyph.tsx';
import { Row, type RowProps, type TagKind } from './SummaryRows.tsx';
import { useShell } from './settingsShell.ts';
import { PHONE_TAB_BAR } from './TodayCover.tsx';

const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

export type Filled = 0 | 1 | 2;

/** A level as two bars, none filled for the least and both for the most, always beside its word. */
export function LevelMeter({ filled }: { filled: Filled }) {
  return (
    <View style={styles.meter} {...hidden}>
      {[0, 1].map((bar) => (
        <View key={bar} style={[styles.bar, bar < filled ? styles.barFilled : styles.barEmpty]} />
      ))}
    </View>
  );
}

/** The meter, its word, and a lock when the viewer cannot change it; read out by the row it sits in. */
export function LevelValue({
  filled,
  word,
  locked = false,
}: {
  filled: Filled;
  word: string;
  locked?: boolean;
}) {
  return (
    <View style={styles.value}>
      <LevelMeter filled={filled} />
      <Text size={15} weight="medium" accessible={false} style={styles.secondary}>
        {word}
      </Text>
      {locked && (
        <View {...hidden}>
          <Glyph name="lock" size={14} ink={tokens.colorInkSecondary} weight={2.3} />
        </View>
      )}
    </View>
  );
}

/** A row that opens in place: shut, its value and a chevron down; open, what it holds under a Violet rule. */
export function OpenRow({
  title,
  line,
  openLine,
  lead,
  tag,
  weight,
  lit = false,
  value,
  open,
  onToggle,
  below,
  children,
  accessibilityLabel,
  testID,
  ref,
}: {
  title: string;
  line?: string | undefined;
  openLine?: string | undefined;
  lead?: ReactNode;
  tag?: RowProps['tag'];
  weight?: RowProps['weight'];
  lit?: boolean;
  value?: ReactNode;
  open: boolean;
  onToggle: () => void;
  below?: ReactNode;
  children: ReactNode;
  accessibilityLabel: string;
  testID?: string;
  ref?: Ref<ViewInstance>;
}) {
  const chevron = (
    <View style={open && styles.flipped} {...hidden}>
      <Glyph
        name="down"
        size={18}
        ink={open ? tokens.colorAccent : tokens.colorInkTertiary}
        weight={2.3}
      />
    </View>
  );

  return (
    <View>
      <View>
        {open && lit && <View pointerEvents="none" style={styles.lit} />}
        <Row
          ref={ref}
          title={title}
          line={open && openLine != null ? openLine : line}
          lead={lead}
          tag={tag}
          weight={weight ?? (open ? 'semibold' : 'medium')}
          accent={open}
          trail={
            <>
              {!open && value}
              {chevron}
            </>
          }
          onPress={onToggle}
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ expanded: open }}
          testID={testID}
        />
      </View>
      {open && (
        <View style={styles.opened}>
          {children}
          {below != null && (
            <>
              <View style={styles.rule} />
              {below}
            </>
          )}
        </View>
      )}
    </View>
  );
}

/** How far above the screen's foot an opened row has to end to be clear of the tab bar. */
export function useRowClear(): number {
  const shell = useShell();
  const insets = useSafeAreaInsets();

  return (
    Math.max(insets.bottom, tokens.spaceLg) +
    (shell.layout === 'phone' ? PHONE_TAB_BAR + tokens.spaceLg : 0) +
    tokens.spaceLg
  );
}

/** The opened row's foot just clear of the tab bar, so its lit fill and actions show under the Ask's centred dialog. */
export function bringIntoView(
  block: ViewInstance | null | undefined,
  scroll: ScrollViewInstance | null,
  clear: number,
  animated: boolean,
): void {
  const content = scroll?.getInnerViewRef();
  if (block == null || scroll == null || content == null) return;
  block.measureLayout(content, (_x, y, _width, height) => {
    content.measure((_cx, _cy, _cw, contentHeight) => {
      scroll.measure((_sx, _sy, _sw, shown) => {
        const most = Math.max(0, contentHeight - shown);
        const low = y + height - (shown - clear);
        scroll.scrollTo({ y: Math.min(most, Math.max(0, low)), animated });
      });
    });
  });
}

export function ChoiceRow({
  title,
  line,
  on,
  tag,
  onPress,
  testID,
}: {
  title: string;
  line?: string;
  on: boolean;
  tag?: { kind: TagKind; word: string } | null;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Row
      title={title}
      line={line}
      lead={<RadioMark on={on} />}
      tag={tag}
      accent={on}
      pad={tokens.spaceSm}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      testID={testID}
    />
  );
}

const styles = StyleSheet.create({
  secondary: { color: tokens.colorInkSecondary },
  meter: { flexDirection: 'row', gap: 3 },
  bar: { width: 4, height: 14, borderRadius: 2 },
  barFilled: { backgroundColor: tokens.colorInk },
  barEmpty: { borderWidth: 1.5, borderColor: tokens.colorFieldBorder },
  value: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  flipped: { transform: [{ rotate: '180deg' }] },
  lit: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: -tokens.spaceMd,
    right: -tokens.spaceMd,
    borderRadius: tokens.radiusRow,
    backgroundColor: tokens.colorAccentTint,
  },
  opened: {
    marginLeft: 14,
    paddingLeft: 14,
    paddingTop: tokens.spaceHair,
    paddingBottom: tokens.spaceSm,
    borderLeftWidth: 2,
    borderLeftColor: tokens.colorAccent,
  },
  rule: { height: 1, marginVertical: tokens.spaceXxs, backgroundColor: tokens.colorBorder },
});
