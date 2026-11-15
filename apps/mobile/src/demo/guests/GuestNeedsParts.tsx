import { type ReactNode, type RefObject, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  type TextInputInstance,
  View,
  type ViewInstance,
} from 'react-native';

import { FieldError } from '../../components/Field.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { BoxField } from '../../components/MomentPick.tsx';
import { moveScreenReaderFocus } from '../../components/screenReaderFocus.ts';
import { useShell } from '../../components/settingsShell.ts';
import { Row } from '../../components/Summary.tsx';
import { LineIcon } from '../../components/AccountCard.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { EventField } from '../events/EventEdits.tsx';
import {
  ACCESS,
  ALLERGENS,
  type Access,
  type Allergen,
  DIETS,
  type Diet,
  GW,
  type GroupProblem,
  type GuestGroup,
  NW,
  type Needs,
  type NeedsField,
  accessNames,
  allergyNames,
  dietNames,
  groupOptions,
  lengthOf,
  needsChips,
  needsHeadLine,
  type GroupPick,
  pickName,
  problemLine,
  returnPick,
  sameGroup,
  toggled,
} from './GuestNeeds.ts';
import { type GroupNeedsStart, shownProblem } from './GuestNeedsStart.ts';
import { W } from './GuestsWords.ts';

const hidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no' } as const;

/** sc-3777's allergy mark: the warning shape and the word Allergy, never colour alone. */
export function AllergyMark({ testID }: { testID?: string }) {
  return (
    <View style={styles.mark} testID={testID}>
      <View {...hidden}>
        <Glyph name="alert" size={15} ink={tokens.colorBroken} weight={2.4} />
      </View>
      <Text size={13.5} weight="bold" accessible={false} style={styles.broken}>
        {NW.allergy}
      </Text>
    </View>
  );
}

export function GroupField({
  value,
  isNew,
  error,
  onOpen,
  fieldRef,
  testID,
}: {
  value: string | null;
  isNew: boolean;
  error: string | null;
  onOpen: () => void;
  fieldRef?: RefObject<ViewInstance | null>;
  testID: string;
}) {
  const shown = value ?? GW.noGroup;

  return (
    <EventField label={GW.group} optional error={error}>
      <Pressable
        ref={fieldRef}
        onPress={onOpen}
        style={({ pressed }) => [
          styles.box,
          error != null && styles.wrong,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={GW.group}
        accessibilityValue={{ text: shown }}
        aria-invalid={error != null}
        testID={testID}
      >
        <Text
          size={16}
          weight="medium"
          accessible={false}
          style={[styles.grow, value == null && styles.secondary]}
        >
          {shown}
        </Text>
        <Glyph name="down" size={15} ink={tokens.colorInkSecondary} weight={2.4} />
      </Pressable>
      {isNew && value != null && error == null && (
        <Text size={13.5} weight="medium" style={[styles.secondary, styles.hint]}>
          {GW.madeOnSave(value)}
        </Text>
      )}
    </EventField>
  );
}

/** The picker's frame, as sc-3785's overlays: a bottom sheet on phone, a centred dialog on tablet portrait, docked at the right edge in landscape. */
export function GroupLayer({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const layout = useShell().layout;

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        layout === 'portrait' && styles.centred,
        layout === 'landscape' && styles.docked,
      ]}
    >
      <Pressable
        style={[StyleSheet.absoluteFill, styles.scrim]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={W.cancel}
      />
      <View
        style={
          layout === 'phone'
            ? styles.layerPhone
            : layout === 'portrait'
              ? styles.layerDialog
              : styles.layerPanel
        }
        accessibilityViewIsModal
        onAccessibilityEscape={onClose}
        testID={`guests.groupPicker.${layout}`}
      >
        <ScrollView bounces={false} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

export function GroupPicker({
  guestName,
  groups,
  chosen,
  typed,
  problem,
  onTyped,
  onReturn,
  onPick,
  onCreate,
  onClose,
}: {
  /** None while Add guest's name is blank: the line waits for it. */
  guestName: string | null;
  groups: readonly GuestGroup[];
  /** The chosen group's id, the name to create, or null for No group. */
  chosen: string | null;
  typed: string;
  problem: GroupProblem | null;
  onTyped: (typed: string) => void;
  onReturn: () => void;
  onPick: (id: string | null) => void;
  onCreate: (name: string) => void;
  onClose: () => void;
}) {
  const options = groupOptions(groups, typed);
  const line = problem == null ? null : problemLine(problem);

  return (
    <View style={styles.sheet}>
      <View style={styles.sheetHead}>
        <Text size={20} weight="bold" accessibilityRole="header" style={styles.grow}>
          {GW.group}
        </Text>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={W.cancel}
          testID="guests.groupPicker.close"
        >
          <Text size={16} weight="semibold" accessible={false} style={styles.accent}>
            {W.cancel}
          </Text>
        </Pressable>
      </View>
      {guestName != null && (
        <Text size={14.5} weight="medium" style={[styles.secondary, styles.lines]}>
          {GW.forWhom(guestName)}
        </Text>
      )}
      <View style={styles.tight}>
        <BoxField
          value={typed}
          wrong={line != null}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          submitBehavior="submit"
          onChangeText={onTyped}
          onSubmitEditing={onReturn}
          placeholder={GW.chooseOrType}
          accessibilityLabel={GW.chooseOrType}
          aria-invalid={line != null}
          testID="guests.groupPicker.field"
        />
        {line != null && <FieldError message={line} />}
      </View>
      <View>
        {typed.trim() === '' && (
          <PickRow
            word={GW.noGroup}
            on={chosen == null}
            onPress={() => onPick(null)}
            testID="guests.groupPicker.none"
          />
        )}
        {options.groups.map((one) => (
          <PickRow
            key={one.id}
            word={one.name}
            count={GW.people(one.people)}
            on={chosen === one.id}
            onPress={() => onPick(one.id)}
            testID={`guests.groupPicker.${one.id}`}
          />
        ))}
        {options.create != null && (
          <PickRow
            word={GW.createNamed(options.create)}
            count={GW.newGroup}
            on={false}
            create
            onPress={() => onCreate(options.create ?? '')}
            testID="guests.groupPicker.create"
          />
        )}
      </View>
    </View>
  );
}

function PickRow({
  word,
  count,
  on,
  create = false,
  onPress,
  testID,
}: {
  word: string;
  count?: string;
  on: boolean;
  create?: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.option, on && styles.lit, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      aria-current={on}
      accessibilityLabel={count == null ? word : `${word}, ${count}`}
      testID={testID}
    >
      {create && <Glyph name="plus" size={17} ink={tokens.colorAccentText} weight={2.4} />}
      <Text
        size={16}
        weight="semibold"
        accessible={false}
        style={[styles.grow, create && styles.accent]}
      >
        {word}
      </Text>
      {count != null && (
        <Text
          size={14}
          weight="medium"
          accessible={false}
          style={[styles.secondary, styles.figures]}
        >
          {count}
        </Text>
      )}
      {on && <Glyph name="tick" size={18} ink={tokens.colorAccentText} weight={2.6} />}
    </Pressable>
  );
}

export function NeedsChips({ needs, testID }: { needs: Needs; testID: string }) {
  return (
    <View style={styles.chips} testID={testID}>
      {needsChips(needs).map((chip) => (
        <View
          key={`${chip.kind}.${chip.word}`}
          style={[styles.chip, chip.kind === 'allergy' && styles.chipAllergy]}
          accessible
          accessibilityLabel={chip.word}
        >
          {chip.kind === 'allergy' && (
            <View {...hidden}>
              <Glyph name="alert" size={14} ink={tokens.colorBroken} weight={2.4} />
            </View>
          )}
          <Text
            size={14}
            weight="semibold"
            accessible={false}
            style={chip.kind === 'allergy' ? styles.broken : undefined}
          >
            {chip.word}
          </Text>
        </View>
      ))}
    </View>
  );
}

export type NeedsRefs = Record<NeedsField, RefObject<TextInputInstance | null>>;

export function NeedsSection({
  title,
  needs,
  onChange,
  open,
  onToggle,
  lines,
  refs,
  testID,
}: {
  title: string;
  needs: Needs;
  onChange: (next: Needs) => void;
  open: boolean;
  onToggle: () => void;
  lines: Partial<Record<NeedsField, string>>;
  refs?: NeedsRefs;
  testID: string;
}) {
  const wide = useShell().layout === 'landscape';
  const head = needsHeadLine(needs);
  const recorded = needsChips(needs).length > 0;

  return (
    <View style={styles.needs} testID={testID}>
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [styles.disclosure, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        aria-expanded={open}
        accessibilityLabel={`${title}, ${head}`}
        testID={`${testID}.toggle`}
      >
        <Text size={15} weight="bold" accessible={false} style={styles.grow}>
          {title}
        </Text>
        <Text
          size={14.5}
          weight="medium"
          accessible={false}
          style={[styles.secondary, styles.figures]}
        >
          {head}
        </Text>
        <Glyph name={open ? 'up' : 'down'} size={15} ink={tokens.colorInkSecondary} weight={2.4} />
      </Pressable>
      {!open &&
        (recorded ? (
          <NeedsChips needs={needs} testID={`${testID}.chips`} />
        ) : (
          <Text size={14} weight="medium" style={[styles.secondary, styles.hint]}>
            {NW.noneRecordedLine}
          </Text>
        ))}
      {open && (
        <View style={styles.groups}>
          <NeedsGroup
            title={NW.allergies}
            hint={NW.allergiesHint}
            pill={NW.shownFirst}
            codes={ALLERGENS}
            nameOf={NW.allergen}
            ticked={needs.allergies}
            onTick={(code: Allergen) =>
              onChange({ ...needs, allergies: toggled(needs.allergies, code) })
            }
            other={{
              label: NW.whichAllergy,
              value: needs.otherAllergy,
              onChange: (otherAllergy) => onChange({ ...needs, otherAllergy }),
              error: lines.otherAllergy ?? null,
            }}
            otherRef={refs?.otherAllergy}
            wide={wide}
            testID={`${testID}.allergies`}
          />
          <NeedsGroup
            title={NW.diet}
            hint={NW.dietHint}
            codes={DIETS}
            nameOf={NW.dietName}
            ticked={needs.diet}
            onTick={(code: Diet) => onChange({ ...needs, diet: toggled(needs.diet, code) })}
            other={{
              label: NW.whichDiet,
              value: needs.otherDiet,
              onChange: (otherDiet) => onChange({ ...needs, otherDiet }),
              error: lines.otherDiet ?? null,
            }}
            otherRef={refs?.otherDiet}
            wide={wide}
            testID={`${testID}.diet`}
          />
          <NeedsGroup
            title={NW.access}
            hint={NW.accessHint}
            codes={ACCESS}
            nameOf={NW.accessName}
            ticked={needs.access}
            onTick={(code: Access) => onChange({ ...needs, access: toggled(needs.access, code) })}
            other={{
              label: NW.whatElse,
              value: needs.otherAccess,
              onChange: (otherAccess) => onChange({ ...needs, otherAccess }),
              error: lines.otherAccess ?? null,
            }}
            otherRef={refs?.otherAccess}
            wide={wide}
            testID={`${testID}.access`}
          />
          <View style={styles.tight}>
            <EventField
              label={NW.privateNote}
              optional
              error={lines.note ?? null}
              help={NW.noteHint}
            >
              <BoxField
                ref={refs?.note}
                value={needs.note}
                wrong={lines.note != null}
                multiline
                onChangeText={(note) => onChange({ ...needs, note })}
                accessibilityLabel={NW.privateNote}
                aria-invalid={lines.note != null}
                testID={`${testID}.note`}
              />
            </EventField>
            <Text size={13.5} weight="medium" style={[styles.secondary, styles.figures]}>
              {NW.noteCount(lengthOf(needs.note))}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

function NeedsGroup<T extends string>({
  title,
  hint,
  pill,
  codes,
  nameOf,
  ticked,
  onTick,
  other,
  otherRef,
  wide,
  testID,
}: {
  title: string;
  hint: string;
  pill?: string;
  codes: readonly T[];
  nameOf: (code: T) => string;
  ticked: readonly T[];
  onTick: (code: T) => void;
  other: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    error: string | null;
  };
  otherRef: RefObject<TextInputInstance | null> | undefined;
  wide: boolean;
  testID: string;
}) {
  const otherOn = ticked.includes('other' as T);

  return (
    <View style={styles.group}>
      <View style={styles.groupHead}>
        <Text size={15} weight="bold" accessibilityRole="header">
          {title}
        </Text>
        {pill != null && (
          <View style={styles.pill}>
            <Text size={12.5} weight="bold" style={styles.brokenText}>
              {pill}
            </Text>
          </View>
        )}
      </View>
      <Text size={13.5} weight="medium" style={[styles.secondary, styles.hint]}>
        {hint}
      </Text>
      <View style={wide && styles.twoColumns}>
        {codes.map((code) => (
          <View key={code} style={wide && styles.half}>
            <NeedsCheck
              label={nameOf(code)}
              group={title}
              on={ticked.includes(code)}
              onPress={() => onTick(code)}
              testID={`${testID}.${code}`}
            />
          </View>
        ))}
      </View>
      {otherOn && (
        <EventField label={other.label} error={other.error}>
          <BoxField
            ref={otherRef}
            value={other.value}
            wrong={other.error != null}
            onChangeText={other.onChange}
            accessibilityLabel={other.label}
            aria-invalid={other.error != null}
            testID={`${testID}.other`}
          />
        </EventField>
      )}
    </View>
  );
}

/** A 24 pt box in a 44 pt row; the label wraps, and the box is read with its group: "Peanuts, Allergies, checkbox". */
function NeedsCheck({
  label,
  group,
  on,
  onPress,
  testID,
}: {
  label: string;
  group: string;
  on: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.check, pressed && styles.pressed]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={`${label}, ${group}`}
      testID={testID}
    >
      <View style={[styles.checkBox, on && styles.checkBoxOn]}>
        {on && <Glyph name="tick" size={15} ink={tokens.colorInkOnDark} weight={3} />}
      </View>
      <Text size={16} weight="medium" accessible={false} style={styles.grow}>
        {label}
      </Text>
    </Pressable>
  );
}

export function NeedsRows({
  people,
}: {
  people: readonly { name: string; needs: Needs | undefined; guest: boolean }[];
}) {
  const recorded = people.filter((one) => one.needs != null && needsChips(one.needs).length > 0);

  if (recorded.length === 0)
    return (
      <Row
        title={NW.noDietary}
        lead={<LineIcon name="info" />}
        weight="medium"
        off
        testID="guest.needs.none"
      />
    );

  return (
    <View style={styles.people}>
      {recorded.map((one) => (
        <PersonNeeds key={one.name} name={one.name} needs={one.needs ?? null} guest={one.guest} />
      ))}
    </View>
  );
}

function PersonNeeds({
  name,
  needs,
  guest,
}: {
  name: string;
  needs: Needs | null;
  guest: boolean;
}) {
  if (needs == null) return null;
  const allergies = allergyNames(needs);
  const rest = [...dietNames(needs), ...accessNames(needs)];
  const said = [
    ...(guest ? [] : [name]),
    ...allergies.map(NW.allergyWith),
    ...rest,
    ...(needs.note.trim() === '' ? [] : [`${NW.privateNote}: ${needs.note.trim()}`]),
  ].join('. ');

  return (
    <View style={styles.person} accessible accessibilityLabel={said} testID={`guest.needs.${name}`}>
      {!guest && (
        <Text size={14} weight="bold" accessible={false} style={styles.secondary}>
          {name}
        </Text>
      )}
      {allergies.map((word) => (
        <View key={word} style={styles.allergyLine}>
          <AllergyMark />
          <Text size={16} weight="semibold" accessible={false} style={styles.grow}>
            {word}
          </Text>
        </View>
      ))}
      {rest.length > 0 && (
        <Text size={16} weight="medium" accessible={false} style={styles.lines}>
          {rest.join(' · ')}
        </Text>
      )}
      {needs.note.trim() !== '' && (
        <View style={styles.tight}>
          <Text size={13.5} weight="semibold" accessible={false} style={styles.secondary}>
            {NW.privateNote}
          </Text>
          <Text size={15} weight="medium" accessible={false} style={styles.lines}>
            {needs.note.trim()}
          </Text>
        </View>
      )}
    </View>
  );
}

function emptyRefs(): NeedsRefs {
  return {
    otherAllergy: { current: null },
    otherDiet: { current: null },
    otherAccess: { current: null },
    note: { current: null },
  };
}

export function useNeedsRefs(): NeedsRefs {
  const [refs] = useState<NeedsRefs>(emptyRefs);

  return refs;
}

/** Each companion's needs fields by place, so Save can focus a companion's failing one. */
export function useCompanionNeedsRefs(): (at: number) => NeedsRefs {
  const sets = useRef<NeedsRefs[]>([]);

  return (at) => {
    sets.current[at] ??= emptyRefs();
    return sets.current[at];
  };
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
  broken: { color: tokens.colorBrokenText },
  brokenText: { color: tokens.colorBrokenText },
  figures: { fontVariant: ['tabular-nums'] },
  pressed: { opacity: tokens.opacityPressed },
  lines: { lineHeight: 15 * 1.45 },
  hint: { lineHeight: 13.5 * 1.45 },
  tight: { gap: 6 },
  mark: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  box: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingLeft: 14.5,
    paddingRight: tokens.spaceLg,
    borderRadius: tokens.radiusInset,
    borderWidth: 1.5,
    borderColor: tokens.colorFieldBorder,
    backgroundColor: tokens.colorCard,
  },
  wrong: { borderColor: tokens.colorBroken },
  centred: { alignItems: 'center', justifyContent: 'center' },
  docked: { alignItems: 'flex-end' },
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
  layerDialog: {
    width: 540,
    maxWidth: '92%',
    maxHeight: '88%',
    borderRadius: tokens.space3xl,
    backgroundColor: tokens.colorCard,
    overflow: 'hidden',
  },
  layerPanel: { width: 420, height: '100%', backgroundColor: tokens.colorCard },
  sheet: { gap: 14, paddingHorizontal: tokens.spaceXxl, paddingTop: 20, paddingBottom: 34 },
  sheetHead: { minHeight: tokens.sizeHit, flexDirection: 'row', alignItems: 'center' },
  close: { minHeight: tokens.sizeHit, justifyContent: 'center', paddingLeft: tokens.spaceMd },
  option: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: -10,
    paddingHorizontal: 10,
    borderRadius: tokens.radiusRow,
  },
  lit: { backgroundColor: tokens.colorAccentTint },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: tokens.colorBorder,
  },
  chipAllergy: { borderColor: tokens.colorBroken },
  needs: { gap: 10 },
  disclosure: { minHeight: tokens.sizeHit, flexDirection: 'row', alignItems: 'center', gap: 10 },
  groups: { gap: 22 },
  group: { gap: 4 },
  groupHead: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: tokens.colorBrokenTint,
  },
  twoColumns: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16 },
  half: { width: '48%' },
  check: { minHeight: tokens.sizeHit, flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkBox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: tokens.colorControlBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxOn: { borderColor: tokens.colorAccent, backgroundColor: tokens.colorAccent },
  people: { gap: 14, paddingVertical: 6 },
  person: { gap: 4 },
  allergyLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});

export function useGroupChoice(start: GroupNeedsStart, guestName: string | null, testID: string) {
  const [groups] = useState(start.groups);
  const [pick, setPick] = useState<GroupPick>(start.pick);
  const [picking, setPicking] = useState(start.picking);
  const [typed, setTyped] = useState(start.typed);
  const [returned, setReturned] = useState(start.returned);
  const [taken, setTaken] = useState<string | null>(start.taken);
  const ref = useRef<ViewInstance>(null);
  const close = () => {
    setPicking(false);
    setTyped('');
    setReturned(null);
    setTimeout(() => moveScreenReaderFocus(ref.current), 300);
  };
  const choose = (next: GroupPick) => {
    setPick(next);
    setTaken(null);
    close();
  };
  const over = picking
    ? {
        layer: (
          <GroupLayer onClose={close}>
            <GroupPicker
              guestName={guestName}
              groups={groups}
              chosen={pick == null ? null : 'id' in pick ? pick.id : 'new'}
              typed={typed}
              problem={shownProblem(groups, typed, returned)}
              onTyped={(text) => {
                setTyped(text);
                setReturned(null);
              }}
              onReturn={() => {
                const result = returnPick(groups, typed);
                if ('problem' in result) setReturned(result.problem);
                else choose(result.pick);
              }}
              onPick={(id) => choose(id == null ? null : { id })}
              onCreate={(created) => choose({ name: created })}
              onClose={close}
            />
          </GroupLayer>
        ),
        onClose: close,
      }
    : null;
  const field = (
    <GroupField
      value={pickName(groups, pick)}
      isNew={pick != null && 'name' in pick}
      error={taken == null ? null : GW.taken(taken)}
      onOpen={() => setPicking(true)}
      fieldRef={ref}
      testID={testID}
    />
  );

  return {
    name: pickName(groups, pick),
    field,
    over,
    reset: () => setPick(null),
    /** Save's refusal: a name to create that a colleague's group now has; true when refused. */
    refusedOnSave: () => {
      const clash = pick != null && 'name' in pick ? sameGroup(groups, pick.name) : null;
      if (clash == null) return false;
      setTaken(clash.name);
      setTimeout(() => moveScreenReaderFocus(ref.current), 300);
      return true;
    },
  };
}
