import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';

import { tokens } from '../../theme/tokens.ts';
import { SectionColumn, SettingsPage, useShell } from './Frame.tsx';
import { Failed, LoadingRows, useLoad } from './MembersLoading.tsx';
import { Pill } from './parts.tsx';
import { PLAIN_OPENING, type RoleOpening, RolePage } from './RolesPage.tsx';
import { RoleList } from './RolesParts.tsx';
import {
  type DemoRole,
  firstEditable,
  type RolesStart,
  rolesStart,
  rolesStateOf,
} from './RolesSample.ts';
import { YOU } from './sample.ts';

const INTRO = `What each person in ${YOU.organisation} may do. Pick one to see it in full.`;

/** Roles in B: the list, a role's grid of areas, new roles and removing one, on sample data. */
export function RolesSection() {
  const { state } = useLocalSearchParams<{ state?: string }>();
  const name = rolesStateOf(state);

  return <RolesScreen key={name} start={rolesStart(name)} />;
}

function RolesScreen({ start }: { start: RolesStart }) {
  const shell = useShell();
  const landscape = shell.layout === 'landscape';
  const phone = shell.layout === 'phone';
  const { load, retry } = useLoad(start.load);
  const [roles, setRoles] = useState<DemoRole[]>(start.roles);
  const [open, setOpen] = useState<string | null>(start.open);
  const [opening, setOpening] = useState<RoleOpening>(start);
  const [visit, setVisit] = useState(0);
  const made = useRef(0);
  const shown = open ?? (landscape ? firstEditable(roles) : null);

  function openRole(id: string | null, with_: RoleOpening = PLAIN_OPENING): void {
    setOpen(id);
    setOpening(with_);
    setVisit((count) => count + 1);
  }

  const newRole = (
    <Pill
      label="New role"
      kind={phone ? 'secondary' : 'primary'}
      full={phone}
      height={phone ? tokens.sizeHitPhoneHero : tokens.sizeHit}
      onPress={() => openRole('new')}
      testID="roles.new"
    />
  );
  const list = (
    <RoleList roles={roles} open={shown} dense={landscape} onOpen={(id) => openRole(id)} />
  );
  const column = landscape ? (
    <SectionColumn title="Roles" sub={INTRO} right={newRole}>
      {list}
    </SectionColumn>
  ) : undefined;

  if (load !== 'loaded')
    return (
      <SettingsPage title="Roles" sub={INTRO}>
        {load === 'failed' ? (
          <Failed
            words="The roles did not load. Try again in a moment."
            onRetry={retry}
            testID="roles.retry"
          />
        ) : (
          <LoadingRows words="Loading roles…" picture={false} />
        )}
      </SettingsPage>
    );

  if (shown == null)
    return (
      <SettingsPage title="Roles" sub={INTRO} right={phone ? undefined : newRole}>
        {list}
        {phone && newRole}
      </SettingsPage>
    );

  const role = shown === 'new' ? null : (roles.find((one) => one.id === shown) ?? null);

  return (
    <RolePage
      key={`${shown}.${visit}`}
      role={role}
      roles={roles}
      viewer={start.viewer}
      opening={opening}
      column={column}
      onBack={() => openRole(null)}
      onSave={(id, grant, name) =>
        setRoles((before) => before.map((one) => (one.id === id ? { ...one, grant, name } : one)))
      }
      onCreate={(name, grant) => {
        made.current += 1;
        const id = `made-${made.current}`;
        setRoles((before) => [
          ...before,
          { id, name, builtIn: false, owner: false, grant, holders: [] },
        ]);
        openRole(id, { ...PLAIN_OPENING, saved: true });
      }}
      onRemove={(id, movedTo) => {
        setRoles((before) => {
          const removed = before.find((one) => one.id === id);

          return before
            .filter((one) => one.id !== id)
            .map((one) =>
              one.id === movedTo && removed != null
                ? {
                    ...one,
                    holders: [...one.holders, ...removed.holders].sort((a, b) =>
                      a.localeCompare(b),
                    ),
                  }
                : one,
            );
        });
        openRole(null);
      }}
    />
  );
}
