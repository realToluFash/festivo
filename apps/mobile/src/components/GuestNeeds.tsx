import {
  ACCESS_NEEDS,
  ALLERGENS,
  DIETS,
  type GuestNeeds as Recorded,
  NEED_NOTE_MAXIMUM,
} from '@soirely/api-client';
import {
  type NeedsField,
  type NeedsProblems,
  type NeedsTyped,
  accessNames,
  allergyNames,
  dietNames,
  needsChips,
  needsLength,
  needsWords,
} from '@soirely/domain';
import { type RefObject, useState } from 'react';
import { Pressable, StyleSheet, type TextInputInstance, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { tokens } from '../theme/tokens.ts';
import { LineIcon } from './AccountCard.tsx';
import { Field, TextField } from './Field.tsx';
import { Glyph } from './Glyph.tsx';
import { Row } from './SummaryRows.tsx';
import { Text } from './Text.tsx';

const hidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no' } as const;

/** sc-3777's allergy mark: the warning shape and the word Allergy, never colour alone. */
export function AllergyMark({ testID }: { testID?: string }) {
  const { t } = useTranslation();

  return (
    <View style={styles.mark} testID={testID}>
      <View {...hidden}>
        <Glyph name="alert" size={15} ink={tokens.colorBroken} weight={2.4} />
      </View>
      <Text size={13.5} weight="bold" accessible={false} style={styles.broken}>
        {t('guestNeeds.allergy')}
      </Text>
    </View>
  );
}

export type NeedsRefs = Record<NeedsField, RefObject<TextInputInstance | null>>;

function emptyRefs(): NeedsRefs {
  return {
    otherAllergy: { current: null },
    otherDiet: { current: null },
    otherAccess: { current: null },
    note: { current: null },
  };
}

/** Each person's needs fields by `guest` or `c{n}`, so Save can focus the first failing one. */
export function useNeedsRefs(): (who: string) => NeedsRefs {
  const [sets] = useState(() => new Map<string, NeedsRefs>());

  return (who) => {
    const found = sets.get(who);
    if (found != null) return found;
    const made = emptyRefs();
    sets.set(who, made);
    return made;
  };
}

function toggled<T>(list: readonly T[], one: T): T[] {
  return list.includes(one) ? list.filter((each) => each !== one) : [...list, one];
}

/** sc-3777's Needs on the app's form: a disclosure, closed to its chips or a line, open to Allergies, Diet, Access and the Private note. */
export function NeedsSection({
  title,
  needs,
  onChange,
  open,
  onToggle,
  problems,
  fields,
  wide,
  submitting,
  onBlur,
  testID,
}: {
  title: string;
  needs: NeedsTyped;
  onChange: (next: NeedsTyped) => void;
  open: boolean;
  onToggle: () => void;
  problems: NeedsProblems;
  fields?: NeedsRefs;
  /** Two columns of boxes, on tablet landscape. */
  wide: boolean;
  submitting: boolean;
  onBlur: (field: NeedsField) => void;
  testID: string;
}) {
  const { t } = useTranslation();
  const chips = needsChips(t, needs);
  const head =
    chips.length === 0
      ? t('guestNeeds.noneRecorded')
      : t('guestNeeds.noted', { count: chips.length });
  const other = (field: Exclude<NeedsField, 'note'>, label: string) => ({
    label,
    value: needs[field],
    onChange: (value: string) => onChange({ ...needs, [field]: value }),
    error: needsWords(t, problems[field]),
    onBlur: () => onBlur(field),
  });

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
        (chips.length > 0 ? (
          <View style={styles.chips} testID={`${testID}.chips`}>
            {chips.map((chip) => (
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
        ) : (
          <Text size={14} weight="medium" style={[styles.secondary, styles.hint]}>
            {t('guestNeeds.noneRecordedLine')}
          </Text>
        ))}
      {open && (
        <View style={styles.groups}>
          <NeedsGroup
            title={t('guestNeeds.allergies')}
            hint={t('guestNeeds.allergiesHint')}
            pill={t('guestNeeds.shownFirst')}
            codes={ALLERGENS}
            nameOf={(code) => t(`guestNeeds.allergen.${code}`)}
            ticked={needs.allergies}
            onTick={(code) => onChange({ ...needs, allergies: toggled(needs.allergies, code) })}
            otherRef={fields?.otherAllergy}
            other={other('otherAllergy', t('guestNeeds.whichAllergy'))}
            wide={wide}
            submitting={submitting}
            testID={`${testID}.allergies`}
          />
          <NeedsGroup
            title={t('guestNeeds.diet')}
            hint={t('guestNeeds.dietHint')}
            codes={DIETS}
            nameOf={(code) => t(`guestNeeds.dietName.${code}`)}
            ticked={needs.diet}
            onTick={(code) => onChange({ ...needs, diet: toggled(needs.diet, code) })}
            otherRef={fields?.otherDiet}
            other={other('otherDiet', t('guestNeeds.whichDiet'))}
            wide={wide}
            submitting={submitting}
            testID={`${testID}.diet`}
          />
          <NeedsGroup
            title={t('guestNeeds.access')}
            hint={t('guestNeeds.accessHint')}
            codes={ACCESS_NEEDS}
            nameOf={(code) => t(`guestNeeds.accessName.${code}`)}
            ticked={needs.access}
            onTick={(code) => onChange({ ...needs, access: toggled(needs.access, code) })}
            otherRef={fields?.otherAccess}
            other={other('otherAccess', t('guestNeeds.whatElse'))}
            wide={wide}
            submitting={submitting}
            testID={`${testID}.access`}
          />
          <View style={styles.tight}>
            <Field
              label={t('guestNeeds.privateNote')}
              pill={t('eventForm.optional')}
              error={needsWords(t, problems.note)}
              help={t('guestNeeds.noteHint')}
            >
              <TextField
                ref={fields?.note}
                accessibilityLabel={t('guestNeeds.privateNote')}
                value={needs.note}
                onChangeText={(note) => onChange({ ...needs, note })}
                onBlur={() => onBlur('note')}
                wrong={problems.note != null}
                submitting={submitting}
                multiline
                style={styles.note}
                testID={`${testID}.note`}
              />
            </Field>
            <Text size={13.5} weight="medium" style={[styles.secondary, styles.figures]}>
              {t('guestNeeds.noteCount', {
                count: needsLength(needs.note),
                most: NEED_NOTE_MAXIMUM,
              })}
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
  submitting,
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
    error: string | undefined;
    onBlur: () => void;
  };
  otherRef: RefObject<TextInputInstance | null> | undefined;
  wide: boolean;
  submitting: boolean;
  testID: string;
}) {
  return (
    <View style={styles.group}>
      <View style={styles.groupHead}>
        <Text size={15} weight="bold" accessibilityRole="header">
          {title}
        </Text>
        {pill != null && (
          <View style={styles.pill}>
            <Text size={12.5} weight="bold" style={styles.broken}>
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
      {ticked.includes('other' as T) && (
        <Field label={other.label} error={other.error}>
          <TextField
            ref={otherRef}
            accessibilityLabel={other.label}
            value={other.value}
            onChangeText={other.onChange}
            onBlur={other.onBlur}
            wrong={other.error != null}
            submitting={submitting}
            testID={`${testID}.other`}
          />
        </Field>
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
      aria-checked={on}
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

/** The details' Needs, read-only: each person with any, allergies first with the mark, then diet and access on one line, then the note; or No dietary notes. */
export function NeedsRows({
  people,
}: {
  people: readonly { name: string; needs: Recorded | null | undefined; guest: boolean }[];
}) {
  const { t } = useTranslation();
  const shown = people.filter(
    (one): one is { name: string; needs: Recorded; guest: boolean } =>
      one.needs != null &&
      (allergyNames(t, one.needs).length > 0 ||
        dietNames(t, one.needs).length > 0 ||
        accessNames(t, one.needs).length > 0 ||
        one.needs.note != null),
  );

  if (shown.length === 0)
    return (
      <Row
        title={t('guestNeeds.noDietary')}
        lead={<LineIcon name="info" />}
        weight="medium"
        off
        testID="guest.needs.none"
      />
    );

  return (
    <View style={styles.people}>
      {shown.map((one, at) => (
        <PersonNeeds key={`${at}.${one.name}`} {...one} testID={`guest.needs.${at}`} />
      ))}
    </View>
  );
}

function PersonNeeds({
  name,
  needs,
  guest,
  testID,
}: {
  name: string;
  needs: Recorded;
  guest: boolean;
  testID: string;
}) {
  const { t } = useTranslation();
  const allergies = allergyNames(t, needs);
  const rest = [...dietNames(t, needs), ...accessNames(t, needs)];
  const note = needs.note?.trim() ?? '';
  const said = [
    ...(guest ? [] : [name]),
    ...allergies.map((one) => t('guestNeeds.allergyWith', { names: one })),
    ...(rest.length > 0 ? [rest.join(' · ')] : []),
    ...(note === '' ? [] : [`${t('guestNeeds.privateNote')}: ${note}`]),
  ].join('. ');

  return (
    <View style={styles.person} accessible accessibilityLabel={said} testID={testID}>
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
      {note !== '' && (
        <View style={styles.tight}>
          <Text size={13.5} weight="semibold" accessible={false} style={styles.secondary}>
            {t('guestNeeds.privateNote')}
          </Text>
          <Text size={15} weight="medium" accessible={false} style={styles.lines}>
            {note}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  broken: { color: tokens.colorBrokenText },
  figures: { fontVariant: ['tabular-nums'] },
  pressed: { opacity: tokens.opacityPressed },
  lines: { lineHeight: 15 * 1.45 },
  hint: { lineHeight: 13.5 * 1.45 },
  tight: { gap: 6 },
  note: { minHeight: 96, textAlignVertical: 'top' },
  mark: { flexDirection: 'row', alignItems: 'center', gap: 4 },
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
