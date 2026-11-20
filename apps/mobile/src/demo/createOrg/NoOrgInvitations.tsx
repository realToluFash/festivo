import { invitationWording } from '@soirely/domain';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Initials } from '../../components/Initials.tsx';
import { Notice } from '../../components/Notice.tsx';
import { Pill } from '../../components/SettingsParts.tsx';
import { Text } from '../../components/Text.tsx';
import { dateLocale } from '../../i18n/index.ts';
import { tokens } from '../../theme/tokens.ts';
import { useNoOrgInvitations } from '../OrgSwitcher.tsx';
import { type Invite, untilIn } from '../OrgSwitcherModel.ts';

const TILE = 48;

/** Invitations, in place of the way on (main's NoOrganisation): each one waiting as a row with its dashed tile and the switcher's own answers, a hairline between (sc-75471). */
export function NoOrgInvitations() {
  const { t } = useTranslation();
  const { invitations } = useNoOrgInvitations();

  if (invitations.length === 0) return null;

  return (
    <View testID="noOrganisation.invitations">
      <Text size={14} weight="semibold" muted accessibilityRole="header" style={styles.heading}>
        {t('invitations.heading')}
      </Text>
      <View style={styles.list}>
        {invitations.map((invite) => (
          <InvitationRow key={invite.id} invite={invite} />
        ))}
      </View>
    </View>
  );
}

function InvitationRow({ invite }: { invite: Invite }) {
  const { t } = useTranslation();
  const { outcomes, answer, open } = useNoOrgInvitations();
  const outcome = outcomes[invite.id];
  const keys = invitationWording(invite);
  const organisation = invite.name;
  const inviter = invite.invitedBy?.name ?? '';
  const busy = outcome?.kind === 'busy' ? outcome.answer : null;

  return (
    <View style={styles.row} testID={`noOrganisation.invitation.${invite.id}`}>
      <View
        style={styles.tile}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Initials name={organisation} size={20} weight="bold" style={styles.secondary} />
      </View>
      <View style={styles.words}>
        <Text size={16} weight="bold" style={styles.name}>
          {organisation}
        </Text>
        <View style={styles.lines}>
          <Text size={14} weight="medium" muted style={styles.line}>
            {t(keys.line, { inviter, role: invite.role })}
          </Text>
          <Text size={14} weight="medium" muted style={[styles.line, styles.figures]}>
            {t(keys.until, { date: untilIn(dateLocale(), invite.until), email: invite.email })}
          </Text>
        </View>
        {outcome?.kind === 'accepted' ? (
          <View style={styles.under}>
            <Notice
              tone="done"
              mark={tokens.marks.done.glyph}
              body={t('invitations.joined', { organisation, role: invite.role })}
              takesFocus
            />
            <View style={styles.open}>
              <Pill
                label={t('invitations.open', { organisation })}
                full={false}
                height={tokens.sizeHit}
                onPress={() => open(invite.id)}
                testID={`noOrganisation.invitation.${invite.id}.open`}
              />
            </View>
          </View>
        ) : outcome?.kind === 'declined' ? (
          <View style={styles.under}>
            <Notice tone="quiet" mark="–" body={t(keys.declined, { inviter })} takesFocus />
          </View>
        ) : (
          <View style={styles.under}>
            <View style={styles.answers}>
              <Pill
                label={busy === 'accept' ? t('invitations.joining') : t('invitations.accept')}
                accessibilityLabel={
                  busy === 'accept'
                    ? t('invitations.joining')
                    : t('invitations.acceptLabel', { organisation })
                }
                kind={busy == null ? 'primary' : 'off'}
                busy={busy === 'accept'}
                full={false}
                height={tokens.sizeHit}
                onPress={() => busy == null && answer(invite.id, true)}
                testID={`noOrganisation.invitation.${invite.id}.accept`}
              />
              <Pill
                label={busy === 'decline' ? t('invitations.declining') : t('invitations.decline')}
                accessibilityLabel={
                  busy === 'decline'
                    ? t('invitations.declining')
                    : t('invitations.declineLabel', { organisation })
                }
                kind={busy == null ? 'secondary' : 'off'}
                busy={busy === 'decline'}
                full={false}
                height={tokens.sizeHit}
                onPress={() => busy == null && answer(invite.id, false)}
                testID={`noOrganisation.invitation.${invite.id}.decline`}
              />
            </View>
            <Text size={13} weight="medium" muted style={styles.note}>
              {t(keys.declineNote, { inviter })}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { lineHeight: 14 * 1.4, marginBottom: tokens.spaceSm },
  list: { borderBottomWidth: 1, borderBottomColor: tokens.colorBorder },
  row: {
    flexDirection: 'row',
    gap: tokens.spaceLg,
    paddingVertical: tokens.spaceXl,
    borderTopWidth: 1,
    borderTopColor: tokens.colorBorder,
  },
  tile: {
    width: TILE,
    height: TILE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: TILE / 3,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: tokens.colorFieldBorder,
    backgroundColor: tokens.colorCard,
  },
  secondary: { color: tokens.colorInkSecondary },
  words: { flex: 1, minWidth: 0 },
  name: { lineHeight: 16 * 1.3 },
  lines: { marginTop: tokens.spaceXs, gap: tokens.spaceHair },
  line: { lineHeight: 14 * 1.4 },
  figures: { fontVariant: ['tabular-nums'] },
  under: { marginTop: tokens.spaceMd },
  answers: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceMd },
  open: { marginTop: tokens.spaceMd, alignItems: 'flex-start' },
  note: { marginTop: tokens.spaceSm, lineHeight: 13 * 1.4 },
});
