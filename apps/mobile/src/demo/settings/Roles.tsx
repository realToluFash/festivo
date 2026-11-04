import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import type { ViewInstance } from 'react-native';

import { Landscape, useShell } from './Frame.tsx';
import { useLoad } from './MembersLoading.tsx';
import { EditScreen } from './RolesEdit.tsx';
import { PLAIN_OPENING, type RoleOpening, RolePage } from './RolesPage.tsx';
import { RoleRows, RolesCardView } from './RolesParts.tsx';
import {
  type DemoRole,
  firstEditable,
  type Removed,
  type RolesStart,
  rolesStart,
  rolesStateOf,
} from './RolesSample.ts';
import { FailedBlock, LoadingBlock, SummaryColumn, SummaryPage } from './Summary.tsx';

/** Roles in B, summary first: the card, the roles, a role's page that reads, and editing on a screen of its own. */
export function RolesSection() {
  const { state } = useLocalSearchParams<{ state?: string }>();
  const name = rolesStateOf(state);

  return <RolesScreen key={name} start={rolesStart(name)} />;
}

function RolesScreen({ start }: { start: RolesStart }) {
  const shell = useShell();
  const landscape = shell.layout === 'landscape';
  const { load, retry } = useLoad(start.load);
  const [roles, setRoles] = useState<DemoRole[]>(start.roles);
  const [open, setOpen] = useState<string | null>(start.open === 'new' ? null : start.open);
  const [opening, setOpening] = useState<RoleOpening>(start);
  const [visit, setVisit] = useState(0);
  const [creating, setCreating] = useState(start.open === 'new');
  const [newVisit, setNewVisit] = useState(0);
  const [gone, setGone] = useState<Removed | null>(null);
  const made = useRef(0);
  const cardStep = useRef<ViewInstance>(null);
  const shown = open ?? (landscape ? firstEditable(roles) : null);
  const role = roles.find((one) => one.id === shown) ?? null;

  function openRole(id: string | null, with_: RoleOpening = PLAIN_OPENING): void {
    setGone(null);
    setOpen(id);
    setOpening(with_);
    setVisit((count) => count + 1);
  }

  function newRole(): void {
    setGone(null);
    setNewVisit((count) => count + 1);
    setCreating(true);
  }

  function create(name: string, grant: string[]): void {
    made.current += 1;
    const id = `made-${made.current}`;
    setRoles((before) => [
      ...before,
      { id, name, builtIn: false, owner: false, grant, holders: [] },
    ]);
    setCreating(false);
    openRole(id, { ...PLAIN_OPENING, saved: true, announce: true });
  }

  function remove(id: string, movedTo: string | null): void {
    const removed = roles.find((one) => one.id === id);
    if (removed == null) return;
    const to = roles.find((one) => one.id === movedTo) ?? null;
    setRoles((before) =>
      before
        .filter((one) => one.id !== id)
        .map((one) =>
          one.id === movedTo
            ? {
                ...one,
                holders: [...one.holders, ...removed.holders].sort((a, b) => a.localeCompare(b)),
              }
            : one,
        ),
    );
    openRole(null);
    setGone({ name: removed.name, holders: removed.holders.length, movedTo: to?.name ?? null });
  }

  const list = (
    <>
      <RolesCardView
        roles={roles}
        gone={gone}
        compact={landscape}
        wide={shell.layout === 'portrait'}
        stepRef={cardStep}
        onNew={newRole}
      />
      <RoleRows
        roles={roles}
        open={landscape ? shown : null}
        dense={landscape}
        onOpen={(id) => openRole(id)}
      />
    </>
  );
  const newScreen = (
    <EditScreen
      key={newVisit}
      role={null}
      roles={roles}
      viewer={start.viewer}
      open={creating}
      start={{ grant: null, area: null, nameRefused: newVisit === 0 && start.nameRefused }}
      opener={cardStep}
      onCancel={() => setCreating(false)}
      onSave={(grant, name) => create(name, grant)}
    />
  );

  if (load !== 'loaded') {
    const block =
      load === 'failed' ? (
        <FailedBlock
          title="We could not load the roles."
          line="Check your connection and try again."
          onRetry={retry}
          testID="roles.retry"
        />
      ) : (
        <LoadingBlock words="Loading roles…" height={landscape ? 156 : 200} />
      );

    return landscape ? (
      <Landscape column={<SummaryColumn title="Roles">{block}</SummaryColumn>}>{null}</Landscape>
    ) : (
      <SummaryPage title="Roles">{block}</SummaryPage>
    );
  }

  if (role == null)
    return (
      <>
        <SummaryPage title="Roles">{list}</SummaryPage>
        {newScreen}
      </>
    );

  return (
    <>
      <RolePage
        key={`${role.id}.${visit}`}
        role={role}
        roles={roles}
        viewer={start.viewer}
        opening={opening}
        column={landscape ? <SummaryColumn title="Roles">{list}</SummaryColumn> : undefined}
        back={landscape ? null : { label: 'Roles', onPress: () => openRole(null) }}
        onSave={(id, grant, name) =>
          setRoles((before) => before.map((one) => (one.id === id ? { ...one, grant, name } : one)))
        }
        onRemove={remove}
      />
      {newScreen}
    </>
  );
}
