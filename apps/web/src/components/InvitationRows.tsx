import type { InvitationPreview } from '@soirely/api-client';
import {
  formatDay,
  initials,
  invitationWording,
  isWaiting,
  refusalBody,
  roleName,
} from '@soirely/domain';
import { useTranslation } from 'react-i18next';

import { dateLocale } from '../i18n/index.ts';
import type { WaitingInvitations } from '../invitations.ts';

/** What follows "You joined": a button into it, or, on `/complete-profile`, a line saying where finishing goes. */
export type AfterJoining =
  { open: (organisationId: string) => void } | { note: (invitationId: string) => string };

/** `OrgSwitcher-*` Tweaks `invitation` to `no_org_invitation`: each one waiting, and what came of answering it. */
export function InvitationRows({
  waiting,
  place,
  after,
}: {
  waiting: WaitingInvitations;
  place: 'menu' | 'page' | 'profile';
  after: AfterJoining;
}) {
  return (
    <>
      {waiting.invitations.map((invitation) => (
        <InvitationRow
          key={invitation.id}
          invitation={invitation}
          waiting={waiting}
          headingId={`invitation-${invitation.id}-${place}`}
          after={after}
        />
      ))}
    </>
  );
}

function InvitationRow({
  invitation,
  waiting,
  headingId,
  after,
}: {
  invitation: InvitationPreview;
  waiting: WaitingInvitations;
  headingId: string;
  after: AfterJoining;
}) {
  const { t } = useTranslation();
  const outcome = waiting.outcomes[invitation.id];
  const keys = invitationWording(invitation);
  const organisation = invitation.organisation.name;
  const inviter = invitation.invitedBy?.name ?? '';
  const role = invitation.role == null ? '' : roleName(t, invitation.role);
  const answering = isWaiting(outcome);
  const busy = outcome?.kind === 'busy' ? outcome.answer : null;

  return (
    <div className="invitation-row" role="group" aria-labelledby={headingId}>
      <div className="invitation-row-head">
        <span className="org-tile org-tile-invited" aria-hidden="true">
          {initials(organisation)}
        </span>
        <div className="invitation-row-naming">
          <p id={headingId} className="invitation-row-name">
            {organisation}
          </p>
          <p className="invitation-row-line">{t(keys.line, { inviter, role })}</p>
          <p className="invitation-row-until">
            {t(keys.until, {
              date: formatDay(invitation.expiresAt, dateLocale()),
              email: invitation.email,
            })}
          </p>
        </div>
      </div>

      {answering && (
        <div className="invitation-row-answer">
          {outcome?.kind === 'failed' && (
            <div className="notice notice-broken" role="alert">
              <span className="mark mark-broken" aria-hidden="true">
                ✕
              </span>
              <p>{t('invitations.failed')}</p>
            </div>
          )}
          <div className="invitation-row-buttons">
            <button
              className="button button-primary"
              type="button"
              disabled={busy != null}
              aria-busy={busy === 'accept'}
              aria-label={t('invitations.acceptLabel', { organisation })}
              onClick={() => void waiting.answer(invitation, 'accept')}
            >
              {t('invitations.accept')}
            </button>
            <button
              className="button"
              type="button"
              disabled={busy != null}
              aria-busy={busy === 'decline'}
              aria-label={t('invitations.declineLabel', { organisation })}
              onClick={() => void waiting.answer(invitation, 'decline')}
            >
              {t('invitations.decline')}
            </button>
          </div>
          <p className="invitation-row-note">{t(keys.declineNote, { inviter })}</p>
        </div>
      )}

      {outcome?.kind === 'accepted' &&
        ('open' in after ? (
          <div className="invitation-row-answer">
            <div className="invitation-row-said invitation-row-joined" role="status">
              <span className="mark mark-done" aria-hidden="true">
                ✓
              </span>
              <p>{t('invitations.joined', { organisation, role })}</p>
            </div>
            <button
              className="button button-primary invitation-row-open"
              type="button"
              title={t('invitations.open', { organisation })}
              onClick={() => after.open(outcome.organisationId)}
            >
              {t('invitations.open', { organisation })}
            </button>
          </div>
        ) : (
          <div className="invitation-row-said" role="status">
            <span className="mark mark-done" aria-hidden="true">
              ✓
            </span>
            <div className="invitation-row-joined-saying">
              <p className="invitation-row-joined">
                {t('invitations.joined', { organisation, role })}
              </p>
              <p className="invitation-row-next">{after.note(invitation.id)}</p>
            </div>
          </div>
        ))}

      {outcome?.kind === 'declined' && (
        <div className="invitation-row-said" role="status">
          <span className="mark mark-info" aria-hidden="true">
            –
          </span>
          <p>{t(keys.declined, { inviter })}</p>
        </div>
      )}

      {outcome?.kind === 'refused' && (
        <div
          className={`notice ${outcome.refusal === 'invitation_expired' ? 'notice-attention' : 'notice-quiet'}`}
          role="status"
        >
          <span
            className={`mark ${outcome.refusal === 'invitation_expired' ? 'mark-attention' : 'mark-info'}`}
            aria-hidden="true"
          >
            {outcome.refusal === 'invitation_expired' ? '!' : 'i'}
          </span>
          <div className="notice-body">
            <p className="notice-title">{t(`invitations.refused.${outcome.refusal}.word`)}</p>
            <p>
              {t(refusalBody(outcome.refusal, invitation.invitedBy != null), {
                inviter,
                organisation,
                email: invitation.email,
                signedInAs: invitation.signedInAs ?? '',
              })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
