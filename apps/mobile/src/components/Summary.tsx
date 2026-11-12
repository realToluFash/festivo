import { type ReactNode, type Ref, type RefObject, useContext, useState } from 'react';
import {
  type DimensionValue,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  View,
  type ViewInstance,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { Initials } from './Initials.tsx';
import { useReadOut } from './ReadOut.tsx';
import { AnswerHeading } from './AnswerHeading.tsx';
import { FrameSwitched } from './AppFrame.tsx';
import { useTappedSwitch } from '../tappedSwitch.ts';
import { type TextHandle, Text } from './Text.tsx';
import { Toast } from './Toast.tsx';
import { tokens } from '../theme/tokens.ts';
import type { Box } from '../kit/confettiClearance.ts';
import { CARD_PIECES, Confetti, Cover } from './Cover.tsx';
import { Glyph, type GlyphName } from './Glyph.tsx';
import { Glass } from './TodayCover.tsx';
import { type MarkKind, ShapeMark } from './StatusMark.tsx';
import { TextAction } from './SummaryRows.tsx';
import { useShell } from './settingsShell.ts';
import { Avatar, Back } from './SettingsParts.tsx';
import { TitleFocus } from './SummaryOverlays.tsx';

export {
  bringIntoView,
  ChoiceRow,
  type Filled,
  LevelMeter,
  LevelValue,
  OpenRow,
  useRowClear,
} from './SummaryOpen.tsx';
export {
  HeadCount,
  type ListItem,
  Line,
  Row,
  RowList,
  type RowTag,
  Section,
  SectionHead,
  SELECTED_ROW,
  TITLE_BESIDE_TAG,
  Tag,
  type TagKind,
  TextAction,
  TurningMark,
} from './SummaryRows.tsx';
export { type MarkKind, ShapeMark } from './StatusMark.tsx';
export {
  type Anchor,
  AnchoredMenu,
  anchorUnder,
  Ask,
  AskLayer,
  type AskProps,
  FilterMenu,
  FocusedScreen,
  type FocusVerb,
  type Layer,
  MenuLayer,
  useAnchorFollowsTurn,
} from './SummaryOverlays.tsx';

const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

export interface PageToastProps {
  words: string;
  onClose: () => void;
}

export function PageToast({ words, onClose, bottom }: PageToastProps & { bottom: number }) {
  return (
    <View style={[styles.toast, { bottom }]}>
      <Toast key={words} words={words} onClose={onClose} />
    </View>
  );
}

/** On its side, the section's own list in the Settings list's place: back, the title, the card, the lists. */
export function SummaryColumn({
  title,
  scrollRef,
  children,
}: {
  title: string;
  scrollRef?: Ref<ScrollViewInstance>;
  children: ReactNode;
}) {
  const shell = useShell();

  return (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={COLUMN}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <ColumnHead title={title} onBack={() => shell.toSettings()} />
      {children}
    </ScrollView>
  );
}

/** The head of a section's own list in the Settings list's column: Back to Settings, then the section's title (sc-39471). */
export function ColumnHead({
  title,
  onBack,
  titleRef,
  beside,
}: {
  title: string;
  onBack: () => void;
  titleRef?: RefObject<TextHandle | null>;
  /** At the end of the title's row, as Members' Refreshing… (sc-27046). */
  beside?: ReactNode;
}) {
  return (
    <>
      <Back onPress={onBack} />
      <View style={styles.columnTitleRow}>
        <View style={styles.shrink}>
          <AnswerHeading
            ref={titleRef}
            answer={useTappedSwitch()}
            size={COLUMN_TITLE}
            weight="bold"
            style={styles.columnTitle}
          >
            {title}
          </AnswerHeading>
        </View>
        {beside}
      </View>
      <FrameSwitched />
    </>
  );
}

const COLUMN_TITLE = 26;

/** A section's own list in the Settings list's column on its side. */
export const COLUMN = {
  paddingTop: tokens.spaceXl,
  paddingHorizontal: tokens.spaceXl,
  paddingBottom: tokens.space6xl,
  gap: tokens.spaceLg,
} as const;

export type CardSize = 'page' | 'compact' | 'wide';

const CARD = {
  page: { scale: 1, padding: padded(18, 20, 20), gap: tokens.spaceLg },
  compact: { scale: 0.8, padding: padded(14, 16, 16), gap: 9 },
  wide: { scale: 1.3, padding: padded(20, 24, 22), gap: tokens.spaceLg },
} as const;

function padded(top: number, x: number, bottom: number) {
  return { paddingTop: top, paddingHorizontal: x, paddingBottom: bottom };
}

/** The one Confetti card a page opens with: what it says, and at most one white step. */
export function SummaryCard({
  size = 'page',
  height,
  step,
  backdrop,
  gap,
  words,
  children,
  testID,
}: {
  size?: CardSize;
  height: number;
  step?: StepProps | null;
  /** In the Confetti's place: an event's own cover or colour, with its scrim. */
  backdrop?: ReactNode;
  gap?: number;
  /** Where the card's words are, so the pieces keep clear of them; null draws none until they are measured. */
  words?: readonly Box[] | null;
  children: ReactNode;
  testID?: string;
}) {
  const look = CARD[size];

  return (
    <View
      style={[styles.card, look.padding, { minHeight: height, gap: gap ?? look.gap }]}
      testID={testID}
    >
      {backdrop ?? (
        <>
          <Cover shade="side" pieces={[]} />
          <Confetti pieces={CARD_PIECES} scale={look.scale} words={words} />
        </>
      )}
      {children}
      {step != null && <StepButton {...step} />}
    </View>
  );
}

export interface StepProps {
  label: string;
  onPress: () => void;
  testID?: string;
  ref?: Ref<ViewInstance> | undefined;
  /** Held while what it started is under way; the label then says so. */
  busy?: boolean;
}

/** The card's one next step, the only filled button in B. */
export function StepButton({ label, onPress, testID, ref, busy = false }: StepProps) {
  return (
    <Pressable
      ref={ref}
      onPress={busy ? undefined : onPress}
      style={({ pressed }) => [styles.step, pressed && !busy && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: busy, busy }}
      testID={testID}
    >
      <Text size={15} weight="semibold" accessible={false} style={styles.accent}>
        {label}
      </Text>
      <Glyph name="arrow" size={16} ink={tokens.colorAccent} weight={2.4} />
    </Pressable>
  );
}

export function CardSays({
  text,
  size = 24,
  heading = false,
  accessible,
  ref,
}: {
  text: string;
  size?: number;
  heading?: boolean;
  accessible?: boolean | undefined;
  ref?: Ref<TextHandle> | undefined;
}) {
  return (
    <Text
      ref={ref}
      accessible={accessible}
      size={size}
      weight="bold"
      accessibilityRole={heading ? 'header' : undefined}
      style={[
        styles.white,
        styles.says,
        { lineHeight: Math.round(size * 1.15), letterSpacing: size * -0.015 },
      ]}
    >
      {text}
    </Text>
  );
}

export function CardCounts({
  counts,
  label,
}: {
  counts: readonly { value: number; word: string }[];
  label: string;
}) {
  return (
    <View style={styles.counts} accessible accessibilityLabel={label}>
      {counts.map(({ value, word }) => (
        <View key={word}>
          <Text size={30} weight="bold" accessible={false} style={[styles.white, styles.number]}>
            {String(value)}
          </Text>
          <Text size={13} weight="semibold" accessible={false} style={styles.white}>
            {word}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function OnCard({
  text,
  strong = false,
  accessible,
  ref,
}: {
  text: string;
  strong?: boolean;
  accessible?: boolean | undefined;
  ref?: Ref<TextHandle> | undefined;
}) {
  return (
    <Text
      ref={ref}
      size={14.5}
      weight={strong ? 'semibold' : 'medium'}
      accessible={accessible}
      style={[styles.white, styles.onCard]}
    >
      {text}
    </Text>
  );
}

/** Faces that show the sentence's count, so a screen reader hears the sentence alone. */
export function Faces({
  faces,
  more,
  side = 34,
}: {
  faces: readonly { initials: string; tone: number }[];
  more: number;
  side?: number;
}) {
  const ringed = { padding: 2.5, borderRadius: side / 2 + 2.5 };

  return (
    <View style={styles.faces} {...hidden}>
      {faces.map((face, index) => (
        <View
          key={`${face.initials}.${index}`}
          style={[styles.ring, ringed, index > 0 && styles.overlap]}
        >
          <Avatar initials={face.initials} side={side} tone={face.tone} />
        </View>
      ))}
      {more > 0 && (
        <View style={[styles.ring, ringed, styles.overlap]}>
          <View style={[styles.more, { width: side, height: side, borderRadius: side / 2 }]}>
            <Text size={13} weight="bold" accessible={false} style={styles.accent}>
              {`+${more}`}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

/** A person's initials as a white disc on Confetti, as on the Settings card. */
export function CardFace({ name, side }: { name: string; side: number }) {
  return (
    <View
      style={[styles.cardFace, { width: side, height: side, borderRadius: side / 2 }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Initials name={name} size={Math.round(side * 0.36)} weight="bold" style={styles.accent} />
    </View>
  );
}

/** A glyph in a white disc on Confetti, ringed in glass that takes no room, as a section's card opens. */
export function CardGlyph({ name, side }: { name: GlyphName; side: number }) {
  const ringed = side + RING * 2;

  return (
    <View
      style={[styles.glyphRing, { width: ringed, height: ringed, borderRadius: ringed / 2 }]}
      {...hidden}
    >
      <View style={[StyleSheet.absoluteFill, styles.ringFill]} />
      <View style={[styles.cardFace, { width: side, height: side, borderRadius: side / 2 }]}>
        <Glyph name={name} size={Math.round(side * 0.46)} ink={tokens.colorAccent} weight={2.2} />
      </View>
    </View>
  );
}

const RING = 3;

export function GlassTag({
  word,
  mark,
  shape,
  testID,
}: {
  word: string;
  mark?: MarkKind | undefined;
  shape?: ReactNode;
  testID?: string | undefined;
}) {
  return (
    <Glass height={28} style={styles.glassTag} testID={testID}>
      {shape ?? (mark != null && <ShapeMark kind={mark} side={13} ink={tokens.colorInkOnDark} />)}
      <Text size={13} weight="semibold" numberOfLines={1} style={styles.white}>
        {word}
      </Text>
    </Glass>
  );
}

const ROW_BARS: readonly [DimensionValue, DimensionValue][] = [
  ['58%', '38%'],
  ['46%', '52%'],
  ['64%', '34%'],
  ['50%', '44%'],
];

const ICON_BARS: readonly [DimensionValue, DimensionValue][] = [
  ['44%', '36%'],
  ['38%', '30%'],
  ['34%', '40%'],
  ['46%', '32%'],
  ['30%', '36%'],
  ['52%', '44%'],
];

/** A Sunk block where the card goes and the rows' shapes, heard as the words alone. */
export function LoadingBlock({
  words,
  height = 200,
  icons = false,
}: {
  words: string;
  height?: number;
  icons?: boolean;
}) {
  useReadOut(words);

  return (
    <View style={styles.blocks} accessible accessibilityLabel={words}>
      <View style={[styles.sunkCard, { height }]} />
      <RowShapes icons={icons} />
    </View>
  );
}

/** One sunk segment where a list's tabs go while it loads. */
export function SunkTabs() {
  return <View style={styles.sunkTabs} />;
}

/** Rows' shapes where a section's rows go while they load; with `words`, a screen reader stops on them and hears those. */
export function RowShapes({
  count,
  words,
  icons = false,
}: {
  count?: number;
  words?: string;
  icons?: boolean;
}) {
  const bars = icons ? ICON_BARS : ROW_BARS;

  return (
    <View
      accessible={words != null}
      accessibilityLabel={words}
      accessibilityState={words == null ? undefined : { busy: true }}
    >
      {bars.slice(0, count ?? bars.length).map(([first, second], index) => (
        <View key={index}>
          {index > 0 && <View style={[styles.loadingRule, icons && styles.iconRule]} />}
          <View style={styles.loadingRow}>
            <View style={icons ? styles.iconShape : styles.disc} />
            <View style={styles.bars}>
              <View style={[styles.barThick, { width: first }]} />
              <View style={[styles.barThin, { width: second }]} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

/** In place of the card and the lists: what went wrong, what to do, and Try again. */
export function FailedBlock({
  title,
  line,
  onRetry,
  testID,
}: {
  title: string;
  line: string;
  onRetry: () => void;
  testID: string;
}) {
  const { t } = useTranslation();
  useReadOut(`${title} ${line}`);

  return (
    <View style={styles.failed}>
      <Text size={18} weight="bold" accessibilityRole="header">
        {title}
      </Text>
      <Text size={15} weight="medium" style={styles.secondary}>
        {line}
      </Text>
      <TextAction label={t('frame.tryAgain')} onPress={onRetry} testID={testID} />
    </View>
  );
}

/** A section that loads by itself fails in its own place; FailedBlock is the whole screen's. */
export function SectionFailed({
  title,
  line,
  onRetry,
  testID,
  announce = true,
  takesFocus = false,
}: {
  title: string;
  line?: string;
  onRetry: () => void;
  testID: string;
  /** False keeps the failure from being read out, as when it answers a Try again. */
  announce?: boolean;
  /** In a focused screen, a failure there before the title takes focus takes it instead, its words as one item, and is not read out as well (sc-11032). */
  takesFocus?: boolean;
}) {
  const { t } = useTranslation();
  const focus = useContext(TitleFocus);
  const [focused] = useState(() => takesFocus && focus != null && focus.coming());
  useReadOut(announce ? (line == null ? title : `${title} ${line}`) : null, {
    quietAtMount: focused,
  });

  return (
    <View style={styles.sectionFailed}>
      <View
        ref={focused ? focus?.first : undefined}
        style={styles.sectionWords}
        accessible={focused || undefined}
      >
        <Text size={16} weight="semibold">
          {title}
        </Text>
        {line != null && (
          <Text size={15} weight="medium" style={styles.secondary}>
            {line}
          </Text>
        )}
      </View>
      <TextAction label={t('frame.tryAgain')} onPress={onRetry} testID={testID} />
    </View>
  );
}

const styles = StyleSheet.create({
  blocks: { gap: 18 },
  columnTitle: { letterSpacing: COLUMN_TITLE * -0.02 },
  columnTitleRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceLg },
  shrink: { flexShrink: 1, minWidth: 0 },
  white: { color: tokens.colorInkOnDark },
  says: { maxWidth: '80%' },
  onCard: { lineHeight: 14.5 * 1.4 },
  counts: { flexDirection: 'row', gap: 26 },
  number: { lineHeight: 33, fontVariant: ['tabular-nums'] },
  accent: { color: tokens.colorAccentText },
  secondary: { color: tokens.colorInkSecondary },
  pressed: { opacity: tokens.opacityPressed },
  card: { borderRadius: 26, overflow: 'hidden', backgroundColor: tokens.colorAccent },
  step: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: tokens.spaceSm,
    marginTop: 'auto',
    paddingLeft: 18,
    paddingRight: tokens.spaceXl,
    borderRadius: tokens.sizeHit / 2,
    backgroundColor: tokens.colorCard,
  },
  faces: { flexDirection: 'row', alignItems: 'center', marginLeft: -2.5 },
  ring: { backgroundColor: tokens.colorCard },
  overlap: { marginLeft: -14 },
  more: { alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.colorCard },
  cardFace: { alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.colorCard },
  glyphRing: { alignItems: 'center', justifyContent: 'center', margin: -RING, overflow: 'hidden' },
  ringFill: { backgroundColor: tokens.colorInkOnDark, opacity: 0.28 },
  glassTag: { alignSelf: 'flex-start', gap: tokens.spaceXs, paddingLeft: 9, paddingRight: 11 },
  sunkCard: { borderRadius: 26, backgroundColor: tokens.colorNeutralFill },
  sunkTabs: { height: tokens.sizeHit, borderRadius: 22, backgroundColor: tokens.colorNeutralFill },
  loadingRule: { height: 1, marginLeft: 52, backgroundColor: tokens.colorBorder },
  loadingRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: tokens.spaceLg },
  disc: { width: 40, height: 40, borderRadius: 20, backgroundColor: tokens.colorNeutralFill },
  iconShape: { width: 28, height: 28, borderRadius: 8, backgroundColor: tokens.colorNeutralFill },
  iconRule: { marginLeft: 40 },
  bars: { flex: 1, gap: tokens.spaceSm },
  barThick: { height: 14, borderRadius: 7, backgroundColor: tokens.colorNeutralFill },
  barThin: { height: 12, borderRadius: 6, backgroundColor: tokens.colorNeutralFill },
  failed: { gap: tokens.spaceSm, paddingTop: tokens.spaceXs },
  sectionFailed: { gap: tokens.spaceXxs, paddingTop: tokens.spaceXxs },
  sectionWords: { gap: tokens.spaceXxs },
  toast: { position: 'absolute', left: tokens.spaceXl, right: tokens.spaceXl },
});
