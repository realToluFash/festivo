import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { StatusMark, type MarkTone } from '../components/StatusMark.tsx';
import { StepMark } from '../components/StepMark.tsx';
import { Text } from '../components/Text.tsx';
import { Title } from '../components/Title.tsx';
import { useReadOut } from '../components/ReadOut.tsx';
import { useFocusOnAnswer } from '../components/Screen.tsx';
import type { TextHandle } from '../components/Text.tsx';
import { useLayout } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';

/** A step's title and the one line under it that says what to do. */
export function Heading({
  title,
  intro,
  mark,
  answer,
}: {
  title: string;
  intro?: string;
  mark?: [MarkTone, string];
  /** The tap this step answers: the title takes screen reader focus as it shows. */
  answer?: unknown;
}) {
  const { shown, read } = useFocusOnAnswer<TextHandle>(answer);
  const size = useStepTitleSize();

  return (
    <View ref={shown} style={styles.heading}>
      {mark != null && (
        <View style={styles.mark}>
          <StatusMark tone={mark[0]} word={mark[1]} />
        </View>
      )}
      <Title ref={read} size={size} accessibilityRole="header" style={stepTitle(size)}>
        {title}
      </Title>
      {intro != null && (
        <Text size={CONTROL} style={styles.intro}>
          {intro}
        </Text>
      )}
    </View>
  );
}

const CONTROL = 16;

/** A sign-in step's title: 32 on a phone and 34 in a tablet's sheet. */
export function useStepTitleSize() {
  return useLayout().kind === 'phone' ? 32 : 34;
}

/** Tracked in by 2% of its size. */
export function stepTitle(size: number) {
  return { letterSpacing: size * -0.02 };
}

export function Plain({
  children,
  top = tokens.spaceSm,
  ink = false,
}: {
  children: string;
  top?: number;
  ink?: boolean;
}) {
  return (
    <Text
      size={tokens.typeBodyPhone.size}
      style={[{ marginTop: top }, ink ? styles.ink : styles.secondary]}
    >
      {children}
    </Text>
  );
}

/** What is wrong, in one line under the field, read out as it comes; `quiet` for a notice that is not an error. */
export function Says({ words, quiet = false }: { words: string; quiet?: boolean }) {
  useReadOut(words);

  return (
    <Text size={tokens.typeBody.size} style={[styles.says, quiet && styles.secondary]}>
      {words}
    </Text>
  );
}

export function Confirmed({ words }: { words: string }) {
  useReadOut(words);

  return (
    <View style={styles.confirmed}>
      <Svg
        width={16}
        height={16}
        viewBox="0 0 24 24"
        fill="none"
        stroke={tokens.colorAccentText}
        strokeWidth={2.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Path d="M5 12.5l4.5 4.5L19 7.5" />
      </Svg>
      <Text size={tokens.typeBody.size} weight="semibold" style={styles.accent}>
        {words}
      </Text>
    </View>
  );
}

/** A short numbered list, for when people need to know what comes before it starts. */
export function Steps({ items }: { items: readonly string[] }) {
  return (
    <View style={styles.steps}>
      {items.map((item, index) => (
        <View key={item} style={styles.step}>
          <StepMark step={index + 1} state={index === 0 ? 'now' : 'later'} />
          <Text size={tokens.typeBodyPhone.size} style={styles.stepWords}>
            {item}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** A sheet's content, inset as the app's own sheets are. */
export function SheetBody({ children }: { children: ReactNode }) {
  return <View style={styles.sheetBody}>{children}</View>;
}

/** Controls that are the demo's own and not the design's, such as answering for the organisation. */
export function DemoOnly({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.demo}>
      <Text size={tokens.typeSmall.size} weight="semibold" style={styles.secondary}>
        {title}
      </Text>
      <View style={styles.demoActions}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { marginTop: tokens.spaceLg },
  mark: { marginBottom: tokens.spaceLg },
  intro: { marginTop: tokens.spaceSm, color: tokens.colorInkSecondary, lineHeight: 23 },
  ink: { color: tokens.colorInk },
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
  says: { marginTop: tokens.spaceSm, color: tokens.colorBrokenText },
  confirmed: {
    marginTop: tokens.spaceMd,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
  },
  steps: { marginTop: tokens.space3xl, gap: tokens.spaceXl },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceLg },
  stepWords: { flex: 1, color: tokens.colorInk },
  demo: {
    marginTop: tokens.space4xl,
    padding: tokens.spaceXl,
    gap: tokens.spaceSm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens.colorFieldBorder,
    borderRadius: tokens.radiusInset,
  },
  sheetBody: {
    paddingHorizontal: tokens.space3xl,
    paddingTop: tokens.space3xl,
    paddingBottom: tokens.spaceLg,
  },
  demoActions: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
});
