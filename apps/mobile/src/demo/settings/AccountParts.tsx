import { formatCountdown } from '@soirely/domain';
import { type ReactNode, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { Glyph, type GlyphName } from '../Glyph.tsx';
import { Pill, type PillKind, TYPE } from './parts.tsx';
import type { SettingsLayout } from './sample.ts';

const HIDDEN = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

/** A state as a shape and a word: a filled check for yes, an empty ring for not yet. */
export function StateMark({
  on,
  word,
  after,
}: {
  on: boolean;
  word: string;
  after?: string | undefined;
}) {
  return (
    <View style={styles.state}>
      <View {...HIDDEN} style={[styles.mark, on ? styles.markOn : styles.markOff]}>
        {on && <Glyph name="tick" size={12} ink={tokens.marks.done.ink} weight={3.2} />}
      </View>
      <Text size={TYPE.small} weight="semibold" style={on ? styles.ink : styles.secondary}>
        {word}
      </Text>
      {after != null && (
        <Text size={TYPE.small} weight="medium" style={[styles.secondary, styles.shrink]}>
          · {after}
        </Text>
      )}
    </View>
  );
}

export function WhiteRows({ children }: { children: ReactNode[] }) {
  return (
    <View style={styles.white}>
      {children.map((child, index) => (
        <View key={index}>
          {index > 0 && <View style={styles.hairline} />}
          {child}
        </View>
      ))}
    </View>
  );
}

export function ItemRow({
  wide,
  who,
  actions,
  children,
}: {
  wide: boolean;
  who: ReactNode;
  actions?: ReactNode | undefined;
  children?: ReactNode | undefined;
}) {
  const shown = actions != null && actions !== false;

  return (
    <View style={styles.row}>
      {wide ? (
        <View style={styles.line}>
          <View style={styles.who}>{who}</View>
          {shown && <View style={[styles.actions, styles.beside]}>{actions}</View>}
        </View>
      ) : (
        <>
          <View style={styles.who}>{who}</View>
          {shown && <View style={styles.actions}>{actions}</View>}
        </>
      )}
      {children}
    </View>
  );
}

export function Step({ children, gap = 14 }: { children: ReactNode; gap?: number }) {
  return <View style={[styles.step, { gap }]}>{children}</View>;
}

export function WhiteBox({ children, gap = 12 }: { children: ReactNode; gap?: number }) {
  return <View style={[styles.white, styles.box, { gap }]}>{children}</View>;
}

export function Note({ text }: { text: string }) {
  return (
    <Text size={TYPE.small} weight="medium" style={styles.secondary}>
      {text}
    </Text>
  );
}

export function Lead({ text }: { text: string }) {
  return (
    <Text size={TYPE.line} weight="medium" style={styles.secondary}>
      {text}
    </Text>
  );
}

export function SubHead({ text }: { text: string }) {
  return (
    <Text size={17} weight="bold" accessibilityRole="header" style={styles.tight}>
      {text}
    </Text>
  );
}

export function RowPill({
  label,
  kind = 'secondary',
  glyph,
  onPress,
  accessibilityLabel,
  testID,
}: {
  label: string;
  kind?: PillKind;
  glyph?: GlyphName | undefined;
  onPress?: (() => void) | undefined;
  accessibilityLabel?: string | undefined;
  testID?: string | undefined;
}) {
  return (
    <Pill
      label={label}
      kind={kind}
      full={false}
      height={tokens.sizeHit}
      {...given({ glyph, onPress, accessibilityLabel, testID })}
    />
  );
}

export function StepPill({
  layout,
  label,
  kind = 'primary',
  glyph,
  onPress,
  testID,
}: {
  layout: SettingsLayout;
  label: string;
  kind?: PillKind;
  glyph?: GlyphName | undefined;
  onPress?: (() => void) | undefined;
  testID?: string | undefined;
}) {
  return (
    <Pill
      label={label}
      kind={kind}
      full={layout === 'phone'}
      height={tokens.sizeHitPhoneHero}
      {...given({ glyph, onPress, testID })}
    />
  );
}

/** Only the props that hold a value, for a component whose optional props take no undefined. */
export function given<T extends Record<string, unknown>>(
  props: T,
): { [K in keyof T]?: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(props).filter(([, value]) => value !== undefined)) as {
    [K in keyof T]?: Exclude<T[K], undefined>;
  };
}

export function Footnote({
  text,
  link,
  onPress,
}: {
  text: string;
  link: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.footnote}>
      <Text size={TYPE.body} weight="medium" style={styles.secondary}>
        {text}
      </Text>
      <Pill label={link} kind="quiet" full={false} height={tokens.sizeHit} onPress={onPress} />
    </View>
  );
}

/** Seconds until a new code may be sent; an expired code starts with none to wait. */
export function useCountdown(
  seconds: number,
  waiting = true,
): { left: number; restart: () => void } {
  const [left, setLeft] = useState(waiting ? seconds : 0);
  const [round, setRound] = useState(waiting ? 1 : 0);

  useEffect(() => {
    if (round === 0) return undefined;
    const started = Date.now();
    const timer = setInterval(() => {
      const next = Math.max(0, seconds - Math.floor((Date.now() - started) / 1000));
      setLeft(next);
      if (next === 0) clearInterval(timer);
    }, 1000);

    return () => clearInterval(timer);
  }, [seconds, round]);

  return {
    left,
    restart: () => {
      setLeft(seconds);
      setRound((value) => value + 1);
    },
  };
}

export function Resend({
  layout,
  left,
  onSend,
  testID,
}: {
  layout: SettingsLayout | 'task';
  left: number;
  onSend: () => void;
  testID: string;
}) {
  const full = layout === 'phone' || layout === 'task';

  return (
    <View style={styles.resend}>
      {left > 0 ? (
        <Pill
          label={`Send a new code in ${formatCountdown(left)}`}
          kind="off"
          full={full}
          height={tokens.sizeHitPhoneHero}
          testID={testID}
        />
      ) : (
        <Pill
          label="Send a new code"
          kind="secondary"
          full={full}
          height={tokens.sizeHitPhoneHero}
          onPress={onSend}
          testID={testID}
        />
      )}
      <Note text="A new code replaces the last one." />
    </View>
  );
}

export const CODE_FIGURES = { fontVariant: ['tabular-nums' as const], letterSpacing: 1.5 };

const styles = StyleSheet.create({
  state: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  mark: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markOn: { backgroundColor: tokens.marks.done.fill },
  markOff: { borderWidth: 2, borderColor: tokens.colorFieldBorder },
  ink: { color: tokens.colorInk },
  secondary: { color: tokens.colorInkSecondary },
  shrink: { flexShrink: 1 },
  white: { backgroundColor: tokens.colorCard, borderRadius: 18 },
  box: { paddingHorizontal: tokens.spaceXl, paddingVertical: 14 },
  hairline: {
    height: 1,
    backgroundColor: tokens.colorBorder,
    marginHorizontal: tokens.spaceXl,
  },
  row: { paddingHorizontal: tokens.spaceXl, paddingVertical: 14, gap: tokens.spaceLg },
  line: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXl },
  who: { flex: 1, minWidth: 0, gap: 6 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
  beside: { flexShrink: 0, justifyContent: 'flex-end' },
  step: {
    backgroundColor: tokens.colorInset,
    borderRadius: tokens.spaceXl,
    padding: tokens.spaceXl,
  },
  tight: { letterSpacing: -0.17 },
  footnote: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: tokens.spaceXs,
  },
  resend: { gap: tokens.spaceSm },
});
