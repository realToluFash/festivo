import type { RefObject } from 'react';

import { AddScreen as ProductAddScreen } from '../../components/PeopleParts.tsx';
import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import { Avatar } from '../../components/SettingsParts.tsx';
import { jobCount, W } from '../doorCode/DoorCodeWords.ts';
import {
  type Address,
  addView,
  addWords,
  type EventRole,
  FIND_LABEL,
  FIRST_ROLE,
  fromOutside,
  leadOff,
  NAME_LABEL,
  offerLine,
  onAlreadyLine,
  type OnEvent,
  ORGANISATION,
  type OrgMember,
  outsideRefusal,
  type PeopleViewer,
  PICK_ANOTHER,
  UNUSABLE,
} from './PeopleSample.ts';

const SEND_MS = 400;

export interface Added {
  role: EventRole;
  members: readonly OrgMember[];
  outside: { address: Address; job: string } | null;
}

type Went =
  { kind: 'member'; member: OrgMember } | { kind: 'outside'; address: Address; job: string };

function later(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, ms));
}

/** The product's Add people on sample data: members a name finds, and someone from outside by their email address or mobile number (sc-71), nothing sent to the API. */
export function AddScreen({
  open,
  members,
  onEvent,
  viewer,
  organisation = ORGANISATION,
  country,
  opener,
  refuses,
  startTyped = '',
  startRole = FIRST_ROLE,
  onClose,
  onAdd,
}: {
  open: boolean;
  members: readonly OrgMember[];
  onEvent: readonly OnEvent[];
  viewer: PeopleViewer;
  organisation?: string;
  country: string;
  opener: RefObject<ScreenReaderTarget | null>;
  refuses?: string | undefined;
  startTyped?: string | undefined;
  startRole?: EventRole | undefined;
  onClose: () => void;
  onAdd: (added: Added, finished: boolean) => void;
}) {
  const all = addView('', members, onEvent);
  const nothingLeft = all.kind === 'members' && all.offered.length === 0;

  return (
    <ProductAddScreen<EventRole, Went>
      open={open}
      first={startRole}
      startTyped={startTyped}
      offered={(typed) => {
        const view = addView(typed, members, onEvent);

        return (view.kind === 'members' ? view.offered : []).map((member) => ({
          id: member.id,
          name: member.name,
          face: <Avatar initials={member.initials} side={40} tone={member.tone} />,
          line: offerLine(member, viewer),
        }));
      }}
      outside={{
        country,
        lead: 'Lead',
        holder: (address) => {
          const wanted = address.address.toLowerCase();

          return onEvent.find((one) => one.id.toLowerCase() === wanted)?.name ?? null;
        },
        add: async (_role, address, job) => {
          await later(SEND_MS);
          const refusal = outsideRefusal(address, members);
          if (refusal != null) throw refusal;

          return { kind: 'outside', address, job };
        },
        words: {
          find: FIND_LABEL,
          findName: NAME_LABEL,
          fromOutside: fromOutside(organisation),
          leadOff: leadOff(organisation),
          pickAnother: PICK_ANOTHER,
          unusable: UNUSABLE,
          onAlready: onAlreadyLine,
          jobLabel: W.jobLabel,
          jobHelp: jobCount,
        },
      }}
      words={addWords(organisation, nothingLeft)}
      opener={opener}
      onClose={onClose}
      add={async (_role, id) => {
        await later(SEND_MS);
        const member = members.find((one) => one.id === id);
        if (id === refuses || member == null) throw new Error(`${id} is not added in the sample.`);

        return { kind: 'member', member };
      }}
      onAdded={(role, went, finished) => {
        const outside = went.find((one) => one.kind === 'outside');
        onAdd(
          {
            role,
            members: went.flatMap((one) => (one.kind === 'member' ? [one.member] : [])),
            outside: outside == null ? null : { address: outside.address, job: outside.job },
          },
          finished,
        );
      }}
    />
  );
}
