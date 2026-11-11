import type {
  Membership,
  MembersList,
  OrganisationMember,
  OrganisationRole,
} from '@soirely/api-client';
import { approvalRoles, firstName, formatDay, roleName } from '@soirely/domain';
import { type RefObject, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { api } from '../api.ts';
import { dateLocale } from '../i18n/index.ts';
import { membersAfterWrite, withApproved, withTurnedDown } from '../kit/membersAfterWrite.ts';
import { faceOf, type MembersSaid } from '../kit/membersSummary.ts';
import { refusalFor } from '../kit/refusal.ts';
import { tokens } from '../theme/tokens.ts';
import { FieldError } from './Field.tsx';
import { RoleChoices } from './RoleChoices.tsx';
import type { ScreenReaderTarget } from './screenReaderFocus.ts';
import { Avatar } from './SettingsParts.tsx';
import { type AskProps, FocusedScreen, Line, Section, TextAction } from './Summary.tsx';
import { Text } from './Text.tsx';

type Asking = 'none' | 'turningDown' | 'discarding';

/** A request to join on its own screen: Approve with a role, Member first; turning it down asks first (sc-392). */
export function RequestScreen({
  organisation,
  member,
  list,
  roles,
  open,
  opener,
  onClose,
  onAnswered,
}: {
  organisation: Membership;
  member: OrganisationMember;
  list: MembersList;
  roles: readonly OrganisationRole[];
  open: boolean;
  opener: RefObject<ScreenReaderTarget | null>;
  onClose: () => void;
  onAnswered: (list: MembersList, said: MembersSaid) => void;
}) {
  const { t } = useTranslation();
  const offered = approvalRoles(roles);
  const firstRole = offered[0]?.id ?? '';
  const [picked, setPicked] = useState(firstRole);
  const [asking, setAsking] = useState<Asking>('none');
  const [busy, setBusy] = useState<'approve' | 'turnDown' | null>(null);
  const [failed, setFailed] = useState<{ on: 'approve' | 'turnDown'; words: string } | null>(null);
  const name = member.user.name;
  const first = firstName(name);
  const face = faceOf(member);
  const role = offered.find((one) => one.id === picked);
  const read = () => api.members(organisation.id);
  const asked = member.since == null ? '' : formatDay(member.since, dateLocale());

  async function approve(): Promise<void> {
    if (role == null) return;
    setBusy('approve');
    setFailed(null);
    try {
      await api.approveMember(organisation.id, member.id, role.id);
    } catch (error) {
      setFailed({
        on: 'approve',
        words: refusalFor(error, 'roleId', t('membersScreen.actionFailed')),
      });
      setBusy(null);
      return;
    }
    onAnswered(await membersAfterWrite(read, list, withApproved(member.id, role)), {
      kind: 'approved',
      member: member.id,
      name,
      role: roleName(t, role),
    });
  }

  async function turnDown(): Promise<void> {
    setBusy('turnDown');
    setFailed(null);
    try {
      await api.turnDownMember(organisation.id, member.id);
    } catch (error) {
      setFailed({
        on: 'turnDown',
        words: refusalFor(error, 'roleId', t('membersScreen.actionFailed')),
      });
      setBusy(null);
      return;
    }
    onAnswered(await membersAfterWrite(read, list, withTurnedDown(member.id)), {
      kind: 'turnedDown',
      name,
    });
  }

  const ask: AskProps | null =
    asking === 'turningDown'
      ? {
          title: t('membersScreen.awaiting.turnDownTitle', { name }),
          line: t('membersScreen.request.turnDownLine'),
          keep: {
            label: t('membersScreen.awaiting.keep'),
            testID: 'members.turnDown.keep',
            off: busy != null,
          },
          confirm: {
            label: t('membersScreen.awaiting.turnDown'),
            testID: 'members.turnDown.confirm',
            removes: true,
            busy: busy === 'turnDown' ? t('membersScreen.request.turningDown') : undefined,
          },
          failed: failed?.on === 'turnDown' ? failed.words : null,
          onKeep: () => {
            if (busy != null) return;
            setFailed(null);
            setAsking('none');
          },
          onConfirm: () => void turnDown(),
        }
      : asking === 'discarding'
        ? {
            title: t('membersScreen.discardTitle'),
            line: t('membersScreen.request.keepsWaiting', { first }),
            keep: { label: t('membersScreen.keepEditing'), testID: 'members.approve.keep' },
            confirm: {
              label: t('membersScreen.discard'),
              testID: 'members.approve.discard',
              removes: true,
            },
            onKeep: () => setAsking('none'),
            onConfirm: onClose,
          }
        : null;

  return (
    <FocusedScreen
      open={open}
      title={t('membersScreen.request.title', { first })}
      verb={{
        label: t('membersScreen.awaiting.approve'),
        on: role != null && busy == null,
        busy: busy === 'approve',
        onPress: () => void approve(),
        testID: 'members.approve.confirm',
      }}
      waits={busy != null}
      onCancel={() => (picked === firstRole ? onClose() : setAsking('discarding'))}
      cancelLabel={t('membersScreen.awaiting.cancel')}
      cancelTestID="members.approve.cancel"
      opener={opener}
      ask={ask}
    >
      <View style={styles.head}>
        <Avatar initials={face.initials} side={56} tone={face.tone} />
        <View style={styles.headWords}>
          <Text size={22} weight="bold">
            {name}
          </Text>
          {member.user.email != null && (
            <Text size={15} weight="medium" style={styles.secondary}>
              {member.user.email}
            </Text>
          )}
        </View>
      </View>
      <Line
        quiet={false}
        text={
          member.removesAt == null
            ? t('membersScreen.request.asked', { organisation: organisation.name, date: asked })
            : t('membersScreen.request.askedRemoves', {
                organisation: organisation.name,
                date: asked,
                deadline: member.removesAt.written,
              })
        }
      />
      <Line text={t('membersScreen.awaiting.note')} />
      <Section title={t('membersScreen.roleTitle')} foot={t('membersScreen.request.ownerLater')}>
        <View accessibilityRole="radiogroup">
          <RoleChoices
            roles={offered.map((one) => one.id)}
            picked={picked}
            name={(id) => roleNamed(t, offered, id)}
            lines={roleLines(t, offered)}
            onPick={(id) => {
              setFailed(null);
              setPicked(id);
            }}
            testID="members.approveAs"
          />
        </View>
      </Section>
      {failed?.on === 'approve' && (
        <View accessibilityRole="alert">
          <FieldError message={failed.words} />
        </View>
      )}
      <TextAction
        label={t('membersScreen.request.turnDownOpen')}
        removes
        off={busy != null}
        onPress={() => setAsking('turningDown')}
        consequence={t('membersScreen.awaiting.turnDownBody', {
          name,
          organisation: organisation.name,
        })}
        testID="members.turnDown"
      />
    </FocusedScreen>
  );
}

type NamedRole = Pick<OrganisationRole, 'id' | 'seededAs' | 'name'>;

export function roleNamed(
  t: Parameters<typeof roleName>[0],
  roles: readonly NamedRole[],
  id: string,
): string {
  const role = roles.find((one) => one.id === id);

  return role == null ? '' : roleName(t, role);
}

/** What each role means, in the reader's language; a role an organisation made has no line. */
export function roleLines(
  t: (key: string) => string,
  roles: readonly NamedRole[],
): Record<string, string> {
  return Object.fromEntries(
    roles
      .filter((role) => role.seededAs != null)
      .map((role) => [role.id, t(`membersScreen.roleMeans.${role.seededAs}`)]),
  );
}

const styles = StyleSheet.create({
  secondary: { color: tokens.colorInkSecondary },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: tokens.spaceXs },
  headWords: { flex: 1, minWidth: 0, gap: 2 },
});
