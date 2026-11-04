import { roleNameOf, sameGrant } from '@soirely/domain';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { type ScrollViewInstance, StyleSheet, type TextInputInstance, View } from 'react-native';

import { focusChecked } from '../../components/Field.tsx';
import { Notice } from '../../components/Notice.tsx';
import { tokens } from '../../theme/tokens.ts';
import { SettingsPage, useShell } from './Frame.tsx';
import { Pill } from './parts.tsx';
import { YOU } from './sample.ts';
import { Grid } from './RolesGrid.tsx';
import { RemoveRole, RoleNameCard, Unsaved, WhatTheySee, WhoHasIt } from './RolesParts.tsx';
import {
  type DemoRole,
  describeRole,
  lockedIntro,
  nameProblem,
  replacements,
  type RolesViewer,
  unsavedLine,
} from './RolesSample.ts';

export interface RoleOpening {
  grant: string[] | null;
  saved: boolean;
  removing: boolean;
  nameRefused: boolean;
}

export const PLAIN_OPENING: RoleOpening = {
  grant: null,
  saved: false,
  removing: false,
  nameRefused: false,
};

const DOCK_ROOM = 220;

/** A role's page: its grid, who has it and what they will see; `role` null is a new one. */
export function RolePage({
  role,
  roles,
  viewer,
  opening,
  column,
  onBack,
  onSave,
  onCreate,
  onRemove,
}: {
  role: DemoRole | null;
  roles: readonly DemoRole[];
  viewer: RolesViewer;
  opening: RoleOpening;
  column: ReactNode;
  onBack: () => void;
  onSave: (id: string, grant: string[], name: string) => void;
  onCreate: (name: string, grant: string[]) => void;
  onRemove: (id: string, movedTo: string | null) => void;
}) {
  const shell = useShell();
  const phone = shell.layout === 'phone';
  const creating = role == null;
  const editable = creating || !role.owner;
  const naming = creating || !role.builtIn;
  const saved = role?.grant ?? [];
  const [grant, setGrant] = useState<string[]>(opening.grant ?? saved);
  const [notice, setNotice] = useState(opening.saved);
  const [removing, setRemoving] = useState(opening.removing);
  const [nameError, setNameError] = useState<string | null>(
    opening.nameRefused ? 'Give the role a name.' : null,
  );
  const [renamed, setRenamed] = useState(false);
  const [nameField, setNameField] = useState(0);
  const typed = useRef(role?.name ?? '');
  const nameInput = useRef<TextInputInstance>(null);
  const scroll = useRef<ScrollViewInstance>(null);
  const dirty = editable && (creating || renamed || !sameGrant(grant, saved));
  const title = role?.name ?? 'New role';

  useEffect(() => {
    if (opening.nameRefused) focusChecked(nameInput);
  }, [opening.nameRefused]);

  function change(next: string[]): void {
    setGrant(next);
    setNotice(false);
  }

  function save(): void {
    const problem = naming ? nameProblem(typed.current, roles, role?.id ?? null) : null;
    if (problem != null) {
      setNameError(problem);
      focusChecked(nameInput);
      return;
    }
    setNameError(null);
    if (role == null) {
      onCreate(roleNameOf(typed.current), grant);
      return;
    }
    onSave(role.id, grant, naming ? roleNameOf(typed.current) : role.name);
    setRenamed(false);
    setNotice(true);
    scroll.current?.scrollTo({ y: 0, animated: true });
  }

  function discard(): void {
    setGrant(saved);
    typed.current = role?.name ?? '';
    setRenamed(false);
    setNameError(null);
    setNameField((key) => key + 1);
  }

  if (removing && role != null)
    return (
      <Removing
        role={role}
        roles={roles}
        viewer={viewer}
        column={column}
        onBack={onBack}
        onKeep={() => setRemoving(false)}
        onRemove={onRemove}
      />
    );

  const removeOpener =
    role != null && !role.builtIn ? (
      <Pill
        label="Remove role…"
        kind="dangerQuiet"
        full={phone}
        height={phone ? tokens.sizeHitPhoneHero : tokens.sizeHit}
        onPress={() => {
          setRemoving(true);
          scroll.current?.scrollTo({ y: 0, animated: false });
        }}
        testID="roles.remove"
      />
    ) : null;
  const locked = editable ? lockedIntro(grant, viewer.held, viewer.role) : null;
  const unsaved = dirty && (
    <Unsaved
      line={unsavedLine(creating, title, role?.holders.length ?? 0)}
      save={creating ? 'Create role' : `Save ${title}`}
      onSave={save}
      onDiscard={creating ? null : discard}
      docked={phone}
    />
  );

  return (
    <SettingsPage
      title={title}
      sub={describeRole(role)}
      back={{ label: 'Roles', onPress: onBack }}
      right={phone ? undefined : removeOpener}
      column={column}
      scrollRef={scroll}
      dock={phone ? unsaved : undefined}
    >
      {role?.owner === true && (
        <Notice
          tone="quiet"
          mark={tokens.marks.info.glyph}
          body={`Owner is built in and can't be edited or removed. It always has everything, and ${YOU.organisation} always has at least one.`}
        />
      )}
      {notice && (
        <Notice
          tone="done"
          mark={tokens.marks.done.glyph}
          title={`Saved. Applies on each person's next request.`}
          announce
        />
      )}
      {locked != null && <Notice tone="quiet" mark={tokens.marks.info.glyph} body={locked} />}
      {naming && (
        <RoleNameCard
          key={nameField}
          defaultValue={role?.name ?? ''}
          error={nameError}
          inputRef={nameInput}
          onChange={(text) => {
            typed.current = text;
            setRenamed(roleNameOf(text) !== roleNameOf(role?.name ?? ''));
            setNotice(false);
          }}
          onSubmit={save}
        />
      )}
      <Grid grant={grant} held={viewer.held} editable={editable} phone={phone} onChange={change} />
      {!phone && unsaved}
      {role != null && <WhoHasIt holders={role.holders} />}
      <WhatTheySee grant={grant} end={phone ? removeOpener : null} />
      {phone && dirty && <View style={styles.dockRoom} />}
    </SettingsPage>
  );
}

function Removing({
  role,
  roles,
  viewer,
  column,
  onBack,
  onKeep,
  onRemove,
}: {
  role: DemoRole;
  roles: readonly DemoRole[];
  viewer: RolesViewer;
  column: ReactNode;
  onBack: () => void;
  onKeep: () => void;
  onRemove: (id: string, movedTo: string | null) => void;
}) {
  const shell = useShell();
  const [picked, setPicked] = useState<string | null>(null);
  const [refused, setRefused] = useState(false);
  const choices = replacements(roles, role, viewer.held);

  return (
    <SettingsPage title={role.name} back={{ label: 'Roles', onPress: onBack }} column={column}>
      <RemoveRole
        role={role}
        choices={choices}
        picked={picked}
        refused={refused}
        layout={shell.layout}
        onPick={(id) => {
          setPicked(id);
          setRefused(false);
        }}
        onRemove={() => {
          if (role.holders.length > 0 && picked == null) {
            setRefused(true);
            return;
          }
          onRemove(role.id, picked);
        }}
        onKeep={onKeep}
      />
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  dockRoom: { height: DOCK_ROOM },
});
