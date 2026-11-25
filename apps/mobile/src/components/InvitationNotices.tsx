import { type InvitationRefusalCode, refusalBody } from '@soirely/domain';
import { useTranslation } from 'react-i18next';

import { tokens } from '../theme/tokens.ts';
import { Notice } from './Notice.tsx';

/** What the API refused an answer with, in the switcher's words, wherever an invitation is answered. */
export function InvitationRefusalNotice({
  refusal,
  organisation,
  invitation,
  answer,
}: {
  refusal: InvitationRefusalCode;
  organisation: string;
  invitation: {
    invitedBy: { name: string } | null;
    email: string;
    signedInAs: string | null;
  };
  answer: unknown;
}) {
  const { t } = useTranslation();
  const expired = refusal === 'invitation_expired';

  return (
    <Notice
      tone={expired ? 'attention' : 'quiet'}
      mark={expired ? '!' : tokens.marks.info.glyph}
      title={t(`invitations.refused.${refusal}.word`)}
      body={t(refusalBody(refusal, invitation.invitedBy != null), {
        inviter: invitation.invitedBy?.name ?? '',
        organisation,
        email: invitation.email,
        signedInAs: invitation.signedInAs ?? '',
      })}
      answer={answer}
      takesFocus
    />
  );
}

/** An answer that did not reach the API, read out as it appears. */
export function InvitationFailedNotice({ answer }: { answer: unknown }) {
  const { t } = useTranslation();

  return (
    <Notice
      tone="broken"
      mark={tokens.marks.broken.glyph}
      body={t('invitations.failed')}
      answer={answer}
    />
  );
}
