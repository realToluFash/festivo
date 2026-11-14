import { GUEST_GROUPS_MOST, GUEST_GROUP_NAME_MAXIMUM, type GuestGroup } from '@soirely/api-client';
import { groupNameLength, groupOptions, sameGroup } from '@soirely/domain';
import type { TFunction } from 'i18next';
import type { ReactNode, RefObject } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { tokens } from '../theme/tokens.ts';
import { Field, FieldError, TextField } from './Field.tsx';
import { Glyph } from './Glyph.tsx';
import { useShellLayout } from './settingsShell.ts';
import { TextAction } from './SummaryRows.tsx';
import { Text } from './Text.tsx';

export type CountedGroup = GuestGroup & { people: number };

export type GroupPick = { id: string } | { name: string } | null;

export type PickProblem = 'blank' | 'tooLong' | 'limit';

/** What Return, or Create, would meet: a name that matches a group is a pick, not a problem; then blank, over 60, and 50 groups. */
export function typedProblem(groups: readonly GuestGroup[], typed: string): PickProblem | null {
  if (typed.trim() === '') return 'blank';
  if (sameGroup(groups, typed) != null) return null;
  if (groupNameLength(typed) > GUEST_GROUP_NAME_MAXIMUM) return 'tooLong';

  return groups.length >= GUEST_GROUPS_MOST ? 'limit' : null;
}

/** Return in the picker's field: the group the name matches, case and accents aside, or the name to make; otherwise its problem. */
export function returnPick(
  groups: readonly GuestGroup[],
  typed: string,
): { pick: GroupPick } | { problem: PickProblem } {
  const found = sameGroup(groups, typed);
  if (found != null) return { pick: { id: found.id } };
  const problem = typedProblem(groups, typed);

  return problem == null ? { pick: { name: typed.trim().replaceAll(/\s+/gu, ' ') } } : { problem };
}

/** Over 60 and 50 groups show as typed; blank only once Return was pressed. */
export function shownProblem(
  groups: readonly GuestGroup[],
  typed: string,
  returned: PickProblem | null,
): PickProblem | null {
  if (typed.trim() === '') return returned;
  const problem = typedProblem(groups, typed);

  return problem === 'blank' ? null : problem;
}

export function pickName(groups: readonly GuestGroup[], pick: GroupPick): string | null {
  if (pick == null) return null;
  if ('name' in pick) return pick.name;

  return groups.find((one) => one.id === pick.id)?.name ?? null;
}

function problemLine(t: TFunction, problem: PickProblem): string {
  if (problem === 'blank') return t('guestGroups.blank');
  if (problem === 'tooLong') return t('guestGroups.tooLong', { most: GUEST_GROUP_NAME_MAXIMUM });

  return t('guestGroups.limitApp', { most: GUEST_GROUPS_MOST });
}

/** The form's Group: a 44 pt button showing the group or No group, read with its label; a new one says it is made on save. */
export function GroupField({
  value,
  isNew,
  error,
  onOpen,
  fieldRef,
}: {
  value: string | null;
  isNew: boolean;
  error: string | undefined;
  onOpen: () => void;
  fieldRef: RefObject<ViewInstance | null>;
}) {
  const { t } = useTranslation();
  const shown = value ?? t('guestGroups.noGroup');

  return (
    <Field
      label={t('guestGroups.group')}
      pill={t('eventForm.optional')}
      error={error}
      help={
        isNew && value != null && error == null
          ? t('guestGroups.madeOnSave', { name: value })
          : undefined
      }
    >
      <Pressable
        ref={fieldRef}
        onPress={onOpen}
        style={({ pressed }) => [
          styles.box,
          error != null && styles.wrong,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('guestGroups.group')}
        accessibilityValue={{ text: shown }}
        aria-invalid={error != null}
        testID="guest.form.group"
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
    </Field>
  );
}

/** The picker's frame, as sc-3785's overlays: a bottom sheet on phone, a centred dialog on tablet portrait, docked at the right edge in landscape. */
function GroupLayer({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const { t } = useTranslation();
  const layout = useShellLayout();

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
        accessibilityLabel={t('guestList.cancel')}
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
        testID={`guest.groupPicker.${layout}`}
      >
        <ScrollView bounces={false} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

/** Group's picker, FocusedScreen's `over`: No group while nothing is typed, the groups that hold the text with their people, then Create. */
export function GroupPicker({
  guestName,
  groups,
  pick,
  typed,
  problem,
  onTyped,
  onReturn,
  onPick,
  onClose,
}: {
  guestName: string | null;
  groups: readonly CountedGroup[];
  pick: GroupPick;
  typed: string;
  problem: PickProblem | null;
  onTyped: (typed: string) => void;
  onReturn: () => void;
  onPick: (pick: GroupPick) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const options = groupOptions(groups, typed);
  const create =
    options.create != null && typedProblem(groups, typed) == null ? options.create : null;
  const line = problem == null ? null : problemLine(t, problem);
  const chosen = pick == null ? null : 'id' in pick ? pick.id : 'new';

  return (
    <GroupLayer onClose={onClose}>
      <View style={styles.sheet}>
        <View style={styles.sheetHead}>
          <Text size={20} weight="bold" accessibilityRole="header" style={styles.grow}>
            {t('guestGroups.group')}
          </Text>
          <TextAction
            label={t('guestList.cancel')}
            onPress={onClose}
            testID="guest.groupPicker.close"
          />
        </View>
        {guestName != null && (
          <Text size={14.5} weight="medium" style={[styles.secondary, styles.lines]}>
            {t('guestGroups.forWhom', { name: guestName })}
          </Text>
        )}
        <View style={styles.tight}>
          <TextField
            value={typed}
            wrong={line != null}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            submitBehavior="submit"
            onChangeText={onTyped}
            onSubmitEditing={onReturn}
            placeholder={t('guestGroups.chooseOrType')}
            accessibilityLabel={t('guestGroups.chooseOrType')}
            aria-invalid={line != null}
            testID="guest.groupPicker.field"
          />
          {line != null && <FieldError message={line} />}
        </View>
        <View>
          {typed.trim() === '' && (
            <PickRow
              word={t('guestGroups.noGroup')}
              on={chosen == null}
              onPress={() => onPick(null)}
              testID="guest.groupPicker.none"
            />
          )}
          {options.groups.map((one) => (
            <PickRow
              key={one.id}
              word={one.name}
              count={t('guestGroups.people', { count: one.people })}
              on={chosen === one.id}
              onPress={() => onPick({ id: one.id })}
              testID={`guest.groupPicker.${one.id}`}
            />
          ))}
          {create != null && (
            <PickRow
              word={t('guestGroups.createNamed', { name: create })}
              count={t('guestGroups.newGroup')}
              on={false}
              create
              onPress={() => onPick({ name: create })}
              testID="guest.groupPicker.create"
            />
          )}
        </View>
      </View>
    </GroupLayer>
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

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
  figures: { fontVariant: ['tabular-nums'] },
  pressed: { opacity: tokens.opacityPressed },
  lines: { lineHeight: 14.5 * 1.45 },
  tight: { gap: 6 },
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
});
