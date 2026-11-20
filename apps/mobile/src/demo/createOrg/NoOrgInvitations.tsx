import { invitationWording } from '@soirely/domain';
import { useTranslation } from 'react-i18next';

import { NoOrgInvitationList, NoOrgInvitationRow } from '../../components/NoOrgInvitations.tsx';
import { dateLocale } from '../../i18n/index.ts';
import { invitationRowOf, wayOnShows } from '../../kit/noOrgInvitations.ts';
import { useNoOrgInvitations } from '../OrgSwitcher.tsx';
import { type Invite, untilIn } from '../OrgSwitcherModel.ts';

/** Invitations, in place of the way on (main's NoOrganisation): each one waiting as a row with its dashed tile and the switcher's own answers, a hairline between (sc-75471). */
export function NoOrgInvitations() {
  const { invitations } = useNoOrgInvitations();

  if (wayOnShows(invitations)) return null;

  return (
    <NoOrgInvitationList>
      {invitations.map((invite) => (
        <InvitationRow key={invite.id} invite={invite} />
      ))}
    </NoOrgInvitationList>
  );
}

function InvitationRow({ invite }: { invite: Invite }) {
  const { t } = useTranslation();
  const { outcomes, answer, open } = useNoOrgInvitations();
  const keys = invitationWording(invite);
  const inviter = invite.invitedBy?.name ?? '';

  return (
    <NoOrgInvitationRow
      id={invite.id}
      organisation={invite.name}
      role={invite.role}
      line={t(keys.line, { inviter, role: invite.role })}
      until={t(keys.until, { date: untilIn(dateLocale(), invite.until), email: invite.email })}
      note={t(keys.declineNote, { inviter })}
      declined={t(keys.declined, { inviter })}
      row={invitationRowOf(outcomes[invite.id])}
      onAnswer={(yes) => answer(invite.id, yes)}
      onOpen={() => open(invite.id)}
    />
  );
}
