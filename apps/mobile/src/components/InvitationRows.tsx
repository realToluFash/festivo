import type { InvitationPreview } from '@soirely/api-client';
import {
  formatDay,
  type InvitationOutcome,
  invitationWording,
  isWaiting,
  roleName,
} from '@soirely/domain';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { dateLocale } from '../i18n/index.ts';
import type { WaitingInvitations } from '../invitations.ts';
import { tokens } from '../theme/tokens.ts';
import { PrimaryButton, SecondaryButton } from './Buttons.tsx';
import { InvitationFailedNotice, InvitationRefusalNotice } from './InvitationNotices.tsx';
import { SeatsFullSheet } from './LimitRefusal.tsx';
import { OrgTile } from './OrgTile.tsx';
import { Notice } from './Notice.tsx';
import { Text } from './Text.tsx';

/** What follows "You joined": a button into it, or, on `/complete-profile`, a line saying where finishing goes. */
export type AfterJoining =
  { open: (organisationId: string) => void } | { note: (invitationId: string) => string };

/** `OrgSwitcher-*` Tweaks `invitation` to `invitation_sparse`: each one waiting, and what came of answering it. */
export function InvitationRows({
  waiting,
  after,
}: {
  waiting: WaitingInvitations;
  after: AfterJoining;
}) {
  return (
    <>
      {waiting.invitations.map((invitation) => (
        <InvitationRow
          key={invitation.id}
          invitation={invitation}
          waiting={waiting}
          after={after}
        />
      ))}
    </>
  );
}

function InvitationRow({
  invitation,
  waiting,
  after,
}: {
  invitation: InvitationPreview;
  waiting: WaitingInvitations;
  after: AfterJoining;
}) {
  const { t } = useTranslation();
  const outcome = waiting.outcomes[invitation.id];
  const [answered, setAnswered] = useState<InvitationOutcome | null>(null);
  const answer = outcome === answered ? outcome : undefined;
  const keys = invitationWording(invitation);
  const organisation = invitation.organisation.name;
  const inviter = invitation.invitedBy?.name ?? '';
  const role = invitation.role == null ? '' : roleName(t, invitation.role);
  const busy = outcome?.kind === 'busy' ? outcome.answer : null;

  return (
    <View style={styles.row}>
      <View style={styles.head}>
        <OrgTile name={organisation} invited />
        <View style={styles.naming}>
          <Text size={tokens.typeRowTitle.size} weight="semibold">
            {organisation}
          </Text>
          <Text size={tokens.typeSmall.size} muted>
            {t(keys.line, { inviter, role })}
          </Text>
          <Text size={tokens.typeSmall.size} muted>
            {t(keys.until, {
              date: formatDay(invitation.expiresAt, dateLocale()),
              email: invitation.email,
            })}
          </Text>
        </View>
      </View>

      {isWaiting(outcome) && (
        <View style={styles.answer}>
          {outcome?.kind === 'failed' && <InvitationFailedNotice answer={answer} />}
          <SeatsFullSheet outcome={outcome} testID={`invitations.${invitation.id}.seatsFull`} />
          <View style={styles.buttons}>
            <PrimaryButton
              label={t('invitations.accept')}
              accessibilityLabel={t('invitations.acceptLabel', { organisation })}
              busy={busy === 'accept'}
              off={busy === 'decline'}
              onPress={() => void waiting.answer(invitation, 'accept').then(setAnswered)}
              testID={`invitation.${invitation.id}.accept`}
            />
            <SecondaryButton
              label={t('invitations.decline')}
              accessibilityLabel={t('invitations.declineLabel', { organisation })}
              off={busy != null}
              onPress={() => void waiting.answer(invitation, 'decline').then(setAnswered)}
              testID={`invitation.${invitation.id}.decline`}
            />
          </View>
          <Text size={tokens.typeSmall.size} muted>
            {t(keys.declineNote, { inviter })}
          </Text>
        </View>
      )}

      {outcome?.kind === 'accepted' &&
        ('open' in after ? (
          <View style={styles.answer}>
            <Notice
              tone="done"
              mark="✓"
              body={t('invitations.joined', { organisation, role })}
              answer={answer}
              takesFocus
            />
            <PrimaryButton
              label={t('invitations.open', { organisation })}
              onPress={() => after.open(outcome.organisationId)}
              testID={`invitation.${invitation.id}.open`}
            />
          </View>
        ) : (
          <Notice
            tone="done"
            mark="✓"
            title={t('invitations.joined', { organisation, role })}
            body={after.note(invitation.id)}
            answer={answer}
            takesFocus
          />
        ))}

      {outcome?.kind === 'declined' && (
        <Notice
          tone="quiet"
          mark="–"
          body={t(keys.declined, { inviter })}
          answer={answer}
          takesFocus
        />
      )}

      {outcome?.kind === 'refused' && (
        <InvitationRefusalNotice
          refusal={outcome.refusal}
          organisation={organisation}
          invitation={invitation}
          answer={answer}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: tokens.spaceMd,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusInset,
    borderWidth: 1,
    borderColor: tokens.colorInsetBorder,
    backgroundColor: tokens.colorInset,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceMd },
  naming: { flex: 1, minWidth: 0, gap: tokens.spaceHair },
  answer: { gap: tokens.spaceSm, alignItems: 'flex-start' },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
});
