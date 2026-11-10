import type { RefObject } from 'react';

import { AddScreen as AddPeople } from '../../components/PeopleParts.tsx';
import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import { Avatar } from '../../components/SettingsParts.tsx';
import {
  addView,
  addWords,
  type EventRole,
  FIRST_ROLE,
  offerLine,
  type OnEvent,
  ORGANISATION,
  type OrgMember,
  type PeopleViewer,
} from './PeopleSample.ts';

/** The product's Add people on sample data: the members a name finds, each added at once. */
export function AddScreen({
  open,
  members,
  onEvent,
  viewer,
  organisation = ORGANISATION,
  opener,
  refuses,
  onClose,
  onAdd,
}: {
  open: boolean;
  members: readonly OrgMember[];
  onEvent: readonly OnEvent[];
  viewer: PeopleViewer;
  organisation?: string;
  opener: RefObject<ScreenReaderTarget | null>;
  refuses?: string | undefined;
  onClose: () => void;
  onAdd: (role: EventRole, adding: readonly OrgMember[], finished: boolean) => void;
}) {
  const view = addView('', members, onEvent);
  const nothingLeft = view.kind === 'members' && view.offered.length === 0;

  return (
    <AddPeople
      open={open}
      first={FIRST_ROLE}
      offered={(typed) => {
        const view = addView(typed, members, onEvent);

        return view.kind === 'nobody'
          ? []
          : view.offered.map((member) => ({
              id: member.id,
              name: member.name,
              face: <Avatar initials={member.initials} side={40} tone={member.tone} />,
              line: offerLine(member, viewer),
            }));
      }}
      words={addWords(organisation, nothingLeft)}
      opener={opener}
      onClose={onClose}
      add={(_role, id) => {
        const member = members.find((one) => one.id === id);

        return member == null || id === refuses
          ? Promise.reject(new Error(`${id} is not added in the sample.`))
          : Promise.resolve(member);
      }}
      onAdded={onAdd}
    />
  );
}
