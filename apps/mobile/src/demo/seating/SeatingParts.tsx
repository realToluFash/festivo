import { type ReactNode, type Ref, useRef } from 'react';
import { Pressable, StyleSheet, View, type ViewInstance } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { Field, TextField } from '../../components/Field.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { Initials } from '../../components/Initials.tsx';
import { RadioMark } from '../../components/RadioMark.tsx';
import { ReadOut } from '../../components/ReadOut.tsx';
import { Sheet } from '../../components/Sheet.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { ShapeMark } from '../../components/StatusMark.tsx';
import { TextAction, TurningMark } from '../../components/SummaryRows.tsx';
import type { Bar, SaveLine } from './SeatingModel.ts';
import type { ChairState, Kind, Person } from './SeatingSample.ts';
import { W } from './SeatingWords.ts';

export const TAKEN_FILL = '#34343F';
export const EMPTY_EDGE = '#8B8B9A';
export const OFF_FILL = '#D3D3DB';
export const OFF_EDGE = '#6E6E7E';
export const SUNK = tokens.colorNeutralFill;
const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

const ICONS: Record<string, readonly string[]> = {
  minus: ['M5 12h14'],
  plus: ['M12 5v14', 'M5 12h14'],
  fit: [
    'M4 9V5a1 1 0 0 1 1-1h4',
    'M15 4h4a1 1 0 0 1 1 1v4',
    'M20 15v4a1 1 0 0 1-1 1h-4',
    'M9 20H5a1 1 0 0 1-1-1v-4',
  ],
  print: ['M6 9V3h12v6', 'M5 9h14a2 2 0 0 1 2 2v6H3v-6a2 2 0 0 1 2-2z', 'M6 14h12v7H6z'],
  map: ['M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z', 'M9 4v14', 'M15 6v14'],
  list: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3.5 6h.01', 'M3.5 12h.01', 'M3.5 18h.01'],
  cards: ['M3 3h8v8H3z', 'M13 3h8v8h-8z', 'M3 13h8v8H3z', 'M13 13h8v8h-8z'],
  cloudoff: [
    'M3 3l18 18',
    'M8.5 6.3A6 6 0 0 1 17.6 10H18a4 4 0 0 1 2.4 7.2',
    'M16 18H7a5 5 0 0 1-1.6-9.7',
  ],
  chevdown: ['m6 9 6 6 6-6'],
};

const SHAPES: Record<Kind, ReactNode> = {
  round: (
    <>
      <Circle cx={12} cy={12} r={5} />
      <Circle cx={12} cy={3.5} r={1.5} />
      <Circle cx={12} cy={20.5} r={1.5} />
      <Circle cx={3.5} cy={12} r={1.5} />
      <Circle cx={20.5} cy={12} r={1.5} />
    </>
  ),
  rect: (
    <>
      <Rect x={4} y={9} width={16} height={6} rx={1.5} />
      <Circle cx={8} cy={5} r={1.5} />
      <Circle cx={16} cy={5} r={1.5} />
      <Circle cx={8} cy={19} r={1.5} />
      <Circle cx={16} cy={19} r={1.5} />
    </>
  ),
  head: (
    <>
      <Rect x={3} y={7} width={18} height={5} rx={1.5} />
      <Circle cx={7} cy={17} r={1.5} />
      <Circle cx={12} cy={17} r={1.5} />
      <Circle cx={17} cy={17} r={1.5} />
    </>
  ),
  cocktail: (
    <>
      <Circle cx={12} cy={12} r={3.5} />
      <Rect x={10} y={2.5} width={4} height={4} rx={1} />
      <Rect x={10} y={17.5} width={4} height={4} rx={1} />
      <Rect x={2.5} y={10} width={4} height={4} rx={1} />
      <Rect x={17.5} y={10} width={4} height={4} rx={1} />
    </>
  ),
  row: (
    <>
      <Circle cx={4.5} cy={12} r={2} />
      <Circle cx={9.5} cy={12} r={2} />
      <Circle cx={14.5} cy={12} r={2} />
      <Circle cx={19.5} cy={12} r={2} />
    </>
  ),
  single: <Circle cx={12} cy={12} r={4} />,
};

/** Seating's line icons beside their words, hidden from screen readers as the house Glyph is. */
export function SeatIcon({
  name,
  shape,
  size = 18,
  ink,
  weight = 2.1,
}: {
  name?: keyof typeof ICONS;
  shape?: Kind;
  size?: number;
  ink: string;
  weight?: number;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={ink}
      strokeWidth={weight}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...hidden}
    >
      {shape != null
        ? SHAPES[shape]
        : (ICONS[name ?? 'plus'] ?? []).map((d) => <Path key={d} d={d} />)}
    </Svg>
  );
}

/** A seat's state as a shape (sc-4013): Taken filled, Held half, Empty an outline, Unusable crossed; always beside its word. */
export function StateMark({ state, side = 22 }: { state: ChairState; side?: number }) {
  const r = side / 2 - 1.5;
  const c = side / 2;
  const k = r * 0.45;
  return (
    <Svg width={side} height={side} {...hidden}>
      {state === 'taken' && <Circle cx={c} cy={c} r={r} fill={TAKEN_FILL} />}
      {state === 'held' && (
        <>
          <Circle cx={c} cy={c} r={r} fill={tokens.colorCard} stroke={TAKEN_FILL} strokeWidth={2} />
          <Path d={`M${c} ${c - r}A${r} ${r} 0 0 0 ${c} ${c + r}Z`} fill={TAKEN_FILL} />
        </>
      )}
      {state === 'empty' && (
        <Circle cx={c} cy={c} r={r} fill={tokens.colorCard} stroke={EMPTY_EDGE} strokeWidth={2} />
      )}
      {state === 'unusable' && (
        <>
          <Circle cx={c} cy={c} r={r} fill={OFF_FILL} stroke={OFF_EDGE} strokeWidth={2} />
          <Path
            d={`M${c - k} ${c - k}L${c + k} ${c + k}M${c + k} ${c - k}L${c - k} ${c + k}`}
            stroke={tokens.colorInkSecondary}
            strokeWidth={2.2}
            strokeLinecap="round"
          />
        </>
      )}
    </Svg>
  );
}

export function Swatch({ hex, side = 20 }: { hex: string | null; side?: number }) {
  return (
    <View
      {...hidden}
      style={[
        { width: side, height: side, borderRadius: side / 2 },
        hex == null ? styles.noSwatch : { backgroundColor: hex },
      ]}
    />
  );
}

export function ShapeTile({
  kind,
  hex,
  side = 40,
}: {
  kind: Kind;
  hex: string | null;
  side?: number;
}) {
  return (
    <View {...hidden} style={[styles.tile, { width: side, height: side }]}>
      <SeatIcon
        shape={kind}
        size={Math.round(side * 0.6)}
        ink={hex ?? tokens.colorInkSecondary}
        weight={2}
      />
    </View>
  );
}

export function Segments<K extends string>({
  items,
  on,
  onPick,
  height = 44,
  glyphs,
  testID,
}: {
  items: readonly { key: K; label: string }[];
  on: K;
  onPick: (key: K) => void;
  height?: number;
  glyphs?: Partial<Record<K, keyof typeof ICONS>>;
  testID: string;
}) {
  return (
    <View style={[styles.segments, { minHeight: height, borderRadius: height / 2 }]}>
      {items.map(({ key, label }) => {
        const lit = key === on;
        const glyph = glyphs?.[key];
        return (
          <Pressable
            key={key}
            onPress={() => onPick(key)}
            style={[
              styles.segment,
              { minHeight: height - 8, borderRadius: (height - 8) / 2 },
              lit && styles.segmentOn,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: lit }}
            accessibilityLabel={label}
            testID={`${testID}.${key}`}
          >
            {glyph != null && (
              <SeatIcon
                name={glyph}
                size={16}
                ink={lit ? tokens.colorInk : tokens.colorInkSecondary}
              />
            )}
            <Text
              size={14}
              weight="semibold"
              accessible={false}
              style={lit ? styles.ink : styles.secondary}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const BAR_LOOK = {
  amber: { fill: tokens.colorAttentionTint, ink: tokens.colorAttention },
  tint: { fill: tokens.colorAccentTint, ink: tokens.colorAccent },
  white: { fill: tokens.colorCard, ink: tokens.colorInkSecondary },
} as const;

/** A message over the room: Tint for what to do next, amber for what didn’t land, white with Undo; read out as it appears. */
export function MessageBar({
  bar,
  onUndo,
  onCancel,
  onCentre,
  onStop,
  testID,
}: {
  bar: Bar;
  onUndo: () => void;
  onCancel: () => void;
  onCentre: () => void;
  onStop: () => void;
  testID: string;
}) {
  const look = BAR_LOOK[bar.kind];
  return (
    <View
      style={[styles.bar, { backgroundColor: look.fill }, bar.kind === 'white' && styles.raised]}
      testID={testID}
    >
      <View style={styles.barMark}>
        {bar.glyph === 'offline' ? (
          <SeatIcon name="cloudoff" size={17} ink={look.ink} />
        ) : bar.glyph === 'tick' || bar.undo === true ? (
          <ShapeMark kind="yes" side={16} ink={look.ink} />
        ) : (
          <Glyph
            name={bar.kind === 'amber' ? 'alert' : 'info'}
            size={17}
            ink={look.ink}
            weight={2.2}
          />
        )}
      </View>
      <ReadOut words={bar.words} style={styles.barWords}>
        <Text size={14.5} weight="semibold" style={styles.barText}>
          {bar.words}
        </Text>
      </ReadOut>
      <View style={styles.barActions}>
        {bar.undo === true && (
          <TextAction label={W.undo} onPress={onUndo} testID={`${testID}.undo`} />
        )}
        {bar.placing === true && (
          <>
            <TextAction label={W.placeCentre} onPress={onCentre} testID={`${testID}.centre`} />
            <TextAction label={W.stopPlacing} onPress={onStop} testID={`${testID}.stop`} />
          </>
        )}
        {bar.cancel === true && (
          <TextAction label={W.cancel} onPress={onCancel} testID={`${testID}.cancel`} />
        )}
      </View>
    </View>
  );
}

const SAVE_WORD: Record<SaveLine, string> = {
  saved: W.saved,
  saving: W.saving,
  retry: W.retrying,
  failed: W.notSaved,
};

/** sc-5028's save line: a shape and a word in each state, said politely. */
export function SaveLineView({ save, onTryAgain }: { save: SaveLine; onTryAgain: () => void }) {
  const ink =
    save === 'retry'
      ? tokens.colorAttention
      : save === 'failed'
        ? tokens.colorBroken
        : tokens.colorInkSecondary;
  return (
    <View style={styles.saveLine}>
      <View {...hidden}>
        {save === 'saved' && <ShapeMark kind="yes" side={15} ink={tokens.colorAccent} />}
        {save === 'saving' && <TurningMark side={15} />}
        {save === 'retry' && <Glyph name="alert" size={16} ink={ink} weight={2.2} />}
        {save === 'failed' && (
          <View style={styles.failedMark}>
            <Glyph name="x" size={10} ink={tokens.colorInkOnDark} weight={3.4} />
          </View>
        )}
      </View>
      <ReadOut words={SAVE_WORD[save]}>
        <Text size={13.5} weight="semibold" style={{ color: ink }}>
          {SAVE_WORD[save]}
        </Text>
      </ReadOut>
      {save === 'failed' && (
        <TextAction label={W.tryAgain} onPress={onTryAgain} testID="seating.save.tryAgain" />
      )}
    </View>
  );
}

export function Face({ person, side = 32 }: { person: Person; side?: number }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.face,
        { width: side, height: side, borderRadius: side / 2, backgroundColor: person.colour },
      ]}
    >
      <Initials name={person.name} size={12} weight="bold" style={styles.onDark} />
    </View>
  );
}

/** Who else is here (sc-4719): a 44 button per person, in the order they arrived, then the line; four and +n from six. */
export function Presence({
  people,
  reconnecting,
  onMore,
  line,
}: {
  people: readonly Person[];
  reconnecting: boolean;
  onMore: () => void;
  line: (first: string, others: number) => string;
}) {
  if (reconnecting)
    return (
      <View style={styles.presence}>
        <Glyph name="refresh" size={15} ink={tokens.colorInkSecondary} weight={2.2} />
        <Text size={13.5} weight="medium" style={styles.secondary}>
          {W.reconnecting}
        </Text>
      </View>
    );
  const first = people[0];
  if (first == null) return null;
  const shown = people.length > 5 ? people.slice(0, 4) : people;
  return (
    <View style={styles.presence}>
      <View style={styles.faces}>
        {shown.map((person) => (
          <Pressable
            key={person.name}
            onPress={onMore}
            style={styles.chip}
            accessibilityRole="button"
            accessibilityLabel={person.viewer ? `${person.name}, ${W.canView}` : person.name}
            testID={`seating.person.${person.name}`}
          >
            <Face person={person} />
          </Pressable>
        ))}
        {people.length > 5 && (
          <Pressable
            onPress={onMore}
            style={styles.moreChip}
            accessibilityRole="button"
            accessibilityLabel={`${people.length - 4} more on this plan`}
            testID="seating.people.more"
          >
            <Text size={13} weight="bold" accessible={false}>
              {`+${people.length - 4}`}
            </Text>
          </Pressable>
        )}
      </View>
      <Text size={13.5} weight="medium" numberOfLines={1} style={styles.secondary}>
        {line(first.name, people.length - 1)}
      </Text>
    </View>
  );
}

/** A labelled field at 48, its unit after the value; a value applies on Enter or on leaving it (pm, 7 Nov 2026). */
export function FieldBox({
  label,
  value,
  unit,
  error,
  optional,
  numbers = false,
  focus = false,
  off = false,
  onText,
  onDone,
  maxLength,
  testID,
}: {
  label: string;
  value: string;
  unit?: string | undefined;
  error?: string | null | undefined;
  optional?: boolean;
  numbers?: boolean;
  focus?: boolean;
  off?: boolean;
  onText: (text: string) => void;
  onDone: () => void;
  maxLength?: number | undefined;
  testID: string;
}) {
  return (
    <Field label={label} pill={optional === true ? W.optional : undefined} error={error}>
      <View>
        <TextField
          value={value}
          wrong={error != null}
          autoFocus={focus}
          editable={!off}
          keyboardType={numbers ? 'numbers-and-punctuation' : 'default'}
          returnKeyType="done"
          submitBehavior="blurAndSubmit"
          maxLength={maxLength}
          onChangeText={onText}
          onBlur={onDone}
          onSubmitEditing={onDone}
          accessibilityHint={unit}
          accessibilityLabel={label}
          style={unit == null ? undefined : styles.withUnit}
          testID={testID}
        />
        {unit != null && (
          <View {...hidden} style={styles.unit} pointerEvents="none">
            <Text size={15} weight="medium" accessible={false} style={styles.secondary}>
              {unit}
            </Text>
          </View>
        )}
      </View>
    </Field>
  );
}

/** A select at 48 (Section, Shape, Rotation): its value and a chevron; it opens a list of choices. */
export function SelectBox({
  label,
  value,
  off = false,
  onOpen,
  testID,
  ref,
}: {
  label: string;
  value: string;
  off?: boolean;
  onOpen: () => void;
  testID: string;
  ref?: Ref<ViewInstance>;
}) {
  return (
    <View style={styles.select}>
      <Text size={tokens.typeButton.size} weight="medium" accessible={false}>
        {label}
      </Text>
      <Pressable
        ref={ref}
        onPress={off ? undefined : onOpen}
        disabled={off}
        style={({ pressed }) => [styles.selectBox, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${value}`}
        accessibilityState={{ disabled: off }}
        testID={testID}
      >
        <Text size={15} weight="medium" numberOfLines={1} accessible={false} style={styles.grow}>
          {value}
        </Text>
        {!off && <SeatIcon name="chevdown" size={16} ink={tokens.colorInkSecondary} weight={2.3} />}
      </Pressable>
    </View>
  );
}

export function ChoiceSheet({
  open,
  title,
  choices,
  value,
  onPick,
  onClose,
}: {
  open: boolean;
  title: string;
  choices: readonly { label: string; hex?: string | null }[];
  value: string;
  onPick: (label: string) => void;
  onClose: () => void;
}) {
  const opener = useRef<ViewInstance>(null);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      scrimLabel={W.close}
      opener={opener}
      testID="seating.choices"
    >
      <View style={styles.choices}>
        <SheetTitle title={title} onClose={onClose} />
        {choices.map((choice) => (
          <Pressable
            key={choice.label}
            onPress={() => onPick(choice.label)}
            style={({ pressed }) => [styles.choice, pressed && styles.pressed]}
            accessibilityRole="radio"
            accessibilityState={{ checked: choice.label === value }}
            accessibilityLabel={choice.label}
            testID={`seating.choice.${choice.label}`}
          >
            <RadioMark on={choice.label === value} />
            {choice.hex !== undefined && <Swatch hex={choice.hex} side={16} />}
            <Text
              size={16}
              weight={choice.label === value ? 'semibold' : 'medium'}
              accessible={false}
            >
              {choice.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}

export function SheetTitle({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <View style={styles.sheetHead}>
      <Text
        size={22}
        weight="bold"
        accessibilityRole="header"
        style={[styles.grow, styles.sheetTitle]}
      >
        {title}
      </Text>
      <Pressable
        onPress={onClose}
        style={({ pressed }) => [styles.close, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={W.close}
        testID="seating.sheet.close"
      >
        <Glyph name="x" size={18} ink={tokens.colorInk} weight={2.4} />
      </Pressable>
    </View>
  );
}

/** A line under the fields: amber for a warning that saved anyway, red for a refusal, Ink 2 for a note; read out. */
export function Notice({
  words,
  tone,
}: {
  words: string;
  tone: 'amber' | 'red' | 'note' | 'green';
}) {
  const ink = {
    amber: tokens.colorAttention,
    red: tokens.colorBroken,
    note: tokens.colorInkSecondary,
    green: tokens.colorAccent,
  }[tone];
  return (
    <ReadOut words={words} style={[styles.notice, tone === 'green' && styles.noticeGreen]}>
      <View {...hidden} style={styles.noticeMark}>
        {tone === 'green' ? (
          <ShapeMark kind="yes" side={16} ink={ink} />
        ) : (
          <Glyph name={tone === 'note' ? 'info' : 'alert'} size={15} ink={ink} weight={2.2} />
        )}
      </View>
      <Text
        size={tone === 'green' ? 14 : 13.5}
        weight={tone === 'green' ? 'semibold' : 'medium'}
        style={[styles.grow, styles.noticeText, tone === 'red' && { color: ink }]}
      >
        {words}
      </Text>
    </ReadOut>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  ink: { color: tokens.colorInk },
  secondary: { color: tokens.colorInkSecondary },
  onDark: { color: tokens.colorInkOnDark },
  pressed: { opacity: tokens.opacityPressed },
  noSwatch: { borderWidth: 2, borderStyle: 'dashed', borderColor: tokens.colorFieldBorder },
  tile: {
    borderRadius: tokens.spaceLg,
    backgroundColor: tokens.colorInset,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segments: {
    flexDirection: 'row',
    padding: tokens.spaceXxs,
    gap: tokens.spaceHair,
    backgroundColor: tokens.colorInset,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spaceXs,
    paddingHorizontal: tokens.spaceMd,
  },
  segmentOn: {
    backgroundColor: tokens.colorCard,
    ...tokens.elevationNative.card.ios,
    elevation: 1,
  },
  bar: {
    minHeight: 48,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingLeft: 14,
    paddingRight: tokens.spaceXl,
    borderRadius: tokens.spaceXl,
  },
  raised: {
    ...tokens.elevationNative.raised.ios,
    elevation: tokens.elevationNative.raised.android.elevation,
  },
  barMark: { width: 18, alignItems: 'center' },
  barWords: { flex: 1, minWidth: 160, paddingVertical: tokens.spaceLg },
  barText: { lineHeight: 14.5 * 1.4 },
  barActions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 18 },
  saveLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  failedMark: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: tokens.colorBroken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  face: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: tokens.colorCard,
  },
  presence: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm, flexShrink: 1 },
  faces: { flexDirection: 'row' },
  chip: {
    width: tokens.sizeHit,
    height: tokens.sizeHit,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreChip: {
    minWidth: tokens.sizeHit,
    minHeight: tokens.sizeHit,
    paddingHorizontal: tokens.spaceMd,
    borderRadius: 22,
    backgroundColor: tokens.colorInset,
    alignItems: 'center',
    justifyContent: 'center',
  },
  withUnit: { paddingRight: 44 },
  unit: {
    position: 'absolute',
    right: tokens.spaceLg,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  select: { gap: tokens.spaceXs },
  selectBox: {
    minHeight: tokens.sizeHitPhonePrimary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingHorizontal: tokens.spaceLg,
    borderWidth: 1,
    borderColor: tokens.colorFieldBorder,
    borderRadius: tokens.radiusField,
    backgroundColor: tokens.colorCard,
  },
  choices: {
    gap: tokens.spaceXxs,
    paddingHorizontal: tokens.spaceXxl,
    paddingTop: tokens.spaceXl,
    paddingBottom: tokens.space3xl,
  },
  choice: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
  },
  sheetHead: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
  },
  sheetTitle: { letterSpacing: 22 * -0.015, lineHeight: 22 * 1.2 },
  close: {
    width: tokens.sizeHit,
    height: tokens.sizeHit,
    borderRadius: tokens.sizeHit / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorInset,
  },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  noticeGreen: {
    padding: tokens.spaceMd,
    borderRadius: 14,
    backgroundColor: tokens.colorAccentTint,
  },
  noticeMark: { paddingTop: 2 },
  noticeText: { lineHeight: 13.5 * 1.4, color: tokens.colorInk },
});
