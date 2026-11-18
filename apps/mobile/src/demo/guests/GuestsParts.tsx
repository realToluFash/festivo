import { type ReactNode, type Ref, useEffect, useRef, useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';

import { eventColour } from '../../components/EventMesh.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { BodyTitle, MeasuredWords } from '../../components/Title.tsx';
import { TopPrimary, usePrimaryLabel } from '../../components/TopPrimary.tsx';
import { useReadOut } from '../../components/ReadOut.tsx';
import { type TextHandle, Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { CardBackdrop, PhaseShape } from '../../components/EventCard.tsx';
import type { Shown } from '../events/EventsModel.ts';
import { useShell } from '../../components/settingsShell.ts';
import { Pill } from '../../components/SettingsParts.tsx';
import { Glass } from '../../components/TodayCover.tsx';
import {
  CardSays,
  GlassTag,
  OnCard,
  StepButton,
  SummaryCard,
  TextAction,
} from '../../components/Summary.tsx';
import type { GuestsCardWords } from './GuestsModel.ts';
import { W, say } from './GuestsWords.ts';
import { type MarkKind, ReplyMark } from '../../components/ReplyMark.tsx';
import { DoneLine } from '../../components/FormLayers.tsx';
import { PaneBell, useBellInPane } from '../events/EventFrame.tsx';
import { actionsUnder } from '../../layout/titleFit.ts';

export type Layout = 'phone' | 'portrait' | 'landscape';

const CARD_SIZE = { phone: 'page', portrait: 'wide', landscape: 'compact' } as const;
const CARD_HEIGHT = { phone: 180, portrait: 170, landscape: 140 } as const;

/** The count on a day card: "41 of 98" at 40/700 and "arrived" at 17/600, read as one. */
export function ArrivedCount({ arrived, expected }: { arrived: number; expected: number }) {
  const words = say.arrivedSaid(arrived, expected);

  return (
    <View style={styles.count} accessible accessibilityLabel={words}>
      <Text size={40} weight="bold" accessible={false} style={[styles.white, styles.big]}>
        {say.arrivedOf(arrived, expected)}
      </Text>
      <Text size={17} weight="semibold" accessible={false} style={styles.white}>
        {W.arrived}
      </Text>
    </View>
  );
}

/** Guests' one card: how the room stands in the event's colours, and the one next step. */
export function GuestsCard({
  event,
  words,
  layout,
  onStep,
  stepLabel,
  also = null,
}: {
  event: Shown;
  words: GuestsCardWords;
  layout: Layout;
  onStep: () => void;
  stepLabel: string | null;
  /** sc-46879: the quieter second step, in glass beside the white one. */
  also?: { label: string; onPress: () => void } | null;
}) {
  return (
    <SummaryCard
      size={CARD_SIZE[layout]}
      height={CARD_HEIGHT[layout]}
      backdrop={<CardBackdrop event={event} />}
      testID="guests.card"
    >
      {words.tags.length > 0 && (
        <View style={styles.tags}>
          {words.tags.map((tag) => (
            <GlassTag
              key={tag.word}
              word={tag.word}
              shape={tag.mark == null ? undefined : <PhaseShape mark={tag.mark} />}
            />
          ))}
        </View>
      )}
      {words.count == null ? (
        <CardSays text={words.says} />
      ) : words.count.arrived === 0 ? (
        <CardSays text={say.noneArrived} />
      ) : (
        <ArrivedCount {...words.count} />
      )}
      {words.line != null && <OnCard text={words.line} />}
      {stepLabel != null && (
        <View style={[styles.foot, styles.steps]}>
          <StepButton label={stepLabel} onPress={onStep} testID="guests.card.step" />
          {also != null && <GlassStep {...also} testID="guests.card.also" />}
        </View>
      )}
    </SummaryCard>
  );
}

/** A card's second step: glass, so the white step stays the card's one filled button. */
function GlassStep({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
    >
      <Glass height={tokens.sizeHit} grows style={styles.glassStep}>
        <Text size={15} weight="semibold" accessible={false} style={styles.white}>
          {label}
        </Text>
      </Glass>
    </Pressable>
  );
}

/** A guest's page leads with the cover the guest sees: their reply on glass, their name, one line, one step. */
export function GuestCover({
  event,
  kind,
  word,
  name,
  line,
  step,
  layout,
  nameRef,
}: {
  event: Shown;
  kind: MarkKind;
  word: string;
  name: string;
  line: string | null;
  step: { label: string; onPress: () => void } | null;
  layout: Layout;
  nameRef?: Ref<TextHandle>;
}) {
  return (
    <SummaryCard
      size={CARD_SIZE[layout]}
      height={layout === 'landscape' ? 160 : 190}
      backdrop={<CardBackdrop event={event} />}
      testID="guest.card"
    >
      <View style={styles.tags}>
        <GlassTag
          word={word}
          shape={<ReplyMark kind={kind} side={16} cover={eventColour(event)} />}
        />
      </View>
      <CardSays text={name} heading ref={nameRef} />
      {line != null && <OnCard text={line} />}
      {step != null && (
        <View style={styles.foot}>
          <StepButton label={step.label} onPress={step.onPress} testID="guest.card.step" />
        </View>
      )}
    </SummaryCard>
  );
}

/** The amber panel: duplicates, the 412, the plan limit, replacing a guest's own reply. */
export function Amber({
  title,
  children,
  testID,
}: {
  title: string | null;
  children?: ReactNode;
  testID?: string;
}) {
  useReadOut(title);

  return (
    <View style={styles.amber} accessibilityRole="alert" testID={testID}>
      {title != null && (
        <View style={styles.amberHead}>
          <View style={styles.amberMark}>
            <Glyph name="alert" size={17} ink={tokens.colorAttentionText} weight={2.2} />
          </View>
          <Text
            size={15.5}
            weight="bold"
            accessibilityRole="header"
            style={[styles.grow, styles.amberTitle]}
          >
            {title}
          </Text>
        </View>
      )}
      {children}
    </View>
  );
}

export function AmberLine({ text, ink = false }: { text: string; ink?: boolean }) {
  return (
    <Text size={14} weight="medium" style={[ink ? null : styles.secondary, styles.lines]}>
      {text}
    </Text>
  );
}

export function Choices({
  first,
  second,
  primary = false,
}: {
  first: { label: string; onPress: () => void; testID: string };
  second: { label: string; onPress: () => void; testID: string };
  primary?: boolean;
}) {
  return (
    <View style={styles.choices}>
      <Pill
        label={first.label}
        kind={primary ? 'primary' : 'secondary'}
        height={tokens.sizeHit}
        full={false}
        onPress={first.onPress}
        testID={first.testID}
      />
      <Pill
        label={second.label}
        kind="secondary"
        height={tokens.sizeHit}
        full={false}
        onPress={second.onPress}
        testID={second.testID}
      />
    </View>
  );
}

/** The house toast: Ink, a 44 close, and at most one action; it goes after 6 seconds. */
export function GuestToast({
  words,
  action,
  onClose,
  bottom,
}: {
  words: string;
  action?: { label: string; onPress: () => void } | null;
  onClose: () => void;
  bottom: number;
}) {
  const close = useRef(onClose);
  useReadOut(words);

  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const wait = setTimeout(() => close.current(), 6000);
    return () => clearTimeout(wait);
  }, [words]);

  return (
    <View style={[styles.toast, { bottom }]} testID="guests.toast">
      <Text size={15} weight="medium" style={[styles.grow, styles.white]}>
        {words}
      </Text>
      {action != null && (
        <Pressable
          onPress={action.onPress}
          style={({ pressed }) => [styles.toastAction, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          testID="guests.toast.action"
        >
          <Text size={15} weight="semibold" accessible={false} style={styles.toastAct}>
            {action.label}
          </Text>
        </Pressable>
      )}
      <Pressable
        onPress={onClose}
        style={({ pressed }) => [styles.toastClose, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={W.close}
        testID="guests.toast.close"
      >
        <Glyph name="x" size={16} ink={tokens.colorInkOnDark} weight={2.4} />
      </Pressable>
    </View>
  );
}

/** A group's head: the word at 18/700 and " · n" in Ink 2, read as one heading. */
export function GroupHead({
  word,
  count,
  right,
}: {
  word: string;
  count: number;
  right?: ReactNode;
}) {
  return (
    <View style={styles.head}>
      <View
        style={styles.headWords}
        accessible
        accessibilityRole="header"
        accessibilityLabel={`${word}, ${count}`}
      >
        <Text size={18} weight="bold" accessible={false} style={styles.headTitle}>
          {word}
        </Text>
        <Text
          size={18}
          weight="semibold"
          accessible={false}
          style={[styles.secondary, styles.figures, styles.headTitle]}
        >
          {` · ${count}`}
        </Text>
      </View>
      {right}
    </View>
  );
}

/** "21 of 156 shown" as a polite status, with Clear at its right. */
export function ShownLine({
  shown,
  total,
  onClear,
}: {
  shown: number;
  total: number;
  onClear: () => void;
}) {
  const words = say.shown(shown, total);
  useReadOut(words);

  return (
    <View style={styles.shown}>
      <Text size={15} weight="semibold" style={[styles.grow, styles.figures]} testID="guests.shown">
        {words}
      </Text>
      <TextAction label={W.clear} onPress={onClear} testID="guests.clear" />
    </View>
  );
}

/** The title row as the product draws it: the title keeps its words whole under its cap, and the + keeps its label only where the title and the labelled + both fit beside what is there (sc-67338, sc-51444, sc-67659). Where the title at its default size has no room beside Export and the round +, those two go together to a row under it (sc-68417). */
export function GuestsTitle({
  layout,
  title = W.guests,
  plus,
  onPlus,
  plusLabel = W.addGuest,
  extra = null,
}: {
  layout: Layout;
  title?: string;
  plus: boolean;
  onPlus: () => void;
  plusLabel?: string;
  extra?: ReactNode;
}) {
  const size = layout === 'landscape' ? 26 : 30;
  const titleStyle = { lineHeight: size * 1.12, letterSpacing: size * -0.02 };
  const label = usePrimaryLabel({
    title,
    size,
    style: titleStyle,
    label: plus ? plusLabel : undefined,
    gap: tokens.spaceMd,
    labelled: layout !== 'phone',
  });
  const bell = useBellInPane();
  const [room, setRoom] = useState(0);
  const [extraWidth, setExtraWidth] = useState(0);
  const [titleWidth, setTitleWidth] = useState(0);
  const under = actionsUnder({
    room,
    title: titleWidth,
    extra: extra == null ? 0 : extraWidth,
    plus: plus ? tokens.sizeHit : 0,
    bell: bell ? tokens.sizeHit : 0,
    refreshing: 0,
    gap: tokens.spaceMd,
  });
  const widthOf = (set: (width: number) => void) => (event: LayoutChangeEvent) =>
    set(Math.ceil(event.nativeEvent.layout.width));
  const heading = (
    <View style={styles.grow} onLayout={label.onSlot}>
      {label.measure}
      <BodyTitle size={size} accessibilityRole="header" style={titleStyle} testID="guests.title">
        {title}
      </BodyTitle>
    </View>
  );
  const actions = (
    <>
      {extra != null && (
        <View style={under && styles.shrink} onLayout={widthOf(setExtraWidth)}>
          {extra}
        </View>
      )}
      {plus && (
        <TopPrimary
          label={plusLabel}
          onPress={onPlus}
          wide={label.wide && !under}
          testID="guests.add"
        />
      )}
    </>
  );

  return (
    <View
      style={under ? styles.titleStack : styles.titleRow}
      onLayout={widthOf(setRoom)}
      testID="guests.titleRow"
    >
      <MeasuredWords
        words={[title]}
        size={size}
        weight="bold"
        style={titleStyle}
        maxFontSizeMultiplier={1}
        onWidth={(_, width) => setTitleWidth(Math.ceil(width))}
      />
      {under ? (
        <>
          <View style={styles.titleRow}>
            {heading}
            <PaneBell />
          </View>
          <View style={styles.actionsRow} testID="guests.actionsRow">
            {actions}
          </View>
        </>
      ) : (
        <>
          {heading}
          {actions}
          <PaneBell />
        </>
      )}
    </View>
  );
}

export function BlockHead({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={styles.head}>
      <Text
        size={18}
        weight="bold"
        accessibilityRole="header"
        style={[styles.grow, styles.headTitle]}
      >
        {title}
      </Text>
      {right}
    </View>
  );
}

export function useLayoutKind(): Layout {
  return useShell().layout;
}

export { DoneLine };

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  white: { color: tokens.colorInkOnDark },
  secondary: { color: tokens.colorInkSecondary },
  figures: { fontVariant: ['tabular-nums'] },
  pressed: { opacity: tokens.opacityPressed },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
  foot: { marginTop: 'auto', paddingTop: tokens.spaceXs },
  steps: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceSm },
  glassStep: { justifyContent: 'center', paddingHorizontal: 18 },
  count: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  big: { lineHeight: 42, letterSpacing: 40 * -0.02, fontVariant: ['tabular-nums'] },
  amber: {
    gap: tokens.spaceSm,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: tokens.colorAttentionBorder,
    backgroundColor: tokens.colorAttentionTint,
  },
  amberHead: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  amberMark: { paddingTop: 2 },
  amberTitle: { lineHeight: 15.5 * 1.35 },
  lines: { lineHeight: 14 * 1.45 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: tokens.colorInk,
    ...tokens.elevationNative.popover.ios,
    elevation: tokens.elevationNative.popover.android.elevation,
  },
  toastAction: { minHeight: tokens.sizeHit, justifyContent: 'center', paddingHorizontal: 12 },
  toastAct: { color: tokens.colorInkOnDark, textDecorationLine: 'underline' },
  toastClose: {
    width: tokens.sizeHit,
    height: tokens.sizeHit,
    alignItems: 'center',
    justifyContent: 'center',
  },
  head: { minHeight: tokens.sizeHit, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headWords: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
  },
  headTitle: { letterSpacing: -0.18, lineHeight: 18 * 1.25 },
  shown: { minHeight: tokens.sizeHit, flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: tokens.spaceMd },
  titleStack: { gap: tokens.spaceSm },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceMd },
  shrink: { flexShrink: 1 },
});
