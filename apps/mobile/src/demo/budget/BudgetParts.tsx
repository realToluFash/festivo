import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Glyph, type GlyphName } from '../../components/Glyph.tsx';
import { useReadOut } from '../../components/ReadOut.tsx';
import { ShapeMark } from '../../components/Summary.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import type { CeilingState } from './BudgetModel.ts';
import { say } from './BudgetWords.ts';

const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

const FILL: Record<CeilingState, string | null> = {
  within: null,
  close: 'M12 12 L12 1.2 A10.8 10.8 0 0 1 22.8 12 Z',
  overIf: 'M12 12 L12 1.2 A10.8 10.8 0 0 1 12 22.8 Z',
  over: 'full',
};

/** sc-90's four states as one ring that fills: Within empty, Close a quarter, Over if all come a half, Over full. */
export function CeilingMark({
  state,
  side = 14,
  ink,
}: {
  state: CeilingState;
  side?: number;
  ink: string;
}) {
  const fill = FILL[state];

  return (
    <View {...hidden}>
      <Svg width={side} height={side} viewBox="0 0 24 24">
        {fill === 'full' && <Circle cx={12} cy={12} r={10.8} fill={ink} />}
        {fill != null && fill !== 'full' && <Path d={fill} fill={ink} />}
        <Circle cx={12} cy={12} r={9.6} fill="none" stroke={ink} strokeWidth={2.6} />
      </Svg>
    </View>
  );
}

export function RingMark({
  dashed = false,
  side = 14,
  ink,
}: {
  dashed?: boolean;
  side?: number;
  ink: string;
}) {
  return (
    <View {...hidden}>
      <Svg width={side} height={side} viewBox="0 0 24 24">
        <Circle
          cx={12}
          cy={12}
          r={9.6}
          fill="none"
          stroke={ink}
          strokeWidth={2.6}
          {...(dashed ? { strokeDasharray: '4 3.2' } : {})}
        />
      </Svg>
    </View>
  );
}

export function UndoMark({ ink }: { ink: string }) {
  return (
    <View {...hidden}>
      <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
        <Path
          d="M3 7v6h6M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"
          stroke={ink}
          strokeWidth={2.3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

function Chip({
  fill,
  ink,
  mark,
  word,
}: {
  fill: string;
  ink: string;
  mark: ReactNode;
  word: string;
}) {
  return (
    <View style={[styles.chip, { backgroundColor: fill }]}>
      {mark}
      <Text size={12.5} weight="semibold" style={{ color: ink }}>
        {word}
      </Text>
    </View>
  );
}

/** A ceiling's state as a tag: amber with its ring, never red; Within on grey. */
export function StateTag({ state }: { state: CeilingState }) {
  const within = state === 'within';
  const ink = within ? tokens.colorInkSecondary : tokens.colorAttentionText;

  return (
    <Chip
      fill={within ? tokens.colorNeutralFill : tokens.colorAttentionTint}
      ink={ink}
      mark={<CeilingMark state={state} side={12} ink={ink} />}
      word={say.state(state)}
    />
  );
}

export function OverdueTag({ word }: { word: string }) {
  return (
    <Chip
      fill={tokens.colorAttentionTint}
      ink={tokens.colorAttentionText}
      mark={
        <View {...hidden}>
          <Glyph name="alert" size={13} ink={tokens.colorAttentionText} weight={2.4} />
        </View>
      }
      word={word}
    />
  );
}

/** An amount: tabular figures that never wrap; Ink for a row's own amount, Ink 2 for a summary row's value. */
export function Amount({ text, quiet = false }: { text: string; quiet?: boolean }) {
  return (
    <Text
      size={15}
      weight={quiet ? 'medium' : 'semibold'}
      accessible={false}
      style={[styles.amount, quiet && styles.secondary]}
    >
      {text}
    </Text>
  );
}

export function MarkWord({ mark, word }: { mark: ReactNode; word: string }) {
  return (
    <View style={styles.markWord}>
      {mark}
      <Text size={15} weight="medium" accessible={false} style={styles.secondary}>
        {word}
      </Text>
    </View>
  );
}

/** B's row, as Row draws it, with a tag of the budget's own beside the title: its label read before its value. */
export function MoneyRow({
  title,
  line,
  value,
  quiet = false,
  trail,
  tag,
  lead,
  opens = false,
  lit = false,
  action,
  onPress,
  testID,
}: {
  title: string;
  line?: string | undefined;
  value?: string | undefined;
  quiet?: boolean;
  trail?: ReactNode;
  tag?: { node: ReactNode; word: string } | undefined;
  lead?: ReactNode;
  opens?: boolean;
  lit?: boolean;
  /** A button at the row's end, as Undo: the words one stop, the button its own. */
  action?: ReactNode;
  onPress?: (() => void) | undefined;
  testID?: string;
}) {
  const named = value == null ? title : `${title}: ${value}`;
  const label = [named, tag?.word, line].filter(Boolean).join('. ');
  const box = [styles.row, { minHeight: line == null ? 52 : 64 }, lit && styles.lit];
  const inner = (
    <>
      <View style={styles.titleRow}>
        <Text size={16} weight="semibold" accessible={false} style={styles.rowTitle}>
          {title}
        </Text>
        {tag?.node}
      </View>
      {line != null && (
        <Text size={14} weight="medium" accessible={false} style={[styles.secondary, styles.line]}>
          {line}
        </Text>
      )}
    </>
  );
  const end = trail ?? (value == null ? null : <Amount text={value} quiet={quiet} />);

  if (action != null)
    return (
      <View style={box} testID={testID}>
        {lead}
        <View style={styles.words} accessible accessibilityLabel={label}>
          {inner}
        </View>
        {end}
        {action}
      </View>
    );

  const words = (
    <>
      {lead}
      <View style={styles.words}>{inner}</View>
      {end}
      {opens && <Glyph name="chevron" size={17} ink={tokens.colorInkTertiary} weight={2.3} />}
    </>
  );

  if (onPress == null)
    return (
      <View style={box} accessible accessibilityLabel={label} testID={testID}>
        {words}
      </View>
    );

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [...box, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
    >
      {words}
    </Pressable>
  );
}

export function CapsHead({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={styles.caps}>
      <Text
        size={12.5}
        weight="semibold"
        accessibilityRole="header"
        style={[styles.capsTitle, styles.secondary]}
      >
        {title.toUpperCase()}
      </Text>
      {right}
    </View>
  );
}

/** Not live: amber with a ring and the time as of; the app's strip has no action (sc-93). */
export function Strip({ words }: { words: string }) {
  return (
    <View style={styles.strip}>
      <View style={styles.stripRing} {...hidden} />
      <Text size={14.5} weight="semibold" style={styles.grow}>
        {words}
      </Text>
    </View>
  );
}

/** After losing vendors (sc-87's words): on Surface, with See plans only where billing is the reader's. */
export function PlanLine({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <View style={styles.plan}>
      <Text size={14.5} weight="medium" style={styles.planText}>
        {text}
      </Text>
      {action}
    </View>
  );
}

export function InfoLine({ text, glyph = 'info' }: { text: string; glyph?: GlyphName }) {
  return (
    <View style={styles.info}>
      <View style={styles.infoMark} {...hidden}>
        <Glyph name={glyph} size={15} ink={tokens.colorInkSecondary} weight={2.1} />
      </View>
      <Text size={14} weight="medium" style={[styles.grow, styles.secondary, styles.infoText]}>
        {text}
      </Text>
    </View>
  );
}

/** A refusal from the server, at the top of a form: red on its tint, said at once. */
export function AlertBox({ text }: { text: string }) {
  useReadOut(text, { interrupts: true });

  return (
    <View style={styles.alert} accessibilityRole="alert">
      <View style={styles.infoMark} {...hidden}>
        <Glyph name="alert" size={16} ink={tokens.colorBrokenText} weight={2.3} />
      </View>
      <Text size={14.5} weight="semibold" style={[styles.grow, styles.broken, styles.alertText]}>
        {text}
      </Text>
    </View>
  );
}

export function LiveMark({ word }: { word: string }) {
  return (
    <View style={styles.live}>
      <View style={styles.liveDot} {...hidden} />
      <Text size={14} weight="semibold">
        {word}
      </Text>
    </View>
  );
}

export function PageTitle({
  title,
  line,
  right,
}: {
  title: string;
  line?: string | undefined;
  right?: ReactNode;
}) {
  return (
    <View style={styles.title}>
      <View style={styles.headRow}>
        <Text size={30} weight="bold" accessibilityRole="header" style={[styles.grow, styles.big]}>
          {title}
        </Text>
        {right}
      </View>
      {line != null && (
        <Text size={15} weight="medium" style={styles.secondary}>
          {line}
        </Text>
      )}
    </View>
  );
}

export function PaidMark() {
  return <ShapeMark kind="yes" side={22} ink={tokens.colorInkOnDark} />;
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  broken: { color: tokens.colorBrokenText },
  chip: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexShrink: 0,
    gap: 5,
    paddingLeft: 7,
    paddingRight: 9,
    borderRadius: 12,
  },
  pressed: { opacity: tokens.opacityPressed },
  row: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceLg, paddingVertical: 11 },
  lit: {
    marginHorizontal: -10,
    paddingHorizontal: 10,
    borderRadius: tokens.radiusRow,
    backgroundColor: tokens.colorAccentTint,
  },
  words: { flex: 1, minWidth: 0, gap: 3 },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 8,
    rowGap: 4,
  },
  rowTitle: { flexShrink: 1, lineHeight: 16 * 1.3 },
  line: { lineHeight: 14 * 1.4 },
  amount: { fontVariant: ['tabular-nums'], flexShrink: 0, textAlign: 'right' },
  markWord: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXs, flexShrink: 0 },
  caps: { minHeight: 36, flexDirection: 'row', alignItems: 'center', paddingTop: tokens.spaceXs },
  capsTitle: { flex: 1, letterSpacing: 12.5 * 0.08 },
  strip: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingVertical: tokens.spaceXs,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: tokens.colorAttentionTint,
  },
  stripRing: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: tokens.colorAttention,
  },
  plan: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: tokens.spaceLg,
    paddingVertical: tokens.spaceMd,
    paddingHorizontal: tokens.spaceXl,
    borderRadius: 14,
    backgroundColor: tokens.colorInset,
  },
  planText: { flexBasis: 200, flexGrow: 1, lineHeight: 14.5 * 1.45 },
  info: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  infoMark: { marginTop: 2 },
  infoText: { lineHeight: 14 * 1.45 },
  alert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceMd,
    paddingVertical: tokens.spaceLg,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: tokens.colorBrokenTint,
  },
  alertText: { lineHeight: 14.5 * 1.45 },
  live: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXs },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.marks.done.fill },
  title: { gap: tokens.spaceXxs, paddingTop: 14 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceMd },
  big: { letterSpacing: 30 * -0.02, lineHeight: 30 * 1.12 },
});
