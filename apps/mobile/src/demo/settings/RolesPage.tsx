import { type ReactNode, useEffect, useRef, useState } from 'react';
import type { ScrollViewInstance, ViewInstance } from 'react-native';

import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import { EditScreen, RemoveScreen } from './RolesEdit.tsx';
import { AccessRows } from './RolesGrid.tsx';
import { RoleCard, WhatTheySee, WhoHasIt } from './RolesParts.tsx';
import { type DemoRole, removeLine, type RolesViewer } from './RolesSample.ts';
import { SummaryPage, TextAction } from './Summary.tsx';

export interface RoleOpening {
  grant: string[] | null;
  editing: boolean;
  area: string | null;
  saved: boolean;
  announce?: boolean;
  removing: boolean;
}

export const PLAIN_OPENING: RoleOpening = {
  grant: null,
  editing: false,
  area: null,
  saved: false,
  removing: false,
};

/** A role's page reads: the card, its access, who has it and what they see; editing and removing are screens of their own. */
export function RolePage({
  role,
  roles,
  viewer,
  opening,
  column,
  back,
  onSave,
  onRemove,
}: {
  role: DemoRole;
  roles: readonly DemoRole[];
  viewer: RolesViewer;
  opening: RoleOpening;
  column: ReactNode;
  back: { label: string; onPress: () => void } | null;
  onSave: (id: string, grant: string[], name: string) => void;
  onRemove: (id: string, movedTo: string | null) => void;
}) {
  const [saved, setSaved] = useState(opening.saved);
  const [editing, setEditing] = useState(opening.editing);
  const [edit, setEdit] = useState({
    visit: 0,
    area: opening.area,
    grant: opening.grant,
  });
  const [removing, setRemoving] = useState(opening.removing);
  const scroll = useRef<ScrollViewInstance>(null);
  const stepRef = useRef<ViewInstance>(null);
  const removeRef = useRef<ViewInstance>(null);
  const rows = useRef<Record<string, ViewInstance | null>>({});
  const focusBack = useRef<ScreenReaderTarget | null>(null);

  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [saved]);

  function editFrom(area: string | null, opener: ViewInstance | null): void {
    focusBack.current = opener;
    setEdit((now) => ({ visit: now.visit + 1, area, grant: null }));
    setEditing(true);
  }

  return (
    <>
      <SummaryPage title={role.name} back={back} column={column} scrollRef={scroll}>
        <RoleCard
          role={role}
          saved={saved}
          announce={opening.announce ?? false}
          stepRef={stepRef}
          onEdit={() => editFrom(null, stepRef.current)}
        />
        <AccessRows
          grant={role.grant}
          owner={role.owner}
          rowRefs={rows}
          onOpen={(area) => editFrom(area, rows.current[area] ?? null)}
        />
        <WhoHasIt holders={role.holders} role={role.name} />
        <WhatTheySee grant={role.grant} />
        {!role.builtIn && (
          <TextAction
            ref={removeRef}
            label="Remove role…"
            removes
            onPress={() => setRemoving(true)}
            consequence={
              role.holders.length > 0 ? 'Its people move to the role you pick.' : removeLine(0)
            }
            testID="roles.remove"
          />
        )}
      </SummaryPage>
      {!role.owner && (
        <EditScreen
          key={edit.visit}
          role={role}
          roles={roles}
          viewer={viewer}
          open={editing}
          start={{ grant: edit.grant, area: edit.area, nameRefused: false }}
          opener={focusBack}
          onCancel={() => setEditing(false)}
          onSave={(grant, name) => {
            setEditing(false);
            onSave(role.id, grant, name);
            setSaved(true);
          }}
        />
      )}
      {!role.builtIn && (
        <RemoveScreen
          role={role}
          roles={roles}
          viewer={viewer}
          open={removing}
          opener={removeRef}
          onCancel={() => setRemoving(false)}
          onRemove={(movedTo) => {
            setRemoving(false);
            onRemove(role.id, movedTo);
          }}
        />
      )}
    </>
  );
}
