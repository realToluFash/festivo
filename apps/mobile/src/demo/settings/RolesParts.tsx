import type { ReactNode, RefObject } from 'react';
import { Pressable, StyleSheet, type TextInputInstance, View } from 'react-native';

import { Field, FieldError, TextField } from '../../components/Field.tsx';
import { RadioMark } from '../../components/RadioMark.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { Glyph } from '../../components/Glyph.tsx';
import { Avatar, Card, CardHead, Chip, Pair, Pill, TYPE } from './parts.tsx';
import {
  type DemoRole,
  describeRole,
  holdersLine,
  people,
  removeLine,
  seeLines,
  suspendedHolder,
} from './RolesSample.ts';
import { MEMBERS, type SettingsLayout } from './sample.ts';

export interface Choice {
  value: string;
  name: string;
  means?: string | undefined;
}

/** Radio cards: one column on the phone and in a narrow column, two on a tablet's page. */
export function RadioCards({
  choices,
  picked,
  onPick,
  twoUp,
  testID,
}: {
  choices: readonly Choice[];
  picked: string | null;
  onPick: (value: string) => void;
  twoUp: boolean;
  testID: string;
}) {
  return (
    <View style={[styles.choices, twoUp && styles.choicesTwoUp]} accessibilityRole="radiogroup">
      {choices.map((choice) => {
        const on = choice.value === picked;

        return (
          <Pressable
            key={choice.value}
            style={[styles.choice, twoUp && styles.choiceTwoUp, on && styles.choiceOn]}
            onPress={() => onPick(choice.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={
              choice.means == null ? choice.name : `${choice.name}. ${choice.means}`
            }
            testID={`${testID}.${choice.value}`}
          >
            <RadioMark on={on} />
            <View style={styles.choiceWords}>
              <Text
                size={15.5}
                weight="semibold"
                accessible={false}
                style={on ? styles.accent : undefined}
              >
                {choice.name}
              </Text>
              {choice.means != null && (
                <Text size={TYPE.small} weight="medium" accessible={false} style={styles.secondary}>
                  {choice.means}
                </Text>
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function RoleList({
  roles,
  open,
  dense,
  onOpen,
}: {
  roles: readonly DemoRole[];
  open: string | null;
  dense: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <View style={styles.list}>
      {roles.map((role, index) => {
        const on = role.id === open;
        const after = index > 0 && !on && roles[index - 1]?.id !== open;
        const describe = describeRole(role);
        const count = people(role.holders.length);

        return (
          <Pressable
            key={role.id}
            onPress={() => onOpen(role.id)}
            style={({ pressed }) => [
              styles.role,
              dense && styles.roleDense,
              on && styles.roleOpen,
              pressed && !on && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={[
              role.name,
              ...(role.builtIn ? ['Built in'] : []),
              ...(dense ? [] : [describe]),
              count,
            ].join('. ')}
            testID={`roles.role.${role.id}`}
          >
            {after && <View style={styles.roleRule} />}
            <View style={styles.roleWords}>
              <View style={styles.nameRow}>
                <Text
                  size={dense ? TYPE.row : TYPE.card}
                  weight={dense ? 'semibold' : 'bold'}
                  accessible={false}
                  style={on ? styles.accent : undefined}
                >
                  {role.name}
                </Text>
                {role.builtIn && <Chip word="Built in" kind="built" />}
              </View>
              {!dense && (
                <Text size={TYPE.body} weight="medium" accessible={false} style={styles.secondary}>
                  {describe}
                </Text>
              )}
              <Text size={TYPE.small} weight="medium" accessible={false} style={styles.secondary}>
                {count}
              </Text>
            </View>
            <Glyph
              name="chevron"
              size={18}
              ink={on ? tokens.colorAccent : tokens.colorInkTertiary}
              weight={2.2}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

function memberTone(name: string): { initials: string; tone: number } {
  const index = MEMBERS.findIndex((member) => member.name === name);

  return { initials: MEMBERS[index]?.initials ?? name.slice(0, 1), tone: Math.max(index, 0) };
}

export function WhoHasIt({ holders }: { holders: readonly string[] }) {
  const { shown, more } = holdersLine(holders);

  return (
    <Card gap={10}>
      <CardHead title="Who has this role" />
      <Text
        size={TYPE.body}
        weight="medium"
        style={holders.length === 0 ? styles.secondary : undefined}
      >
        {holders.length === 0 ? 'Nobody yet.' : people(holders.length)}
      </Text>
      {shown.map((name) => {
        const { initials, tone } = memberTone(name);

        return (
          <View key={name} style={styles.holder}>
            <Avatar initials={initials} side={32} tone={tone} />
            <Text size={15.5} weight="medium">
              {name}
            </Text>
            {suspendedHolder(name) && <Chip word="Suspended" kind="suspended" />}
          </View>
        );
      })}
      {more != null && (
        <Text size={TYPE.body} weight="medium" style={styles.secondary}>
          {more}
        </Text>
      )}
    </Card>
  );
}

export function WhatTheySee({ grant, end }: { grant: readonly string[]; end?: ReactNode }) {
  const { hidden, read } = seeLines(grant);

  return (
    <Card gap={10}>
      <CardHead title="What they will see" />
      <Text size={15.5} weight="medium">
        {hidden}
      </Text>
      <Text size={15.5} weight="medium">
        {read}
      </Text>
      <Text size={TYPE.small} weight="medium" style={styles.secondary}>
        A control they can&apos;t use is not shown to them at all, rather than shown and greyed out.
      </Text>
      {end}
    </Card>
  );
}

/** Any change brings it: docked above the tab bar on the phone, under the grid on a tablet. */
export function Unsaved({
  line,
  save,
  onSave,
  onDiscard,
  docked,
}: {
  line: string;
  save: string;
  onSave: () => void;
  onDiscard: (() => void) | null;
  docked: boolean;
}) {
  const discard = onDiscard != null && (
    <Pill
      label="Discard changes"
      kind="secondary"
      onPress={onDiscard}
      full={docked}
      height={docked ? tokens.sizeHitPhoneHero : tokens.sizeHitPhonePrimary}
      testID="roles.discard"
    />
  );
  const keep = (
    <Pill
      label={save}
      onPress={onSave}
      full={docked}
      height={docked ? tokens.sizeHitPhoneHero : tokens.sizeHitPhonePrimary}
      testID="roles.save"
    />
  );

  return (
    <View style={[styles.unsaved, docked && styles.docked]}>
      <Text size={TYPE.body} weight="medium">
        {line}
      </Text>
      {docked ? (
        <View style={styles.stack}>
          {keep}
          {discard}
        </View>
      ) : (
        <View style={styles.unsavedRow}>
          {discard}
          {keep}
        </View>
      )}
    </View>
  );
}

export function RoleNameCard({
  defaultValue,
  error,
  inputRef,
  onChange,
  onSubmit,
}: {
  defaultValue: string;
  error: string | null;
  inputRef: RefObject<TextInputInstance | null>;
  onChange: (text: string) => void;
  onSubmit: () => void;
}) {
  return (
    <Card>
      <Field label="Role name" error={error}>
        <TextField
          ref={inputRef}
          defaultValue={defaultValue}
          onChangeText={onChange}
          onSubmitEditing={onSubmit}
          accessibilityLabel="Role name"
          autoCapitalize="sentences"
          autoCorrect={false}
          returnKeyType="done"
          submitBehavior="submit"
          maxLength={160}
          wrong={error != null}
          testID="roles.name"
        />
      </Field>
    </Card>
  );
}

export function RemoveRole({
  role,
  choices,
  picked,
  refused,
  layout,
  onPick,
  onRemove,
  onKeep,
}: {
  role: DemoRole;
  choices: readonly DemoRole[];
  picked: string | null;
  refused: boolean;
  layout: SettingsLayout;
  onPick: (id: string) => void;
  onRemove: () => void;
  onKeep: () => void;
}) {
  const holders = role.holders.length;
  const tablet = layout !== 'phone';
  const moveTo = choices.find((choice) => choice.id === picked);

  return (
    <Card>
      <Text size={22} weight="bold" accessibilityRole="header" style={styles.removeTitle}>
        {`Remove ${role.name}?`}
      </Text>
      <Text size={15.5} weight="medium">
        {removeLine(holders)}
      </Text>
      {holders > 0 && (
        <RadioCards
          choices={choices.map((choice) => ({
            value: choice.id,
            name: choice.name,
            means: describeRole(choice),
          }))}
          picked={picked}
          onPick={onPick}
          twoUp={false}
          testID="roles.moveTo"
        />
      )}
      {moveTo != null && (
        <Text size={TYPE.body} weight="medium" style={styles.secondary}>
          {`They become ${moveTo.name} on their next request. Nobody is signed out.`}
        </Text>
      )}
      {refused && moveTo == null && <FieldError message="Choose the role these people move to." />}
      <Pair
        layout={layout}
        confirm={
          <Pill
            label={holders > 0 ? `Move them and remove ${role.name}` : `Remove ${role.name}`}
            kind="danger"
            full={!tablet}
            onPress={onRemove}
            testID="roles.remove.confirm"
          />
        }
        dismiss={
          <Pill
            label={`Keep ${role.name}`}
            kind="quiet"
            full={!tablet}
            onPress={onKeep}
            testID="roles.remove.keep"
          />
        }
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  accent: { color: tokens.colorAccentText },
  secondary: { color: tokens.colorInkSecondary },
  pressed: { backgroundColor: tokens.colorNeutralFill },
  stack: { gap: tokens.spaceMd },
  choices: { gap: tokens.spaceSm },
  choicesTwoUp: { flexDirection: 'row', flexWrap: 'wrap' },
  choice: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceLg,
    paddingVertical: tokens.spaceLg,
    paddingHorizontal: 14,
    borderRadius: tokens.spaceXl,
    borderWidth: 1.5,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  choiceTwoUp: { flexGrow: 1, flexBasis: '40%' },
  choiceOn: {
    borderWidth: 2,
    borderColor: tokens.colorAccent,
    backgroundColor: tokens.colorAccentTint,
  },
  choiceWords: { flex: 1, minWidth: 0, gap: 2 },
  list: {
    borderRadius: tokens.space3xl,
    backgroundColor: tokens.colorInset,
    padding: tokens.spaceXxs,
  },
  role: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    paddingVertical: 14,
    paddingLeft: tokens.spaceXl,
    paddingRight: 14,
    borderRadius: tokens.spaceXl,
  },
  roleDense: { minHeight: 64, paddingVertical: 11, paddingLeft: 14, paddingRight: tokens.spaceLg },
  roleOpen: {
    backgroundColor: tokens.colorAccentTint,
    borderWidth: 2,
    borderColor: tokens.colorAccent,
  },
  roleRule: {
    position: 'absolute',
    left: tokens.spaceXl,
    right: 0,
    top: 0,
    height: 1,
    backgroundColor: tokens.colorBorder,
  },
  roleWords: { flex: 1, minWidth: 0, gap: 3 },
  nameRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceSm },
  holder: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
  },
  unsaved: {
    gap: tokens.spaceLg,
    padding: tokens.spaceXl,
    borderRadius: tokens.space3xl,
    backgroundColor: tokens.colorAttentionTint,
  },
  docked: {
    ...tokens.elevationNative.popover.ios,
    elevation: tokens.elevationNative.popover.android.elevation,
  },
  unsavedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: tokens.spaceMd,
  },
  removeTitle: { letterSpacing: 22 * -0.015 },
});
