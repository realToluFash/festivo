import { roleNameOf } from '@soirely/domain';
import { type RefObject, useEffect, useRef, useState } from 'react';
import {
  type ScrollViewInstance,
  StyleSheet,
  type TextInputInstance,
  View,
  type ViewInstance,
} from 'react-native';

import { Field, focusChecked, TextField } from '../../components/Field.tsx';
import { RadioMark } from '../../components/RadioMark.tsx';
import { SETTLED_MS } from '../../components/Screen.tsx';
import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { AreaRows } from './RolesGrid.tsx';
import {
  APPLIES,
  changedAreas,
  changesLine,
  type DemoRole,
  describeRole,
  discardTitle,
  lockedIntro,
  nameProblem,
  people,
  removeLine,
  replacements,
  type RolesViewer,
  unsavedLine,
} from './RolesSample.ts';
import { Ask, type AskProps, FocusedScreen, Line, Row, RowList } from './Summary.tsx';

type Opener = RefObject<ScreenReaderTarget | null>;

export interface EditStart {
  grant: string[] | null;
  area: string | null;
  nameRefused: boolean;
}

/** A role's access on its own screen, or a new role's: Save, or Create, once something changes; Cancel asks first. */
export function EditScreen({
  role,
  roles,
  viewer,
  open,
  start,
  opener,
  onCancel,
  onSave,
}: {
  role: DemoRole | null;
  roles: readonly DemoRole[];
  viewer: RolesViewer;
  open: boolean;
  start: EditStart;
  opener: Opener;
  onCancel: () => void;
  onSave: (grant: string[], name: string) => void;
}) {
  const creating = role == null;
  const naming = creating || !role.builtIn;
  const saved = role?.grant ?? [];
  const [grant, setGrant] = useState<string[]>(start.grant ?? saved);
  const [area, setArea] = useState(start.area);
  const [renamed, setRenamed] = useState(false);
  const [nameError, setNameError] = useState<string | null>(
    start.nameRefused ? nameProblem('', roles, null) : null,
  );
  const [discarding, setDiscarding] = useState(false);
  const typed = useRef(role?.name ?? '');
  const nameInput = useRef<TextInputInstance>(null);
  const scroll = useRef<ScrollViewInstance>(null);
  const list = useRef<ViewInstance>(null);
  const rows = useRef<Record<string, ViewInstance | null>>({});
  const shown = useRef(false);
  const changes = changedAreas(saved, grant) + (renamed ? 1 : 0);
  const locked = lockedIntro(grant, viewer.held, viewer.role);

  useEffect(() => {
    if (!open || !start.nameRefused) return;
    const focus = setTimeout(() => focusChecked(nameInput), SETTLED_MS);

    return () => clearTimeout(focus);
  }, [open, start.nameRefused]);

  function showStart(listY: number): void {
    const row = start.area == null ? null : rows.current[start.area];
    if (shown.current || !open || row == null || list.current == null) return;
    shown.current = true;
    row.measureLayout(list.current, (_x, y) =>
      scroll.current?.scrollTo({ y: listY + y - tokens.spaceSm, animated: false }),
    );
  }

  function save(): void {
    const problem = naming ? nameProblem(typed.current, roles, role?.id ?? null) : null;
    if (problem != null) {
      setNameError(problem);
      focusChecked(nameInput);
      return;
    }
    setNameError(null);
    onSave(grant, naming ? roleNameOf(typed.current) : (role?.name ?? ''));
  }

  const ask: AskProps | null = discarding
    ? {
        title: creating ? 'Discard the new role?' : discardTitle(changes),
        line: creating ? 'Nothing is created.' : `${role.name} stays as it was.`,
        keep: { label: 'Keep editing', testID: 'roles.keep' },
        confirm: { label: 'Discard', testID: 'roles.discard', removes: true },
        onKeep: () => setDiscarding(false),
        onConfirm: onCancel,
      }
    : null;
  const told = changesLine(changes, role?.holders ?? []);

  return (
    <FocusedScreen
      open={open}
      title={role?.name ?? 'New role'}
      verb={{
        label: creating ? 'Create' : 'Save',
        on: creating || changes > 0,
        onPress: save,
        testID: 'roles.save',
      }}
      onCancel={() => (changes > 0 ? setDiscarding(true) : onCancel())}
      cancelTestID="roles.cancel"
      opener={opener}
      ask={ask}
      scrollRef={scroll}
    >
      {creating ? (
        <Line size={14.5} text={unsavedLine(true, '', 0)} />
      ) : changes > 0 ? (
        <View style={styles.told}>
          <Text size={14.5} weight="semibold">
            {told.count}
          </Text>
          <Line size={14.5} text={told.rest} />
        </View>
      ) : (
        locked == null && <Line size={14.5} text={APPLIES} />
      )}
      {locked != null && <Line size={14.5} text={locked} />}
      {naming && (
        <Field label="Role name" error={nameError}>
          <TextField
            ref={nameInput}
            defaultValue={role?.name ?? ''}
            onChangeText={(text) => {
              typed.current = text;
              setRenamed(roleNameOf(text) !== roleNameOf(role?.name ?? ''));
              if (nameError != null) setNameError(nameProblem(text, roles, role?.id ?? null));
            }}
            onSubmitEditing={save}
            accessibilityLabel="Role name"
            autoCapitalize="sentences"
            autoCorrect={false}
            returnKeyType="done"
            submitBehavior="submit"
            maxLength={160}
            wrong={nameError != null}
            testID="roles.name"
          />
        </Field>
      )}
      {creating && <Line text={describeRole(null)} />}
      <View ref={list} onLayout={(event) => showStart(event.nativeEvent.layout.y)}>
        <AreaRows
          grant={grant}
          saved={creating ? null : saved}
          held={viewer.held}
          open={area}
          rowRefs={rows}
          onOpen={setArea}
          onChange={setGrant}
        />
      </View>
    </FocusedScreen>
  );
}

/** Removing a role somebody holds moves them first, to any role but Owner; with nobody on it, one question. */
export function RemoveScreen({
  role,
  roles,
  viewer,
  open,
  opener,
  onCancel,
  onRemove,
}: {
  role: DemoRole;
  roles: readonly DemoRole[];
  viewer: RolesViewer;
  open: boolean;
  opener: Opener;
  onCancel: () => void;
  onRemove: (movedTo: string | null) => void;
}) {
  const choices = replacements(roles, role, viewer.held);
  const [picked, setPicked] = useState<string | null>(null);
  const moveTo = choices.find((choice) => choice.id === picked);
  const holders = role.holders.length;

  if (holders === 0)
    return (
      <Ask
        open={open}
        opener={opener}
        title={`Remove ${role.name}?`}
        line={removeLine(0)}
        keep={{ label: `Keep ${role.name}`, testID: 'roles.remove.keep' }}
        confirm={{ label: 'Remove', testID: 'roles.remove.confirm', removes: true }}
        onKeep={onCancel}
        onConfirm={() => onRemove(null)}
      />
    );

  return (
    <FocusedScreen
      open={open}
      title={`Remove ${role.name}`}
      verb={{
        label: 'Remove',
        on: moveTo != null,
        removes: true,
        onPress: () => onRemove(picked),
        testID: 'roles.remove.confirm',
      }}
      onCancel={onCancel}
      cancelTestID="roles.remove.keep"
      opener={opener}
    >
      <Line quiet={false} text={removeLine(holders)} />
      <View accessibilityRole="radiogroup">
        <RowList
          items={choices.map((choice) => {
            const on = choice.id === picked;

            return {
              key: choice.id,
              row: (
                <Row
                  title={choice.name}
                  line={people(choice.holders.length)}
                  accent={on}
                  trail={<RadioMark on={on} />}
                  onPress={() => setPicked(choice.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  testID={`roles.moveTo.${choice.id}`}
                />
              ),
            };
          })}
        />
      </View>
      {moveTo != null && (
        <Line text={`They become ${moveTo.name} on their next request. Nobody is signed out.`} />
      )}
    </FocusedScreen>
  );
}

const styles = StyleSheet.create({
  told: { gap: tokens.spaceHair },
});
