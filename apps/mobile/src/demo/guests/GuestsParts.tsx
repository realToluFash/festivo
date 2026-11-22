import {
  type ReactNode,
  type Ref,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  type TextLayoutEvent,
  View,
  useWindowDimensions,
} from 'react-native';

import { eventColour } from '../../components/EventMesh.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import {
  BodyTitle,
  MeasuredWords,
  PageTitleDrawn,
  usePageTitleDrawn,
} from '../../components/Title.tsx';
import { TopPrimary, usePrimaryLabel } from '../../components/TopPrimary.tsx';
import { useReadOut } from '../../components/ReadOut.tsx';
import { type TextHandle, Text, TitleCap } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { CardBackdrop, PhaseShape } from '../../components/EventCard.tsx';
import type { Shown } from '../events/EventsModel.ts';
import { useShell } from '../../components/settingsShell.ts';
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
import {
  actionsUnder,
  brokeOn,
  statusFits,
  titleRoomBeside,
  titleRowKey,
} from '../../layout/titleFit.ts';
import { titleSize } from '../../layout/textSize.ts';

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

/** The title row as the product draws it: the title keeps its words whole under its cap, and the + keeps its label only where the title and the labelled + both fit beside what is there (sc-67338, sc-51444, sc-67659). Where the title at its default size has no room beside Export and the round +, or broke beside them all the same, those two go together to a row under it (sc-68417). */
export function GuestsTitle({
  layout,
  title = W.guests,
  plus,
  onPlus,
  plusLabel = W.addGuest,
  extra = null,
  extraWidest = null,
  refreshing = null,
}: {
  layout: Layout;
  title?: string;
  plus: boolean;
  onPlus: () => void;
  plusLabel?: string;
  extra?: ReactNode;
  /** Export again, drawn hidden and never pressed, measured at its widest (sc-71821). */
  extraWidest?: ReactNode;
  /** Refreshing… while it shows; `row` where main draws it on this row, a tablet's (sc-71821). */
  refreshing?: { node: ReactNode; row: boolean } | null;
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
  const [widest, setWidest] = useState(0);
  const [titleWidth, setTitleWidth] = useState(0);
  const [plusWidth, setPlusWidth] = useState(0);
  const [statusWidth, setStatusWidth] = useState(0);
  const [titleDrawn, setTitleDrawn] = useState(0);
  // The title steps down from its slot's width rather than from a wrap it must first see.
  const [slot, setSlot] = useState(0);
  const { fontScale } = useWindowDimensions();
  const pageDrawn = usePageTitleDrawn();
  const capOver = useContext(TitleCap);
  const drawn = useRef(0);
  const [broke, setBroke] = useState<string | null>(null);
  const row = titleRowKey({ room, title, fontScale });
  const under =
    broke === row ||
    actionsUnder({
      room,
      title: titleWidth,
      extra: extra == null ? 0 : widest || extraWidth,
      plus: plus ? tokens.sizeHit : 0,
      bell: bell ? tokens.sizeHit : 0,
      gap: tokens.spaceMd,
    });
  // Refreshing… counts toward nothing above: it stays on the row only in what the title as drawn, Export, the + and the bell leave it (sc-71821).
  const onRow =
    refreshing != null &&
    refreshing.row &&
    !under &&
    statusFits({
      room,
      lead: titleDrawn,
      ends: [
        ...(extra == null ? [] : [extraWidth]),
        ...(plus ? [plusWidth] : []),
        ...(bell ? [tokens.sizeHit] : []),
      ],
      status: statusWidth,
      gap: tokens.spaceMd,
    });
  const line = refreshing != null && !onRow;
  // As the product: the title steps down beside Export as if Export were at its widest, so the two never resize each other into a broken word (sc-71821).
  const titleRoom = titleRoomBeside({
    slot,
    extra: extra == null || under ? 0 : extraWidth,
    widest,
  });
  const keepsDefault = layout === 'landscape' && under;
  const onDrawn = useCallback(
    (next: number) => {
      drawn.current = next;
      pageDrawn?.(keepsDefault ? Math.min(next, size) : next);
    },
    [pageDrawn, keepsDefault, size],
  );
  // Where the device lays the title out wider than it measured hidden, it can break at its floor though the sum says it fits; then the actions go under (sc-68417).
  const onTitleLines = (event: TextLayoutEvent) => {
    const start = titleSize(size, fontScale);
    const lines = event.nativeEvent.lines;
    setTitleDrawn(Math.ceil(Math.max(0, ...lines.map((one) => one.width))));
    setBroke((was) =>
      brokeOn({
        broke: was,
        row,
        under,
        lines: event.nativeEvent.lines,
        drawn: drawn.current || start,
        start,
        size,
        slot: titleRoom,
        title: titleWidth,
      }),
    );
  };
  const widthOf = (set: (width: number) => void) => (event: LayoutChangeEvent) =>
    set(Math.ceil(event.nativeEvent.layout.width));
  const heading = (
    <View
      style={styles.grow}
      onLayout={(event) => {
        label.onSlot(event);
        setSlot(Math.floor(event.nativeEvent.layout.width));
      }}
    >
      {label.measure}
      <PageTitleDrawn.Provider value={onDrawn}>
        {/* As the product on a tablet on its side: with Export and the + under it, the title keeps its default size, and so caps the card and the sidebar there (sc-67659). */}
        <TitleCap.Provider value={keepsDefault ? size : capOver}>
          <BodyTitle
            size={size}
            accessibilityRole="header"
            style={titleStyle}
            room={titleRoom}
            onTextLayout={onTitleLines}
            testID="guests.title"
          >
            {title}
          </BodyTitle>
        </TitleCap.Provider>
      </PageTitleDrawn.Provider>
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
        <View onLayout={widthOf(setPlusWidth)}>
          <TopPrimary
            label={plusLabel}
            onPress={onPlus}
            wide={label.wide && !under}
            testID="guests.add"
          />
        </View>
      )}
    </>
  );
  const status = refreshing != null && (
    <View
      style={styles.measure}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View onLayout={widthOf(setStatusWidth)}>{refreshing.node}</View>
    </View>
  );
  const measureWidest = extra != null && extraWidest != null && (
    <View
      style={styles.measure}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <TitleCap.Provider value={titleSize(size, fontScale)}>
        <View onLayout={widthOf(setWidest)}>{extraWidest}</View>
      </TitleCap.Provider>
    </View>
  );
  const ownLine = refreshing != null && line && (
    <View style={styles.statusLine} testID="guests.refreshingLine">
      {refreshing.node}
    </View>
  );

  return (
    <View
      style={under || line ? styles.titleStack : styles.titleRow}
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
      {status}
      {measureWidest}
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
      ) : line ? (
        <View style={styles.titleRow}>
          {heading}
          {actions}
          <PaneBell />
        </View>
      ) : (
        <>
          {heading}
          {onRow && refreshing?.node}
          {actions}
          <PaneBell />
        </>
      )}
      {ownLine}
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
  measure: { position: 'absolute', opacity: 0 },
  statusLine: { flexDirection: 'row' },
});
